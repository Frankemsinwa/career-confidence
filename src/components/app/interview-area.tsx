
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send, SkipForward, RefreshCcw, Lightbulb, CheckCircle, XCircle, Target, Award, Mic, MicOff, Play, Square, Info, BarChartHorizontal, Disc3 } from 'lucide-react';
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

const EXPECTED_ANSWER_TIME_SECONDS = 120; // Can be used for voice duration feedback

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
  
  const [isSpeechToTextRecording, setIsSpeechToTextRecording] = useState(false);
  const [speechApiSupported, setSpeechApiSupported] = useState(true);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  
  const [isSpeakingModelAnswer, setIsSpeakingModelAnswer] = useState(false);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] = useState(true);

  const [voiceRecordingStartTime, setVoiceRecordingStartTime] = useState<number | null>(null);
  const [voiceRecordingDurationSeconds, setVoiceRecordingDurationSeconds] = useState<number>(0);

  const { toast } = useToast();

  useEffect(() => {
    // Reset states when question changes
    setAnswer('');
    setShowEvaluation(false);
    setShowModelAnswer(false);
    setIsSpeakingModelAnswer(false);
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    
    if (isSpeechToTextRecording) {
        console.log("Question changed: Stopping active speech recognition.");
        speechRecognitionRef.current?.stop();
        setIsSpeechToTextRecording(false); // Ensure state is reset
    }
    setVoiceRecordingStartTime(null);
    setVoiceRecordingDurationSeconds(0);
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]); 

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.warn("SpeechRecognition API not supported by this browser.");
      setSpeechApiSupported(false);
      return; 
    }
    setSpeechApiSupported(true);
    
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true; 
    recognition.interimResults = false; 
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        console.log("SpeechRecognition: onstart fired.");
        setIsSpeechToTextRecording(true);
        setVoiceRecordingStartTime(Date.now());
        setVoiceRecordingDurationSeconds(0);
    };

    recognition.onresult = (event) => {
      console.log("SpeechRecognition: onresult fired.", event.results);
      let newTranscriptPart = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) { 
              newTranscriptPart += event.results[i][0].transcript.trim() + " ";
          }
      }
      if (newTranscriptPart.trim()) {
          console.log("SpeechRecognition: Transcript part:", newTranscriptPart);
          setAnswer(prev => (prev ? prev.trim() + ' ' : '') + newTranscriptPart.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error("SpeechRecognition: onerror fired.", event.error, event.message);
      setIsSpeechToTextRecording(false); 
      if (voiceRecordingStartTime) {
        const duration = Math.round((Date.now() - voiceRecordingStartTime) / 1000);
        setVoiceRecordingDurationSeconds(duration);
      }
      setVoiceRecordingStartTime(null);

      let errorMessage = `Speech recognition error: ${event.error}.`;
      if (event.message) errorMessage += ` Message: ${event.message}`;

      if (event.error === 'no-speech') {
        errorMessage = "No speech was detected. Please ensure your microphone is unmuted, the volume is adequate, you're speaking clearly, and there isn't excessive background noise. Also, try closing other applications that might be using the microphone.";
      } else if (event.error === 'audio-capture') {
        errorMessage = "Audio capture failed. Ensure your microphone is properly connected, configured in your OS, and not being used exclusively by another application. You may need to re-grant microphone permissions.";
      } else if (event.error === 'not-allowed') {
        errorMessage = "Microphone access was denied or disallowed by the browser or OS. Please check permissions in your browser settings for this site and ensure your OS allows microphone access for this browser. You might need to refresh the page after granting permissions.";
      } else if (event.error === 'network') {
        errorMessage = "A network error occurred during speech recognition. Please check your internet connection as some speech services rely on it.";
      } else if (event.error === 'aborted') {
        errorMessage = "Speech recognition was aborted. This might happen if you navigate away or if another action interrupted it. Please try again.";
      } else if (event.error === 'service-not-allowed') {
        errorMessage = "The speech recognition service is not allowed or unavailable. This could be due to browser/OS settings, policy restrictions, or a temporary service issue."
      }
      toast({ title: "Voice Input Error", description: errorMessage, variant: "destructive", duration: 10000 });
    };

    recognition.onend = () => {
      console.log("SpeechRecognition: onend fired.");
      setIsSpeechToTextRecording(false);
      if (voiceRecordingStartTime) {
        const duration = Math.round((Date.now() - voiceRecordingStartTime) / 1000);
        setVoiceRecordingDurationSeconds(duration);
        console.log(`Voice input duration: ${duration}s`);
      }
      setVoiceRecordingStartTime(null);
    };
    speechRecognitionRef.current = recognition;
    
    if (!('speechSynthesis' in window)) {
      console.warn("SpeechSynthesis API not supported by this browser.");
      setSpeechSynthesisSupported(false);
    } else {
      setSpeechSynthesisSupported(true);
    }
    
    return () => {
      if (speechRecognitionRef.current) {
        console.log("Cleaning up SpeechRecognition instance.");
        speechRecognitionRef.current.abort(); 
      }
      if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); 


  const toggleVoiceInput = () => {
    if (!speechRecognitionRef.current || !speechApiSupported) {
      toast({ title: "Voice Input Unavailable", description: "Speech recognition is not supported or not initialized.", variant: "destructive"});
      return;
    }

    if (isSpeechToTextRecording) {
      console.log("Stopping SpeechRecognition (voice input).");
      speechRecognitionRef.current.stop(); // This will trigger onend, which sets isSpeechToTextRecording to false and calculates duration.
      toast({ title: "Voice Input Stopped"});
    } else {
      console.log("Attempting to start SpeechRecognition (voice input).");
      try {
        setAnswer(''); // Clear previous text for new voice input
        speechRecognitionRef.current.start(); // This will trigger onstart.
        toast({ title: "Voice Input Active", description: "Speak into your microphone. Click mic again to stop."});
      } catch (e: any) {
        console.error("Error starting speech recognition (voice input):", e);
        toast({ title: "Speech Error", description: `Could not start voice input: ${e.message || e.name || 'Unknown error'}.`, variant: "destructive" });
        setIsSpeechToTextRecording(false); 
        setVoiceRecordingStartTime(null);
      }
    }
  };

  const handleSubmit = async () => {
    if (isLoadingEvaluation || isSpeechToTextRecording) {
      let busyReason = isLoadingEvaluation ? "current analysis to finish" : "voice input to finish";
      console.log("Submit attempt while busy, returning.");
      toast({title: "Busy", description: `Please wait for ${busyReason} before submitting.`, variant: "default"});
      return;
    }
    if (!answer.trim()) {
        toast({title: "No Answer Text", description: "Please provide an answer (type or use voice recording).", variant: "default"});
        return;
    }
    
    console.log("Submitting answer. Text:", answer, "Voice Duration:", voiceRecordingDurationSeconds);
    await onSubmitAnswer(answer, voiceRecordingDurationSeconds); 
    setShowEvaluation(true);
  };

  const handleGetModel = async () => {
    if (isLoadingModelAnswer || isSpeechToTextRecording) return;

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

  const voiceInputButtonDisabled = !speechApiSupported || isLoadingEvaluation || isLoadingNewQuestion;
  const submitButtonDisabled = !answer.trim() || isLoadingEvaluation || isLoadingNewQuestion || isSpeechToTextRecording;

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
          {isSpeechToTextRecording && (
              <div className="absolute top-0 left-3 bg-blue-600 text-white px-3 py-1 rounded-full text-xs flex items-center shadow-lg animate-pulse z-10">
                  <Mic size={14} className="mr-1.5" /> REC Voice
              </div>
          )}
        </CardContent>

        {!showEvaluation && !isLoadingNewQuestion && (
          <>
            <CardContent>
              <Textarea
                placeholder="Type or use microphone to record your answer..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={6}
                className="text-base border-2 focus:border-primary transition-colors"
                disabled={isLoadingEvaluation || isLoadingNewQuestion || isSpeechToTextRecording}
              />
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2">
              <div className="flex gap-2 w-full sm:w-auto">
                <Button onClick={onRegenerateQuestion} variant="outline" disabled={isLoadingEvaluation || isLoadingNewQuestion || isSpeechToTextRecording}>
                  <RefreshCcw size={18} /> Regenerate
                </Button>
                <Button onClick={onSkipQuestion} variant="outline" disabled={isLoadingEvaluation || isLoadingNewQuestion || isSpeechToTextRecording}>
                  <SkipForward size={18} /> Skip
                </Button>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                     <Button 
                      onClick={toggleVoiceInput} 
                      variant={isSpeechToTextRecording ? "destructive" : "outline"}
                      size="icon"
                      disabled={voiceInputButtonDisabled}
                      aria-label={isSpeechToTextRecording ? "Stop voice input" : "Start voice input"}
                      className={isSpeechToTextRecording ? "bg-blue-500 hover:bg-blue-600 text-white" : ""}
                    >
                      {isSpeechToTextRecording ? <MicOff size={20} /> : <Mic size={20} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{!speechApiSupported ? "Voice input not supported" : (isSpeechToTextRecording ? "Stop voice input" : "Start voice input (for text answer)")}</p>
                  </TooltipContent>
                </Tooltip>
                
                <Button onClick={handleSubmit} disabled={submitButtonDisabled} className="flex-grow sm:flex-grow-0">
                  {isLoadingEvaluation ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                  Submit Answer
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
            
            {!modelAnswerText && (
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleGetModel} variant="outline" className="w-full sm:w-auto border-accent text-accent-foreground hover:bg-accent/10 mt-2" disabled={isLoadingModelAnswer || isSpeechToTextRecording}>
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
                    disabled={!speechSynthesisSupported || isLoadingModelAnswer || isSpeechToTextRecording}
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
