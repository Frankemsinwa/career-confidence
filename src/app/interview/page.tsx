
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import InterviewSetupForm from '@/components/app/interview-setup-form';
import InterviewArea from '@/components/app/interview-area';
import ProgressTracker from '@/components/app/progress-tracker';
import { generateInterviewQuestions } from '@/ai/flows/generate-interview-questions';
import type { GenerateInterviewQuestionsInput } from '@/ai/flows/generate-interview-questions';
import { evaluateAnswer } from '@/ai/flows/evaluate-answer';
import type { EvaluateAnswerInput, EvaluateAnswerOutput } from '@/ai/flows/evaluate-answer';
import { provideModelAnswer } from '@/ai/flows/provide-model-answer';
import type { ProvideModelAnswerInput } from '@/ai/flows/provide-model-answer';
import { analyzeCommunication } from '@/ai/flows/analyze-communication-flow';
import type { AnalyzeCommunicationInput, AnalyzeCommunicationOutput } from '@/ai/flows/analyze-communication-flow';
import type { InterviewSettings, StoredAttempt } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import useLocalStorage from '@/hooks/use-local-storage';
import { v4 as uuidv4 } from 'uuid'; 
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, RotateCcw, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useSupabase } from '@/contexts/supabase-auth-context';
import { useRouter } from 'next/navigation';


