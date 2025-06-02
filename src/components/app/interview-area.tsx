
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send, SkipForward, RefreshCcw, Lightbulb, CheckCircle, XCircle, Target, Award, Mic, MicOff, Play, Square, Video, VideoOff, Eye } from 'lucide-react';
import type { EvaluateAnswerOutput } from '@/ai/flows/evaluate-answer';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';

type InterviewAreaProps = {
  question: string;
  questionNumber: number;
  totalQuestions: number;
  onSubmitAnswer: (answer: string) => Promise<void>;
  onSkipQuestion: () => void;
  onRegenerateQuestion: () => void;
  onGetModelAnswer: () => Promise<void>;
  onNextQuestion: () => void;
  onFinishInterview: () => void;
  isLoadingEvaluation: boolean;
  isLoadingModelAnswer: boolean;
  isLoadingNewQuestion: boolean;
  evaluationResult: EvaluateAnswerOutput | null;
  modelAnswerText: string | null;
  isLastQuestion: boolean;
};

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
  modelAnswerText,
  isLastQuestion,
}: InterviewAreaProps) {
  const [answer, setAnswer] = useState('');
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [timer, setTimer] = useState<number | null>(null); 
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Speech Recognition (Input) & Synthesis (Output)
  const [isSpeechToTextRecording, setIsSpeechToTextRecording] = useState(false);
  const [speechApiSupported, setSpeechApiSupported] = useState(true);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  
  const [isSpeakingModelAnswer, setIsSpeakingModelAnswer] = useState(false);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] = useState(true);

  // Video Recording
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [isVideoRecordingActive, setIsVideoRecordingActive] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const { toast } = useToast();

  // Effect for camera/mic permissions and stream setup
  useEffect(() => {
    const getCameraAndMicPermission = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'Camera/Microphone access is not supported by your browser.' });
        setHasCameraPermission(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setVideoStream(stream);
        setHasCameraPermission(true);
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera/microphone:', error);
        setHasCameraPermission(false);
        // Don't toast immediately, let user try to enable it. Show alert instead.
      }
    };

    getCameraAndMicPermission();

    return () => { // Cleanup when component unmounts
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Effect for resetting state on new question
  useEffect(() => {
    setAnswer('');
    setShowEvaluation(false);
    setShowModelAnswer(false);
    setIsSpeakingModelAnswer(false);
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    if (timer) setTimeLeft(timer);

    // Stop recordings if active
    if (speechRecognitionRef.current && isSpeechToTextRecording) {
      speechRecognitionRef.current.stop();
      setIsSpeechToTextRecording(false);
    }
    if (mediaRecorderRef.current && isVideoRecordingActive) {
      mediaRecorderRef.current.stop(); // This will trigger onstop, which sets isVideoRecordingActive to false
    }
    // Clean up old video URL
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }
    recordedChunksRef.current = [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, timer]); // isSpeechToTextRecording, isVideoRecordingActive, recordedVideoUrl are managed internally

  // Effect for timer
  useEffect(() => {
    if (!timer || timeLeft <= 0 || showEvaluation) return;
    const intervalId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timer, timeLeft, showEvaluation]);

  // Effect for Speech Recognition (Input) Setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechApiSupported(false);
    } else {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => setIsSpeechToTextRecording(true);

      recognition.onresult = (event) => {
        let newTranscriptPart = "";
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) { 
                newTranscriptPart += event.results[i][0].transcript.trim() + " ";
            }
        }
        if (newTranscriptPart) {
            setAnswer(prev => (prev ? prev.trim() + ' ' : '') + newTranscriptPart.trim());
        }
      };

      recognition.onerror = (event) => {
        setIsSpeechToTextRecording(false);
        let errorMessage = "Speech recognition error.";
        if (event.error === 'no-speech') errorMessage = "No speech detected.";
        else if (event.error === 'audio-capture') errorMessage = "Microphone problem.";
        else if (event.error === 'not-allowed') errorMessage = "Microphone access denied for speech.";
        else if (event.error === 'network') errorMessage = "Network error during speech recognition.";
        toast({ title: "Voice Input Error", description: errorMessage, variant: "destructive" });
      };

      recognition.onend = () => setIsSpeechToTextRecording(false);
      speechRecognitionRef.current = recognition;
    }

    if (!('speechSynthesis' in window)) {
      setSpeechSynthesisSupported(false);
    }
    
    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
        speechRecognitionRef.current.onstart = null;
        speechRecognitionRef.current.onresult = null;
        speechRecognitionRef.current.onerror = null;
        speechRecognitionRef.current.onend = null;
      }
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  }, [toast]);

  const startFullRecording = () => {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.start();
        //setIsSpeechToTextRecording(true); // onstart will set this
      } catch (e) {
        toast({ title: "Speech Error", description: "Could not start voice input.", variant: "destructive" });
        setIsSpeechToTextRecording(false); // Ensure it's false if start fails
      }
    }
    if (hasCameraPermission && videoStream && !isVideoRecordingActive) {
      recordedChunksRef.current = []; // Clear previous chunks
      mediaRecorderRef.current = new MediaRecorder(videoStream, { mimeType: 'video/webm' });
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(videoBlob);
        setRecordedVideoUrl(url);
        setIsVideoRecordingActive(false); 
        recordedChunksRef.current = []; // Clear for next recording
      };
      
      mediaRecorderRef.current.start();
      setIsVideoRecordingActive(true);
      toast({ title: "Recording Started", description: "Video and audio recording in progress. Click mic to stop."});
    } else if (!hasCameraPermission && speechRecognitionRef.current) {
        toast({ title: "Voice Recording Started", description: "Click mic to stop. Enable camera for video."});
    } else if (!speechRecognitionRef.current && hasCameraPermission) {
        // This case shouldn't happen if button is disabled, but as a fallback
        toast({ title: "Video Recording Started (No Speech)", description: "Click mic to stop."});
    }
  };

  const stopFullRecording = () => {
    if (speechRecognitionRef.current && isSpeechToTextRecording) {
      speechRecognitionRef.current.stop();
      // setIsSpeechToTextRecording(false); // onend will set this
    }
    if (mediaRecorderRef.current && isVideoRecordingActive) {
      mediaRecorderRef.current.stop(); // onstop will set isVideoRecordingActive to false and create URL
      toast({ title: "Recording Stopped", description: "Video and audio saved for review."});
    } else {
      toast({ title: "Recording Stopped" });
    }
  };

  const toggleRecording = () => {
    if (isSpeechToTextRecording || isVideoRecordingActive) {
      stopFullRecording();
    } else {
      if (!speechApiSupported) {
         toast({ title: "Voice Input Not Supported", description: "Speech recognition is not available on this browser.", variant: "destructive"});
         return;
      }
       if (hasCameraPermission === false && !speechApiSupported){
         toast({ title: "Permissions Needed", description: "Camera and Microphone access required for full experience.", variant: "destructive"});
         return;
       }
       // Clear previous recording URL if user re-records before submitting
       if (recordedVideoUrl) {
          URL.revokeObjectURL(recordedVideoUrl);
          setRecordedVideoUrl(null);
       }
      startFullRecording();
    }
  };

  const handleSubmit = async () => {
    if (isLoadingEvaluation || isSpeechToTextRecording || isVideoRecordingActive) return;
    // Ensure recordings are stopped if for some reason they weren't
    if (isSpeechToTextRecording) speechRecognitionRef.current?.stop();
    if (isVideoRecordingActive) mediaRecorderRef.current?.stop();

    await onSubmitAnswer(answer);
    setShowEvaluation(true);
  };

  const handleGetModel = async () => {
    if (isLoadingModelAnswer || isSpeechToTextRecording || isVideoRecordingActive) return;
    if (window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel(); 
      setIsSpeakingModelAnswer(false);
    }
    await onGetModelAnswer();
    setShowModelAnswer(true);
  }

  const handleSpeakModelAnswer = () => {
    if (!speechSynthesisSupported || !modelAnswerText) {
      toast({ title: "Speech Output Not Supported", description: "Text-to-speech is not available.", variant: "destructive"});
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeakingModelAnswer(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(modelAnswerText);
      utterance.lang = 'en-US';
      utterance.onstart = () => setIsSpeakingModelAnswer(true);
      utterance.onend = () => setIsSpeakingModelAnswer(false);
      utterance.onerror = (event) => {
        setIsSpeakingModelAnswer(false);
        toast({ title: "Speech Error", description: `Could not play audio: ${event.error}`, variant: "destructive"});
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const progressPercentage = (questionNumber / totalQuestions) * 100;
  const isAnyRecordingActive = isSpeechToTextRecording || isVideoRecordingActive;

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-2xl font-semibold text-primary">Question {questionNumber} of {totalQuestions}</CardTitle>
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

        {hasCameraPermission === null && (
          <CardContent>
            <Alert>
              <Video className="h-5 w-5" />
              <AlertTitle>Camera Access</AlertTitle>
              <AlertDescription>Attempting to access your camera and microphone...</AlertDescription>
            </Alert>
          </CardContent>
        )}

        {hasCameraPermission === false && (
           <CardContent>
            <Alert variant="destructive">
              <VideoOff className="h-5 w-5" />
              <AlertTitle>Camera/Microphone Access Denied</AlertTitle>
              <AlertDescription>
                Video recording features are disabled. Please enable camera and microphone permissions in your browser settings to use this feature. You can still use text input.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
        
        {hasCameraPermission && (
          <CardContent>
            <video ref={videoPreviewRef} muted autoPlay playsInline className="w-full aspect-video rounded-md bg-muted border shadow-inner" />
             {isVideoRecordingActive && (
                <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded-full text-xs flex items-center">
                    <Mic size={14} className="mr-1 animate-pulse" /> REC
                </div>
            )}
          </CardContent>
        )}

        {!showEvaluation && !isLoadingNewQuestion && (
          <>
            <CardContent>
              <Textarea
                placeholder="Type or use microphone to record your answer..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={6}
                className="text-base border-2 focus:border-primary transition-colors"
                disabled={isLoadingEvaluation || isLoadingNewQuestion || isAnyRecordingActive}
              />
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2">
              <div className="flex gap-2 w-full sm:w-auto">
                <Button onClick={onRegenerateQuestion} variant="outline" disabled={isLoadingEvaluation || isLoadingNewQuestion || isAnyRecordingActive}>
                  <RefreshCcw size={18} className="mr-2" /> Regenerate
                </Button>
                <Button onClick={onSkipQuestion} variant="outline" disabled={isLoadingEvaluation || isLoadingNewQuestion || isAnyRecordingActive}>
                  <SkipForward size={18} className="mr-2" /> Skip
                </Button>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  onClick={toggleRecording} 
                  variant={isAnyRecordingActive ? "destructive" : "outline"}
                  size="icon"
                  disabled={(!speechApiSupported && !hasCameraPermission) || isLoadingEvaluation || isLoadingNewQuestion }
                  aria-label={isAnyRecordingActive ? "Stop recording" : "Start voice and video input"}
                  className={isAnyRecordingActive ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                >
                  {isAnyRecordingActive ? <MicOff size={20} /> : <Mic size={20} />}
                </Button>
                <Button onClick={handleSubmit} disabled={!answer.trim() || isLoadingEvaluation || isLoadingNewQuestion || isAnyRecordingActive} className="flex-grow sm:flex-grow-0">
                  {isLoadingEvaluation ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send size={18} className="mr-2" />
                  )}
                  Submit Answer
                </Button>
              </div>
            </CardFooter>
          </>
        )}
      </Card>

      {showEvaluation && evaluationResult && (
        <Card className="shadow-xl animate-in fade-in duration-500">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary">Feedback</CardTitle>
            <Alert variant={evaluationResult.score >= 70 ? "default" : "destructive"} className="mt-2 border-2">
              <Award className={`h-5 w-5 ${evaluationResult.score >=70 ? 'text-green-500': 'text-red-500'}`} />
              <AlertTitle className="text-xl">Your Score: {evaluationResult.score}/100</AlertTitle>
            </Alert>
          </CardHeader>
          <CardContent className="space-y-4">
            {recordedVideoUrl && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center text-foreground"><Eye size={20} className="mr-2 text-primary" />Review Your Recording</h3>
                <video src={recordedVideoUrl} controls className="w-full aspect-video rounded-md border shadow-inner bg-muted"></video>
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold flex items-center text-green-600"><CheckCircle size={20} className="mr-2" />Strengths</h3>
              <p className="text-muted-foreground bg-green-50 p-3 rounded-md border border-green-200">{evaluationResult.strengths}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold flex items-center text-red-600"><XCircle size={20} className="mr-2" />Areas for Improvement</h3>
              <p className="text-muted-foreground bg-red-50 p-3 rounded-md border border-red-200">{evaluationResult.weaknesses}</p>
            </div>
            
            {!modelAnswerText && (
              <Button onClick={handleGetModel} variant="outline" className="w-full sm:w-auto border-accent text-accent-foreground hover:bg-accent/10" disabled={isLoadingModelAnswer || isAnyRecordingActive}>
                {isLoadingModelAnswer ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lightbulb size={18} className="mr-2" />
                )}
                Show Model Answer
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {showModelAnswer && modelAnswerText && (
         <Card className="shadow-xl animate-in fade-in duration-500 mt-4">
           <CardHeader className="flex flex-row justify-between items-center">
             <CardTitle className="text-xl font-semibold flex items-center text-indigo-600"><Target size={20} className="mr-2" />Model Answer</CardTitle>
             <Button 
                onClick={handleSpeakModelAnswer}
                variant="outline" 
                size="icon"
                disabled={!speechSynthesisSupported || isLoadingModelAnswer || isAnyRecordingActive}
                aria-label={isSpeakingModelAnswer ? "Stop speaking" : "Speak model answer"}
                className={isSpeakingModelAnswer ? "border-destructive text-destructive" : "border-primary text-primary"}
              >
                {isSpeakingModelAnswer ? <Square size={20} /> : <Play size={20} />}
              </Button>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground bg-indigo-50 p-3 rounded-md border border-indigo-200">{modelAnswerText}</p>
           </CardContent>
         </Card>
      )}
      
      {showEvaluation && (
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
  );
}
    