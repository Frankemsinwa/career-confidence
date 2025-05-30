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
import type { InterviewSettings, StoredAttempt, InterviewType, DifficultyLevel, QuestionCount } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import useLocalStorage from '@/hooks/use-local-storage';
import { v4 as uuidv4 } from 'uuid'; // For unique IDs
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, RotateCcw } from 'lucide-react';

// Helper to ensure numQuestions is always a valid QuestionCount
const ensureValidNumQuestions = (num: number): QuestionCount => {
  const validCounts: readonly number[] = [1, 3, 5, 7, 10];
  return (validCounts.includes(num) ? num : 3) as QuestionCount;
};


export default function Home() {
  // Setup state
  const [currentSettings, setCurrentSettings] = useState<InterviewSettings | null>(null);

  // Interview flow state
  const [isInterviewActive, setIsInterviewActive] = useState<boolean>(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<string[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  
  // Feedback state for the current question
  const [currentEvaluation, setCurrentEvaluation] = useState<EvaluateAnswerOutput | null>(null);
  const [currentModelAnswer, setCurrentModelAnswer] = useState<string | null>(null);

  // Loading states
  const [isLoadingSetup, setIsLoadingSetup] = useState<boolean>(false);
  const [isLoadingEvaluation, setIsLoadingEvaluation] = useState<boolean>(false);
  const [isLoadingModelAnswer, setIsLoadingModelAnswer] = useState<boolean>(false);
  const [isLoadingNewQuestion, setIsLoadingNewQuestion] = useState<boolean>(false); // For skip/regenerate

  // Progress state
  const [progress, setProgress] = useLocalStorage<StoredAttempt[]>('careerConfidenceProgress', []);

  const { toast } = useToast();

  // State to ensure client-side only rendering for localStorage dependent components
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleStartInterview = async (settings: InterviewSettings) => {
    setIsLoadingSetup(true);
    setCurrentSettings(settings);
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
        setCurrentQuestionIndex(0);
        setCurrentEvaluation(null);
        setCurrentModelAnswer(null);
        setIsInterviewActive(true);
        toast({ title: "Interview Started!", description: `Generated ${result.questions.length} questions for you.` });
      } else {
        toast({ title: "Error", description: "Could not generate questions. Please try again.", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error generating questions:", error);
      toast({ title: "Error", description: "Failed to start interview. Check console for details.", variant: "destructive" });
    }
    setIsLoadingSetup(false);
  };

  const handleDailyPractice = () => {
    const dailySettings: InterviewSettings = {
      jobRole: "General Professional",
      interviewType: "Behavioral",
      difficultyLevel: "Intermediate",
      numQuestions: 3,
    };
    handleStartInterview(dailySettings);
  };

  const handleSubmitAnswer = async (answer: string) => {
    if (!currentSettings || generatedQuestions.length === 0) return;
    setIsLoadingEvaluation(true);
    setCurrentEvaluation(null); // Clear previous evaluation
    setCurrentModelAnswer(null); // Clear previous model answer
    try {
      const aiInput: EvaluateAnswerInput = {
        question: generatedQuestions[currentQuestionIndex],
        answer: answer,
        jobRole: currentSettings.jobRole,
        difficulty: currentSettings.difficultyLevel,
      };
      const evaluationResult = await evaluateAnswer(aiInput);
      setCurrentEvaluation(evaluationResult);

      const newAttempt: StoredAttempt = {
        id: uuidv4(),
        timestamp: Date.now(),
        question: generatedQuestions[currentQuestionIndex],
        userAnswer: answer,
        evaluation: evaluationResult,
        settings: {
          jobRole: currentSettings.jobRole,
          interviewType: currentSettings.interviewType,
          difficultyLevel: currentSettings.difficultyLevel,
        },
      };
      setProgress(prevProgress => [...prevProgress, newAttempt]);
      toast({ title: "Answer Evaluated!", description: `Score: ${evaluationResult.score}/100` });

    } catch (error) {
      console.error("Error evaluating answer:", error);
      toast({ title: "Error", description: "Failed to evaluate answer.", variant: "destructive" });
    }
    setIsLoadingEvaluation(false);
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
    } else {
      // This case should be handled by onFinishInterview
      handleFinishInterview();
    }
  };
  
  const handleSkipQuestion = async () => {
    if (!currentSettings) return;
    setIsLoadingNewQuestion(true);
    setCurrentEvaluation(null);
    setCurrentModelAnswer(null);
    try {
      const aiInput: GenerateInterviewQuestionsInput = {
        jobRole: currentSettings.jobRole,
        interviewType: currentSettings.interviewType,
        difficultyLevel: currentSettings.difficultyLevel,
        numQuestions: 1, // Generate one new question
      };
      const result = await generateInterviewQuestions(aiInput);
      if (result.questions && result.questions.length > 0) {
        const newQuestions = [...generatedQuestions];
        newQuestions[currentQuestionIndex] = result.questions[0]; // Replace current question
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
     if (!currentSettings) return;
    setIsLoadingNewQuestion(true);
    setCurrentEvaluation(null);
    setCurrentModelAnswer(null);
    try {
      const aiInput: GenerateInterviewQuestionsInput = {
        jobRole: currentSettings.jobRole,
        interviewType: currentSettings.interviewType,
        difficultyLevel: currentSettings.difficultyLevel,
        numQuestions: 1, // Generate one new question
      };
      const result = await generateInterviewQuestions(aiInput);
      if (result.questions && result.questions.length > 0) {
        const newQuestions = [...generatedQuestions];
        newQuestions[currentQuestionIndex] = result.questions[0]; // Replace current question
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
    setCurrentSettings(null);
    setGeneratedQuestions([]);
    setCurrentQuestionIndex(0);
    setCurrentEvaluation(null);
    setCurrentModelAnswer(null);
    toast({ title: "Interview Finished!", description: "Great job on completing your practice session!" });
  };
  
  const isLastQuestion = currentQuestionIndex === generatedQuestions.length - 1;

  return (
    <div className="container mx-auto px-4 py-8 min-h-[calc(100vh-var(--header-height,80px))]"> {/* Adjust header height if known */}
      {!isInterviewActive ? (
        currentSettings === null ? ( // Show setup form only if no settings (i.e. not finished an interview)
          <InterviewSetupForm 
            onSubmit={handleStartInterview} 
            onDailyPractice={handleDailyPractice}
            isLoading={isLoadingSetup}
          />
        ) : ( // Interview finished screen
          <Card className="w-full max-w-md mx-auto text-center shadow-xl">
            <CardHeader>
              <Award size={64} className="mx-auto text-accent mb-4" />
              <CardTitle className="text-3xl font-bold">Interview Complete!</CardTitle>
              <CardDescription className="text-lg text-muted-foreground">
                Well done! You've completed your practice session.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setCurrentSettings(null)} size="lg" className="w-full text-lg py-6">
                <RotateCcw size={20} className="mr-2"/> Start New Interview
              </Button>
            </CardContent>
          </Card>
        )
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
          modelAnswerText={currentModelAnswer}
          isLastQuestion={isLastQuestion}
        />
      )}

      <div className="mt-12">
        {hasMounted ? <ProgressTracker attempts={progress} /> : null}
      </div>
    </div>
  );
}