export default function InterviewPage() {
  const { user, isLoading: isAuthLoading } = useSupabase();
  const router = useRouter();

  // Setup state
  const [currentSettings, setCurrentSettings] = useState<InterviewSettings | null>(null);

  // Interview flow state
  const [isInterviewActive, setIsInterviewActive] = useState<boolean>(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  
  // Feedback state for the current question
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluateAnswerOutput | null>(null);
  const [currentModelAnswer, setCurrentModelAnswer] = useState<string | null>(null);
  const [currentCommunicationAnalysis, setCurrentCommunicationAnalysis] = useState<AnalyzeCommunicationOutput | null>(null);

  // Loading states
  const [isLoadingSetup, setIsLoadingSetup] = useState<boolean>(false);
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState<boolean>(false); 
  const [isLoadingModelAnswer, setIsLoadingModelAnswer] = useState<boolean>(false);
  const [isLoadingNewQuestion, setIsLoadingNewQuestion] = useState<boolean>(false);

  // Progress state
  const [progress, setProgress] = useLocalStorage<StoredAttempt[]>('careerConfidenceProgress', []);

  const { toast } = useToast();

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
    if (!isAuthLoading && !user) {
      router.replace('/');
    }
  }, [user, isAuthLoading, router]);

  if (isAuthLoading || !user) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  const handleStartInterview = async (settings: InterviewSettings) => {
    setIsLoadingSetup(true);
    setCurrentSettings(settings);
    
    // Clear previous interview state
    setGeneratedQuestions([]);
    setCurrentQuestionIndex(0);
    setCurrentEvaluation(null);
    setCurrentModelAnswer(null);
    setCurrentCommunicationAnalysis(null);

    // Check if the user provided their own question
    if (settings.customQuestion && settings.customQuestion.length > 0) {
      setGeneratedQuestions([settings.customQuestion]);
      setIsInterviewActive(true);
      toast({ title: "Interview Started!", description: "Ready to practice your custom question." });
    } else {
      // Otherwise, generate questions with AI
      try {
        const aiInput: GenerateInterviewQuestionsInput = {
          jobRole: settings.jobRole,
          interviewType: settings.interviewType,
          difficultyLevel: settings.difficultyLevel,
          numQuestions: settings.numQuestions,
        };
        const result = await generateInterviewQuestions(aiInput);
        if (result.questions && result.questions.length > 0) {
          setGeneratedQuestions(result.questions);
          setIsInterviewActive(true);
          toast({ title: "Interview Started!", description: `Generated ${result.questions.length} questions for you.` });
        } else {
          toast({ title: "Error", description: "Could not generate questions. Please try again.", variant: "destructive" });
          setCurrentSettings(null); // Go back to setup
        }
      } catch (error) {
        console.error("Error generating questions:", error);
        toast({ title: "Error", description: "Failed to start interview. Check console for details.", variant: "destructive" });
        setCurrentSettings(null); // Go back to setup
      }
    }
    setIsLoadingSetup(false);
  };

  // Method to handle answer submission, now includes optional recordedVideoUrl
  const handleSubmitAnswer = async (answer: string, recordingDuration: number, recordedVideoUrl?: string | null) => {
    if (!currentSettings || generatedQuestions.length === 0) return;
    setIsLoadingEvaluation(true);
    setCurrentEvaluation(null); 
    setCurrentModelAnswer(null);
    setCurrentCommunicationAnalysis(null);
    let evaluationResult: EvaluateAnswerOutput | null = null;
    let communicationResult: AnalyzeCommunicationOutput | null = null;
    
    try {
      // Evaluate main answer content (text)
      const evalInput: EvaluateAnswerInput = {
        question: generatedQuestions[currentQuestionIndex],
        answer: answer,
        jobRole: currentSettings.jobRole,
        difficulty: currentSettings.difficultyLevel,
      };
      evaluationResult = await evaluateAnswer(evalInput);
      setCurrentEvaluation(evaluationResult);
      toast({ title: "Answer Evaluated!", description: `Score: ${evaluationResult.score}/100` });

      // Analyze communication aspects
      if (answer.trim() || recordingDuration > 0) { 
        try {
          const commsInput: AnalyzeCommunicationInput = {
            answerText: answer,
            recordingDurationSeconds: recordingDuration,
            jobRole: currentSettings.jobRole,
            difficulty: currentSettings.difficultyLevel,
          };
          communicationResult = await analyzeCommunication(commsInput);
          setCurrentCommunicationAnalysis(communicationResult);
          toast({ title: "Communication Analyzed!" });
        } catch (commsError) {
           console.error("Error analyzing communication:", commsError);
           toast({ title: "Comms Analysis Error", description: "Failed to analyze communication aspects.", variant: "destructive" });
        }
      } else {
        toast({ title: "Note", description: "No answer text and no recording duration. Communication analysis skipped."});
      }

    } catch (error) {
      console.error("Error during answer submission process:", error);
      toast({ title: "Error", description: "Failed to process answer fully.", variant: "destructive" });
    } finally {
      setIsLoadingEvaluation(false);
      // Save attempt regardless of full success, if core settings are present
      if (currentSettings) {
        const newAttempt: StoredAttempt = {
          id: uuidv4(),
          timestamp: Date.now(),
          question: generatedQuestions[currentQuestionIndex],
          userAnswer: answer,
          evaluation: evaluationResult || { score: 0, strengths: "N/A - Evaluation failed or no text.", weaknesses: "N/A - Evaluation failed or no text.", modelAnswer: "N/A - Evaluation failed or no text." },
          settings: {
            jobRole: currentSettings.jobRole,
            interviewType: currentSettings.interviewType,
            difficultyLevel: currentSettings.difficultyLevel,
          },
          communicationAnalysis: communicationResult ?? undefined,
          recordingDurationSeconds: recordingDuration,
          recordedVideoUrl: recordedVideoUrl ?? undefined,
          practiceMode: recordedVideoUrl ? 'video' : 'audio',
        };
        setProgress(prevProgress => [...prevProgress, newAttempt]);
        if (!evaluationResult && (answer.trim() === "" && recordingDuration > 0)) {
            toast({ title: "Attempt Saved (Partial)", description: "Attempt saved. Evaluation limited due to missing text transcript." });
        } else if (!evaluationResult) {
            toast({ title: "Attempt Saved (Evaluation Error)", description: "Attempt saved, but there was an issue with AI evaluation." });
        }
      }
    }
  };

  const handleGetModelAnswer = async () => {
    if (!currentSettings || generatedQuestions.length === 0) return;
    setIsLoadingModelAnswer(true);
    try {
      const aiInput: ProvideModelAnswerInput = {
        question: generatedQuestions[currentQuestionIndex],
        jobRole: currentSettings.jobRole,
        difficulty: currentSettings.difficultyLevel,
      };
      const result = await provideModelAnswer(aiInput);
      setCurrentModelAnswer(result.modelAnswer);
      toast({ title: "Model Answer Ready!" });
    } catch (error) {
      console.error("Error getting model answer:", error);
      toast({ title: "Error", description: "Failed to get model answer.", variant: "destructive" });
    }
    setIsLoadingModelAnswer(false);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < generatedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setCurrentEvaluation(null);
      setCurrentModelAnswer(null);
      setCurrentCommunicationAnalysis(null);
    } else {
      handleFinishInterview();
    }
  };
  
  const handleSkipQuestion = async () => {
    if (!currentSettings || currentSettings.customQuestion) return;
    setIsLoadingNewQuestion(true);
    setCurrentEvaluation(null);
    setCurrentModelAnswer(null);
    setCurrentCommunicationAnalysis(null);
    try {
      const aiInput: GenerateInterviewQuestionsInput = {
        jobRole: currentSettings.jobRole,
        interviewType: currentSettings.interviewType,
        difficultyLevel: currentSettings.difficultyLevel,
        numQuestions: 1, 
      };
      const result = await generateInterviewQuestions(aiInput);
      if (result.questions && result.questions.length > 0) {
        const newQuestions = [...generatedQuestions];
        newQuestions[currentQuestionIndex] = result.questions[0]; 
        setGeneratedQuestions(newQuestions);
        toast({ title: "Question Skipped", description: "A new question has been generated." });
      } else {
         toast({ title: "Skip Failed", description: "Could not generate a new question. Moving to next if available.", variant: "destructive" });
         if (currentQuestionIndex < generatedQuestions.length - 1) {
            handleNextQuestion();
         } else {
            handleFinishInterview();
         }
      }
    } catch (error) {
      console.error("Error skipping question:", error);
      toast({ title: "Error", description: "Failed to skip question.", variant: "destructive" });
    }
    setIsLoadingNewQuestion(false);
  };

  const handleRegenerateQuestion = async () => {
     if (!currentSettings || currentSettings.customQuestion) return;
    setIsLoadingNewQuestion(true);
    setCurrentEvaluation(null);
    setCurrentModelAnswer(null);
    setCurrentCommunicationAnalysis(null);
    try {
      const aiInput: GenerateInterviewQuestionsInput = {
        jobRole: currentSettings.jobRole,
        interviewType: currentSettings.interviewType,
        difficultyLevel: currentSettings.difficultyLevel,
        numQuestions: 1, 
      };
      const result = await generateInterviewQuestions(aiInput);
      if (result.questions && result.questions.length > 0) {
        const newQuestions = [...generatedQuestions];
        newQuestions[currentQuestionIndex] = result.questions[0]; 
        setGeneratedQuestions(newQuestions);
        toast({ title: "Question Regenerated", description: "A new version of the question is ready." });
      } else {
         toast({ title: "Regeneration Failed", description: "Could not regenerate the question.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error regenerating question:", error);
      toast({ title: "Error", description: "Failed to regenerate question.", variant: "destructive" });
    }
    setIsLoadingNewQuestion(false);
  }


  const handleFinishInterview = () => {
    setIsInterviewActive(false);
    toast({ title: "Interview Finished!", description: "Great job on completing your practice session!" });
  };
  
  const isLastQuestion = currentQuestionIndex === generatedQuestions.length - 1;

  return (
    <div className="container mx-auto px-4 py-8 min-h-[calc(100vh-var(--header-height,80px))]">
      {!isInterviewActive ? (
        <>
          {/* If interview is not active, show setup or completion card */}
          {(currentSettings === null || generatedQuestions.length === 0 || (currentQuestionIndex === 0 && !currentEvaluation)) ? 
            (<InterviewSetupForm 
              onSubmit={handleStartInterview} 
              isLoading={isLoadingSetup}
            />)
          : 
            (<Card className="w-full max-w-md mx-auto text-center shadow-xl">
              <CardHeader>
                <Award size={64} className="mx-auto text-accent mb-4" />
                <CardTitle className="text-3xl font-bold">Interview Complete!</CardTitle>
                <CardDescription className="text-lg text-muted-foreground">
                  Well done! You've completed your practice session. Review your progress below.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => {
                    setCurrentSettings(null); // This will take user back to setup form
                    setGeneratedQuestions([]);
                    setCurrentQuestionIndex(0);
                    setCurrentEvaluation(null);
                    setCurrentModelAnswer(null);
                    setCurrentCommunicationAnalysis(null);
                  }} 
                  size="lg" 
                  className="w-full text-lg py-6"
                >
                  <RotateCcw size={20} className="mr-2"/> Start New Interview
                </Button>
              </CardContent>
            </Card>)
          }
          <div className="mt-12">
            {hasMounted ? <ProgressTracker attempts={progress} /> : <p className="text-center text-muted-foreground">Loading progress...</p>}
          </div>
        </>
      ) : (
        <InterviewArea
          question={generatedQuestions[currentQuestionIndex]}
          questionNumber={currentQuestionIndex + 1}
          totalQuestions={generatedQuestions.length}
          onSubmitAnswer={handleSubmitAnswer}
          onSkipQuestion={handleSkipQuestion}
          onRegenerateQuestion={handleRegenerateQuestion}
          onGetModelAnswer={handleGetModelAnswer}
          onNextQuestion={handleNextQuestion}
          onFinishInterview={handleFinishInterview}
          isLoadingEvaluation={isLoadingEvaluation}
          isLoadingModelAnswer={isLoadingModelAnswer}
          isLoadingNewQuestion={isLoadingNewQuestion}
          evaluationResult={currentEvaluation}
          communicationAnalysisResult={currentCommunicationAnalysis}
          modelAnswerText={currentModelAnswer}
          isLastQuestion={isLastQuestion}
          isCustomQuestion={!!currentSettings?.customQuestion}
        />
      )}
    </div>
  );
}
