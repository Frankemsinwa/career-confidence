
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send, SkipForward, RefreshCcw, Lightbulb, CheckCircle, XCircle, Target, Award, Mic, MicOff } from 'lucide-react';
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
  const [timer, setTimer] = useState<number | null>(null); // Optional timer in seconds
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const [isRecording, setIsRecording] = useState(false);
  const [speechApiSupported, setSpeechApiSupported] = useState(true);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setAnswer('');
    setShowEvaluation(false);
    setShowModelAnswer(false);
    if (timer) setTimeLeft(timer);
    // Stop recording if a new question loads
    if (speechRecognitionRef.current && isRecording) {
      speechRecognitionRef.current.stop();
      setIsRecording(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, timer]);

  useEffect(() => {
    if (!timer || timeLeft <= 0 || showEvaluation) return;
    const intervalId = setInterval(() => {
      setTimeLeft((prevTime) => prevTime - 1);
    }, 1000);
    return () => clearInterval(intervalId);
  }, [timer, timeLeft, showEvaluation]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechApiSupported(false);
      toast({
        title: "Voice Input Not Supported",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive"
      });
    } else {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsRecording(true);
        toast({ title: "Listening...", description: "Speak your answer now."});
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setAnswer(prev => (prev ? prev.trim() + ' ' : '') + transcript);
      };

      recognition.onerror = (event) => {
        setIsRecording(false);
        let errorMessage = "Speech recognition error.";
        if (event.error === 'no-speech') {
          errorMessage = "No speech was detected. Please try again.";
        } else if (event.error === 'audio-capture') {
          errorMessage = "Microphone problem. Please ensure it's working.";
        } else if (event.error === 'not-allowed') {
          errorMessage = "Microphone access denied. Please enable it in your browser settings.";
        }
        toast({ title: "Voice Input Error", description: errorMessage, variant: "destructive" });
      };

      recognition.onend = () => {
        setIsRecording(false);
      };
      speechRecognitionRef.current = recognition;
    }
    
    return () => {
      if (speechRecognitionRef.current) {
        speechRecognitionRef.current.stop();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const handleSubmit = async () => {
    if (isLoadingEvaluation || isRecording) return;
    if (speechRecognitionRef.current && isRecording) {
      speechRecognitionRef.current.stop(); // Stop recording if active
    }
    await onSubmitAnswer(answer);
    setShowEvaluation(true);
  };

  const handleGetModel = async () => {
    if (isLoadingModelAnswer || isRecording) return;
    await onGetModelAnswer();
    setShowModelAnswer(true);
  }

  const toggleVoiceInput = () => {
    if (!speechApiSupported || !speechRecognitionRef.current) {
      toast({ title: "Voice Input Not Supported", description: "Speech recognition is not available on this browser.", variant: "destructive"});
      return;
    }
    if (isRecording) {
      speechRecognitionRef.current.stop();
    } else {
      // Check for permissions before starting. The 'not-allowed' error will be caught by onerror.
      // Modern browsers handle permissions transparently when .start() is called.
      try {
        speechRecognitionRef.current.start();
      } catch (e) {
          setIsRecording(false);
          toast({ title: "Could not start voice input", description: "Please ensure microphone permissions are granted and try again.", variant: "destructive"});
          console.error("Error starting speech recognition:", e);
      }
    }
  };

  const progressPercentage = (questionNumber / totalQuestions) * 100;

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-2xl font-semibold text-primary">Question {questionNumber} of {totalQuestions}</CardTitle>
            {/* Timer display - Optional
            {timer && <div className={`text-lg font-semibold px-3 py-1 rounded-md ${timeLeft <= 10 ? 'text-destructive' : 'text-foreground'}`}>{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</div>}
            */}
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
        {!showEvaluation && !isLoadingNewQuestion && (
          <CardContent>
            <Textarea
              placeholder="Type or use microphone to record your answer..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={6}
              className="text-base border-2 focus:border-primary transition-colors"
              disabled={isLoadingEvaluation || isLoadingNewQuestion }
            />
          </CardContent>
        )}
        {!showEvaluation && !isLoadingNewQuestion && (
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2">
            <div className="flex gap-2 w-full sm:w-auto">
              <Button onClick={onRegenerateQuestion} variant="outline" disabled={isLoadingEvaluation || isLoadingNewQuestion || isRecording}>
                <RefreshCcw size={18} className="mr-2" /> Regenerate
              </Button>
              <Button onClick={onSkipQuestion} variant="outline" disabled={isLoadingEvaluation || isLoadingNewQuestion || isRecording}>
                <SkipForward size={18} className="mr-2" /> Skip
              </Button>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button 
                onClick={toggleVoiceInput} 
                variant={isRecording ? "destructive" : "outline"}
                size="icon"
                disabled={!speechApiSupported || isLoadingEvaluation || isLoadingNewQuestion}
                aria-label={isRecording ? "Stop recording" : "Start voice input"}
                className={isRecording ? "bg-red-500 hover:bg-red-600 text-white" : ""}
              >
                {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
              </Button>
              <Button onClick={handleSubmit} disabled={!answer.trim() || isLoadingEvaluation || isLoadingNewQuestion || isRecording} className="flex-grow sm:flex-grow-0">
                {isLoadingEvaluation ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send size={18} className="mr-2" />
                )}
                Submit Answer
              </Button>
            </div>
          </CardFooter>
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
            <div>
              <h3 className="text-lg font-semibold flex items-center text-green-600"><CheckCircle size={20} className="mr-2" />Strengths</h3>
              <p className="text-muted-foreground bg-green-50 p-3 rounded-md border border-green-200">{evaluationResult.strengths}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold flex items-center text-red-600"><XCircle size={20} className="mr-2" />Areas for Improvement</h3>
              <p className="text-muted-foreground bg-red-50 p-3 rounded-md border border-red-200">{evaluationResult.weaknesses}</p>
            </div>
            
            {!modelAnswerText && (
              <Button onClick={handleGetModel} variant="outline" className="w-full sm:w-auto border-accent text-accent-foreground hover:bg-accent/10" disabled={isLoadingModelAnswer}>
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
           <CardHeader>
             <CardTitle className="text-xl font-semibold flex items-center text-indigo-600"><Target size={20} className="mr-2" />Model Answer</CardTitle>
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

    