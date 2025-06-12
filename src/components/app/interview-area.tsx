
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send, SkipForward, RefreshCcw, Lightbulb, CheckCircle, Video, VideoOff, AlertCircle, Play, Eye, EyeOff } from 'lucide-react';
import type { EvaluateAnswerOutput } from '@/ai/flows/evaluate-answer';
import type { AnalyzeCommunicationOutput } from '@/ai/flows/analyze-communication-flow';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type InterviewAreaProps = {
  question: string;
  questionNumber: number;
  totalQuestions: number;
  onSubmitAnswer: (answer: string, voiceRecordingDuration: number, recordedVideoUrl?: string | null) => Promise<void>;
  onSkipQuestion: () => void;
  onRegenerateQuestion: () => void;
  onGetModelAnswer: () => Promise<void>;
  onNextQuestion: () => void;
  onFinishInterview: () => void;
  isLoadingEvaluation: boolean;
  isLoadingModelAnswer: boolean;
  isLoadingNewQuestion: boolean;
  evaluationResult: EvaluateAnswerOutput | null;
  communicationAnalysisResult: AnalyzeCommunicationOutput | null;
  modelAnswerText: string | null;
  isLastQuestion: boolean;
};

const EXPECTED_ANSWER_TIME_SECONDS = 120; 

