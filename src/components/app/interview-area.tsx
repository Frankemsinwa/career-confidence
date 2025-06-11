
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
// Textarea is visually hidden but its state `answer` is used.
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send, SkipForward, RefreshCcw, Lightbulb, CheckCircle, Mic, MicOff, Play, Square, Target, Award, BarChartHorizontal, Disc3, AlertCircle } from 'lucide-react';
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
  onSubmitAnswer: (answer: string, voiceRecordingDuration: number) => Promise<void>;
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
  const [answer, setAnswer] = useState('');
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const [isSpeakingModelAnswer, setIsSpeakingModelAnswer] = useState(false);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] = useState(true);

  const [voiceRecordingStartTime, setVoiceRecordingStartTime] = useState<number | null>(null);
  const [voiceRecordingDurationSeconds, setVoiceRecordingDurationSeconds] = useState<number>(0);

  const { toast } = useToast();

  useEffect(() => {
    setAnswer('');
    setShowEvaluation(false);
    setShowModelAnswer(false);
    setIsSpeakingModelAnswer(false);
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    if (isRecording && mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setVoiceRecordingStartTime(null);
    setVoiceRecordingDurationSeconds(0);
    setIsRecording(false);
    setIsTranscribing(false);
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]); 

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    if (!('speechSynthesis' in window)) {
      console.warn("SpeechSynthesis API not supported by this browser.");
      setSpeechSynthesisSupported(false);
    } else {
      setSpeechSynthesisSupported(true);
    }
    
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 


  const toggleRecording = async () => {
    if (isTranscribing) {
      toast({ title: "Busy", description: "Please wait for transcription to complete.", variant: "default" });
      return;
    }

    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop(); // onstop will handle the rest
      }
      setIsRecording(false); 
      // Duration is set in onstop
    } else {
      // Start recording
      setAnswer(''); // Clear previous answer
      setVoiceRecordingDurationSeconds(0);
      audioChunksRef.current = [];

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorderRef.current.onstart = () => {
          setIsRecording(true);
          setVoiceRecordingStartTime(Date.now());
          toast({ title: "Recording Started", description: "Speak your answer. Click mic again to stop."});
        };
        
        mediaRecorderRef.current.onstop = async () => {
          setIsRecording(false); // Explicitly set here too
          setIsTranscribing(true);
          toast({ title: "Recording Stopped", description: "Transcribing your answer..." });

          if (voiceRecordingStartTime) {
            const duration = Math.round((Date.now() - voiceRecordingStartTime) / 1000);
            setVoiceRecordingDurationSeconds(duration);
          }
          setVoiceRecordingStartTime(null);

          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');

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
            setAnswer(result.transcript);
            toast({ title: "Transcription Complete!", description: "Your answer is ready to submit."});
          } catch (error) {
            console.error("Transcription API error:", error);
            const message = error instanceof Error ? error.message : "Unknown transcription error.";
            toast({ title: "Transcription Failed", description: message, variant: "destructive", duration: 7000 });
            setAnswer(''); // Clear answer if transcription failed
          } finally {
            setIsTranscribing(false);
            // Clean up the stream tracks
            stream.getTracks().forEach(track => track.stop());
          }
        };

        mediaRecorderRef.current.start();
      } catch (err) {
        console.error("Error accessing microphone or starting MediaRecorder:", err);
        const message = err instanceof Error ? err.message : "Could not start recording.";
        toast({ title: "Recording Error", description: `Failed to start audio recording: ${message}`, variant: "destructive", duration: 7000 });
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
    if (!answer.trim()) {
        toast({title: "No Answer Transcribed", description: "Please record your answer using the microphone first. The transcribed text is empty.", variant: "default"});
        return;
    }
    
    await onSubmitAnswer(answer, voiceRecordingDurationSeconds); 
    setShowEvaluation(true);
  };

  const handleGetModel = async () => {
    if (isLoadingModelAnswer || isRecording || isTranscribing) return;

    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel(); 
      setIsSpeakingModelAnswer(false);
    }
    await onGetModelAnswer();
    setShowModelAnswer(true);
  }

  const handleSpeakModelAnswer = () => {
    if (typeof window === 'undefined' || !speechSynthesisSupported || !modelAnswerText) {
      toast({ title: "Speech Output Not Available", description: "Text-to-speech is not available or not supported by your browser.", variant: "destructive"});
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
        console.error("SpeechSynthesis error:", event);
        setIsSpeakingModelAnswer(false);
        toast({ title: "Speech Error", description: `Could not play audio: ${event.error}`, variant: "destructive"});
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const progressPercentage = (questionNumber / totalQuestions) * 100;
  
  const getTimeManagementFeedback = () => {
    if (!evaluationResult || voiceRecordingDurationSeconds <= 0) return null;
    if (voiceRecordingDurationSeconds < EXPECTED_ANSWER_TIME_SECONDS * 0.75) {
      return `Your answer was quite brief (${voiceRecordingDurationSeconds}s). Consider elaborating more. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
    } else if (voiceRecordingDurationSeconds > EXPECTED_ANSWER_TIME_SECONDS * 1.25) {
      return `Your answer was a bit long (${voiceRecordingDurationSeconds}s). Try to be more concise. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
    }
    return `Your answer duration (${voiceRecordingDurationSeconds}s) was good. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
  };
  const timeFeedback = getTimeManagementFeedback();

  const recordButtonDisabled = isLoadingEvaluation || isLoadingNewQuestion || isTranscribing;
  const submitButtonDisabled = !answer.trim() || isLoadingEvaluation || isLoadingNewQuestion || isRecording || isTranscribing;

  return (
    <TooltipProvider>
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
        
        <CardContent className="relative">
          {isRecording && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm flex items-center shadow-lg animate-pulse z-10">
                  <Mic size={16} className="mr-2" /> RECORDING VOICE
              </div>
          )}
           {isTranscribing && (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-full text-sm flex items-center shadow-lg animate-pulse z-10">
                  <Loader2 size={16} className="mr-2 animate-spin" /> TRANSCRIBING...
              </div>
          )}
          {/* Textarea is hidden, but its state `answer` is used */}
          <textarea
            value={answer}
            readOnly 
            rows={3}
            className="hidden" 
            aria-hidden="true"
          />
        </CardContent>

        {!showEvaluation && !isLoadingNewQuestion && (
          <>
            <CardContent>
              {(!isRecording && !isTranscribing && !answer.trim()) && (
                <div className="text-center text-muted-foreground py-4">
                  Click the microphone below to start recording your answer.
                </div>
              )}
              {(!isRecording && !isTranscribing && answer.trim()) && (
                 <div className="text-center text-green-600 py-4 flex items-center justify-center">
                  <CheckCircle size={20} className="mr-2"/> Answer recorded. Ready to submit.
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2">
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
                      aria-label={isRecording ? "Stop recording" : "Start recording answer"}
                      className={`${isRecording ? "bg-blue-500 hover:bg-blue-600 text-white" : ""} py-3 px-6 rounded-full`}
                    >
                      {isRecording ? <MicOff size={24} /> : <Mic size={24} />}
                      <span className="ml-2 text-base">{isRecording ? "Stop Recording" : (isTranscribing ? "Processing..." : "Record Answer")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isRecording ? "Stop recording" : (isTranscribing ? "Processing audio..." : "Start recording answer")}</p>
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
          </>
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
               <Disc3 className={`h-5 w-5 ${evaluationResult.score >=70 ? 'text-green-500': 'text-red-500'}`} />
              <AlertTitle className="text-xl">Your Score: {evaluationResult.score}/100</AlertTitle>
            </Alert>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center text-green-600"><CheckCircle size={20} className="mr-2" />Strengths</h3>
              <p className="text-muted-foreground bg-green-50 p-3 rounded-md border border-green-200">{evaluationResult.strengths}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold flex items-center text-red-600"><XCircle size={20} className="mr-2" />Areas for Improvement</h3>
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
                    <p><strong className="font-medium">Filler Words:</strong> {communicationAnalysisResult.fillerWordsFound.join(', ')}</p>
                  )}
                  {timeFeedback && <p><strong className="font-medium">Time Management (Voice Duration):</strong> {timeFeedback}</p>}
                </div>
              </div>
            )}
             {!answer.trim() && communicationAnalysisResult?.speakingPaceWPM === 0 && (
                <Alert variant="destructive" className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Note on Analysis</AlertTitle>
                  <AlertDescription>
                    Since no text was transcribed from your recording, text-based communication analysis (clarity, confidence from text, filler words, speaking pace) could not be performed or will be based on empty input. The duration of your recording was still captured.
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
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleSpeakModelAnswer}
                    variant="outline" 
                    size="icon"
                    disabled={!speechSynthesisSupported || isLoadingModelAnswer || isRecording || isTranscribing}
                    aria-label={isSpeakingModelAnswer ? "Stop speaking" : "Speak model answer"}
                    className={isSpeakingModelAnswer ? "border-destructive text-destructive" : "border-primary text-primary"}
                  >
                    {isSpeakingModelAnswer ? <Square size={20} /> : <Play size={20} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{!speechSynthesisSupported ? "Speech synthesis not supported by browser" : (isSpeakingModelAnswer ? "Stop speaking model answer" : "Speak model answer aloud")}</p>
                </TooltipContent>
              </Tooltip>
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