export default function InterviewArea({
  question,
  questionNumber,
  totalQuestions,
  onSubmitAnswer,
  onSkipQuestion,
  onRegenerateQuestion,
  onGetModelAnswer,
  onNextQuestion,
  onFinishInterview,
  isLoadingEvaluation,
  isLoadingModelAnswer,
  isLoadingNewQuestion,
  evaluationResult,
  communicationAnalysisResult,
  modelAnswerText,
  isLastQuestion,
}: InterviewAreaProps) {
  const [answer, setAnswer] = useState(''); // Transcribed text
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false); // True if video/audio recording is active
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]); // For combined video/audio
  
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState<number>(0);

  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(true);


  const { toast } = useToast();

  // Permission and stream setup
  useEffect(() => {
    const getPermissionsAndStream = async () => {
      try {
        console.log("Attempting to get user media (video & audio)...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoStreamRef.current = stream;
        if (videoPreviewRef.current) {
          console.log("Attaching video stream to preview element.");
          videoPreviewRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
        console.log("User media stream obtained.");
      } catch (error) {
        console.error('Error accessing camera/microphone:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Device Access Denied',
          description: 'Please enable camera and microphone permissions in your browser settings to record video answers.',
          duration: 7000,
        });
      }
    };
    getPermissionsAndStream();

    return () => {
      if (videoStreamRef.current) {
        console.log("Stopping all tracks on component unmount or question change.");
        videoStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
        setRecordedVideoUrl(null);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Reset for new question
  useEffect(() => {
    setAnswer('');
    setShowEvaluation(false);
    setShowModelAnswer(false);
    setRecordedVideoUrl(prevUrl => {
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      return null;
    });

    if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop(); // This will trigger onstop
    }
    setIsRecording(false);
    setIsTranscribing(false);
    setRecordingStartTime(null);
    setRecordingDurationSeconds(0);
    mediaChunksRef.current = [];
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]); 


  const toggleRecording = async () => {
    if (isTranscribing) {
      toast({ title: "Busy", description: "Please wait for transcription to complete.", variant: "default" });
      return;
    }
    if (hasCameraPermission === false) {
      toast({ title: "Permissions Required", description: "Camera and microphone access is needed to record.", variant: "destructive" });
      return;
    }
    if (!videoStreamRef.current) {
       toast({ title: "Error", description: "Camera stream not available. Try refreshing.", variant: "destructive" });
      return;
    }

    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop(); // onstop will handle transcription and video URL
      }
      setIsRecording(false); 
    } else {
      // Start recording
      setAnswer(''); 
      setRecordingDurationSeconds(0);
      mediaChunksRef.current = [];
      if (recordedVideoUrl) { // Clean up previous recording URL
        URL.revokeObjectURL(recordedVideoUrl);
        setRecordedVideoUrl(null);
      }

      try {
        mediaRecorderRef.current = new MediaRecorder(videoStreamRef.current, { mimeType: 'video/webm; codecs=vp9,opus' }); // Specify codecs for broader compatibility

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            mediaChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstart = () => {
          setIsRecording(true);
          setRecordingStartTime(Date.now());
          toast({ title: "Recording Started", description: "Record your video answer. Click camera again to stop."});
        };
        
        mediaRecorderRef.current.onstop = async () => {
          setIsRecording(false); 
          setIsTranscribing(true);
          toast({ title: "Recording Stopped", description: "Processing your answer..." });

          if (recordingStartTime) {
            const duration = Math.round((Date.now() - recordingStartTime) / 1000);
            setRecordingDurationSeconds(duration);
          }
          setRecordingStartTime(null);

          if (mediaChunksRef.current.length === 0) {
            toast({ title: "No Data Recorded", description: "It seems no video/audio data was captured.", variant: "destructive" });
            setIsTranscribing(false);
            return;
          }

          const mediaBlob = new Blob(mediaChunksRef.current, { type: 'video/webm' });
          setRecordedVideoUrl(URL.createObjectURL(mediaBlob)); // For local playback

          const formData = new FormData();
          formData.append('audio', mediaBlob, 'recording.webm'); // Send the whole mediaBlob

          try {
            const response = await fetch('/api/transcribe', {
              method: 'POST',
              body: formData,
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            const result = await response.json();
            setAnswer(result.transcript); // This is the transcribed text
            toast({ title: "Transcription Complete!", description: "Your answer is ready to submit."});
          } catch (error) {
            console.error("Transcription API error:", error);
            const message = error instanceof Error ? error.message : "Unknown transcription error.";
            toast({ title: "Transcription Failed", description: message, variant: "destructive", duration: 7000 });
            setAnswer(''); 
          } finally {
            setIsTranscribing(false);
          }
        };
        mediaRecorderRef.current.start();
      } catch (err) {
        console.error("Error starting MediaRecorder:", err);
        const message = err instanceof Error ? err.message : "Could not start recording.";
        toast({ title: "Recording Error", description: `Failed to start video recording: ${message}`, variant: "destructive", duration: 7000 });
        setIsRecording(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (isLoadingEvaluation || isRecording || isTranscribing) {
      let busyReason = isLoadingEvaluation ? "current analysis" : (isRecording ? "recording" : "transcription");
      toast({title: "Busy", description: `Please wait for ${busyReason} to finish.`, variant: "default"});
      return;
    }
    if (!answer.trim() && !recordedVideoUrl) { // Allow submit if video was recorded, even if transcription failed.
        toast({title: "No Answer Content", description: "Please record your answer or ensure transcription was successful.", variant: "default"});
        return;
    }
    if (!answer.trim() && recordedVideoUrl) {
        toast({title: "Submitting Video", description: "Submitting video with no transcribed text. AI text analysis will be limited."});
    }
    
    await onSubmitAnswer(answer, recordingDurationSeconds, recordedVideoUrl); 
    setShowEvaluation(true);
  };

  const handleGetModel = async () => {
    if (isLoadingModelAnswer || isRecording || isTranscribing) return;
    await onGetModelAnswer();
    setShowModelAnswer(true);
  }

  const progressPercentage = (questionNumber / totalQuestions) * 100;
  
  const getTimeManagementFeedback = () => {
    if (!evaluationResult || recordingDurationSeconds <= 0) return null;
    if (recordingDurationSeconds < EXPECTED_ANSWER_TIME_SECONDS * 0.75) {
      return `Your answer was quite brief (${recordingDurationSeconds}s). Consider elaborating more. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
    } else if (recordingDurationSeconds > EXPECTED_ANSWER_TIME_SECONDS * 1.25) {
      return `Your answer was a bit long (${recordingDurationSeconds}s). Try to be more concise. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
    }
    return `Your answer duration (${recordingDurationSeconds}s) was good. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
  };
  const timeFeedback = getTimeManagementFeedback();

  const recordButtonDisabled = hasCameraPermission === false || isLoadingEvaluation || isLoadingNewQuestion || isTranscribing;
  const submitButtonDisabled = (!answer.trim() && !recordedVideoUrl) || isLoadingEvaluation || isLoadingNewQuestion || isRecording || isTranscribing;

  return (
    <TooltipProvider>
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-2xl font-semibold text-primary">Question {questionNumber} of {totalQuestions}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowVideoPreview(p => !p)}>
              {showVideoPreview ? <EyeOff size={16}/> : <Eye size={16}/>}
              {showVideoPreview ? 'Hide Preview' : 'Show Preview'}
            </Button>
          </div>
          <Progress value={progressPercentage} className="w-full h-2" />
          {isLoadingNewQuestion ? (
            <div className="flex items-center justify-center h-24">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="ml-2 text-muted-foreground">Generating question...</p>
            </div>
          ) : (
            <p className="text-xl mt-4 py-4 min-h-[6rem] leading-relaxed">{question}</p>
          )}
        </CardHeader>
        
        <CardContent className="relative">
          {hasCameraPermission === null && (
            <Alert variant="default"><AlertDescription>Checking camera permissions...</AlertDescription></Alert>
          )}
          {hasCameraPermission === false && (
             <Alert variant="destructive">
              <AlertTitle>Camera Access Required</AlertTitle>
              <AlertDescription>
                Camera and microphone access is required to record video answers. Please enable permissions in your browser settings.
              </AlertDescription>
            </Alert>
          )}

          {hasCameraPermission && showVideoPreview && (
            <div className="mb-4 rounded-md overflow-hidden shadow-inner border bg-black">
              <video ref={videoPreviewRef} className="w-full aspect-video" autoPlay muted playsInline />
            </div>
          )}
          
          {isRecording && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-1 rounded-full text-xs flex items-center shadow-lg animate-pulse z-10">
                  <Video size={14} className="mr-1" /> REC
              </div>
          )}
           {isTranscribing && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-3 py-1 rounded-full text-xs flex items-center shadow-lg animate-pulse z-10">
                  <Loader2 size={14} className="mr-1 animate-spin" /> TRANSCRIBING...
              </div>
          )}
          
          <div className={`min-h-[50px] p-3 rounded-md border bg-muted text-muted-foreground ${answer.trim() ? 'text-foreground' : ''} hidden`}
            aria-live="polite" 
          >
            {answer.trim() ? answer : "Transcribed text will appear here..."}
          </div>

           {(!isRecording && !isTranscribing && !answer.trim() && !recordedVideoUrl && hasCameraPermission) && (
            <div className="text-center text-muted-foreground py-4">
              Click the video camera below to start recording your answer.
            </div>
          )}
          {(!isRecording && !isTranscribing && (answer.trim() || recordedVideoUrl) && hasCameraPermission) && (
             <div className="text-center text-green-600 py-4 flex items-center justify-center">
              <CheckCircle size={20} className="mr-2"/> Answer recorded. Ready to submit.
            </div>
          )}

        </CardContent>

        {!showEvaluation && !isLoadingNewQuestion && (
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4">
            <div className="flex gap-2 w-full sm:w-auto">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onRegenerateQuestion} variant="outline" disabled={recordButtonDisabled || isRecording}>
                    <RefreshCcw size={18} /> Regenerate
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Get a different question.</p></TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={onSkipQuestion} variant="outline" disabled={recordButtonDisabled || isRecording}>
                    <SkipForward size={18} /> Skip
                  </Button>
                </TooltipTrigger>
                <TooltipContent><p>Skip this question.</p></TooltipContent>
              </Tooltip>
            </div>
            <div className="flex gap-2 w-full sm:w-auto items-center">
              <Tooltip>
                <TooltipTrigger asChild>
                   <Button 
                    onClick={toggleRecording} 
                    variant={isRecording ? "destructive" : "outline"}
                    size="lg" 
                    disabled={recordButtonDisabled}
                    aria-label={isRecording ? "Stop video recording" : "Start video recording answer"}
                    className={`${isRecording ? "bg-red-500 hover:bg-red-600 text-white" : ""} py-3 px-6 rounded-full`}
                  >
                    {isRecording ? <VideoOff size={24} /> : <Video size={24} />}
                    <span className="ml-2 text-base">{isRecording ? "Stop Recording" : (isTranscribing ? "Processing..." : "Record Video")}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isRecording ? "Stop video recording" : (isTranscribing ? "Processing video/audio..." : "Start video recording answer")}</p>
                </TooltipContent>
              </Tooltip>
              
              <Button onClick={handleSubmit} disabled={submitButtonDisabled} className="flex-grow sm:flex-grow-0" size="lg">
                {isLoadingEvaluation ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Send size={20} />
                )}
                Submit 
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      {isLoadingEvaluation && (
        <Card className="shadow-xl mt-4">
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-lg">Analyzing your answer...</p>
          </CardContent>
        </Card>
      )}

      {showEvaluation && evaluationResult && !isLoadingEvaluation && (
        <Card className="shadow-xl animate-in fade-in duration-500">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2"><Award size={24}/> Performance Feedback</CardTitle>
            <Alert variant={evaluationResult.score >= 70 ? "default" : "destructive"} className="mt-2 border-2">
               <Badge variant={evaluationResult.score >=70 ? 'default': 'destructive'} className="text-lg">Score: {evaluationResult.score}/100</Badge>
            </Alert>
          </CardHeader>
          <CardContent className="space-y-4">
            {recordedVideoUrl && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Your Recorded Answer:</h3>
                <video src={recordedVideoUrl} controls className="w-full rounded-md shadow-md aspect-video"></video>
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold flex items-center text-green-600"><CheckCircle size={20} className="mr-2" />Strengths</h3>
              <p className="text-muted-foreground bg-green-50 p-3 rounded-md border border-green-200">{evaluationResult.strengths}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold flex items-center text-red-600"><AlertCircle size={20} className="mr-2" />Areas for Improvement</h3>
              <p className="text-muted-foreground bg-red-50 p-3 rounded-md border border-red-200">{evaluationResult.weaknesses}</p>
            </div>

            {communicationAnalysisResult && (
              <div className="space-y-3 pt-3 border-t mt-4">
                <h3 className="text-xl font-semibold flex items-center text-primary"><BarChartHorizontal size={22} className="mr-2" />Communication Analysis</h3>
                <div className="space-y-1">
                  <p><strong className="font-medium">Clarity:</strong> {communicationAnalysisResult.clarityFeedback}</p>
                  <p><strong className="font-medium">Confidence Cues:</strong> {communicationAnalysisResult.confidenceCues}</p>
                  <p><strong className="font-medium">Speaking Pace:</strong> {communicationAnalysisResult.speakingPaceWPM} WPM. {communicationAnalysisResult.paceFeedback}</p>
                  {communicationAnalysisResult.fillerWordsFound.length > 0 && (
                    <p><strong className="font-medium">Filler Words Found:</strong> {communicationAnalysisResult.fillerWordsFound.join(', ')}</p>
                  )}
                  {timeFeedback && <p><strong className="font-medium">Time Management (Recording Duration):</strong> {timeFeedback}</p>}
                </div>
              </div>
            )}
             {(!answer.trim() && recordedVideoUrl) && (
                <Alert variant="default" className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Note on Text Analysis</AlertTitle>
                  <AlertDescription>
                    No text was transcribed from your video recording. Text-based AI analysis (clarity, textual confidence, filler words, speaking pace) might be limited or based on an empty input. Your video and its duration were still processed.
                  </AlertDescription>
                </Alert>
              )}
            
            {!modelAnswerText && (
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleGetModel} variant="outline" className="w-full sm:w-auto border-accent text-accent-foreground hover:bg-accent/10 mt-2" disabled={isLoadingModelAnswer || isRecording || isTranscribing}>
                    {isLoadingModelAnswer ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lightbulb size={18} />
                    )}
                    Show Model Answer
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Get an AI-generated ideal answer for this question.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </CardContent>
        </Card>
      )}

      {showModelAnswer && modelAnswerText && !isLoadingEvaluation && (
         <Card className="shadow-xl animate-in fade-in duration-500 mt-4">
           <CardHeader className="flex flex-row justify-between items-center">
             <CardTitle className="text-xl font-semibold flex items-center text-indigo-600"><Target size={20} className="mr-2" />Model Answer</CardTitle>
              {/* SpeechSynthesis for model answer can be added back if desired */}
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground bg-indigo-50 p-3 rounded-md border border-indigo-200">{modelAnswerText}</p>
           </CardContent>
         </Card>
      )}
      
      {showEvaluation && !isLoadingEvaluation && (
        <div className="mt-6 flex justify-end">
          {isLastQuestion ? (
            <Button onClick={onFinishInterview} size="lg" className="bg-green-500 hover:bg-green-600">
              Finish Interview <Award size={20} className="ml-2"/>
            </Button>
          ) : (
            <Button onClick={onNextQuestion} size="lg">
              Next Question <SkipForward size={20} className="ml-2"/>
            </Button>
          )}
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
