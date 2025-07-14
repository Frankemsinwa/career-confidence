
'use client';

import { useState, useEffect } from 'react';
import type { PresentationSettings, StoredPresentationAttempt } from '@/lib/types';
import PresentationSetupForm from '@/components/app/presentation-setup-form';
import PresentationArea from '@/components/app/presentation-area';
import { useToast } from '@/hooks/use-toast';
import useLocalStorage from '@/hooks/use-local-storage';
import { v4 as uuidv4 } from 'uuid';
import { analyzePresentation } from '@/ai/flows/analyze-presentation-flow';
import type { AnalyzePresentationOutput } from '@/ai/flows/analyze-presentation-flow';
import { generatePresentationSuggestion } from '@/ai/flows/generate-presentation-suggestion';
import PresentationProgressTracker from '@/components/app/presentation-progress-tracker';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

export default function PresentationPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [settings, setSettings] = useState<PresentationSettings | null>(null);
  const [isPracticeActive, setIsPracticeActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalyzePresentationOutput | null>(null);
  const [modelSuggestion, setModelSuggestion] = useState<string | null>(null);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  
  const [progress, setProgress] = useLocalStorage<StoredPresentationAttempt[]>('careerConfidencePresentationProgress', []);
  const { toast } = useToast();

  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?from=/presentation');
    }
  }, [user, loading, router]);


  const handleStartPractice = (newSettings: PresentationSettings) => {
    setSettings(newSettings);
    setCurrentAnalysis(null);
    setModelSuggestion(null);
    setIsPracticeActive(true);
    toast({ title: 'Practice Session Started!', description: 'Your presentation timer has begun.' });
  };

  const handleSubmitPresentation = async (transcript: string, duration: number, recordedVideoUrl?: string | null) => {
    if (!settings) return;
    setIsLoading(true);
    setCurrentAnalysis(null);
    setModelSuggestion(null);

    try {
      const result = await analyzePresentation({
        topic: settings.topic,
        audience: settings.targetAudience,
        timeFrame: settings.timeFrame,
        transcript: transcript,
        actualDurationSeconds: duration,
      });
      setCurrentAnalysis(result);
      toast({ title: 'Analysis Complete!', description: 'Your feedback is ready.' });

      const newAttempt: StoredPresentationAttempt = {
        id: uuidv4(),
        timestamp: Date.now(),
        settings: settings,
        transcript: transcript,
        analysis: result,
        actualDurationSeconds: duration,
        recordedVideoUrl: recordedVideoUrl ?? undefined,
        practiceMode: recordedVideoUrl ? 'video' : 'audio',
      };
      setProgress(prev => [...prev, newAttempt]);

    } catch (error) {
       console.error('Error analyzing presentation:', error);
       const message = error instanceof Error ? error.message : "An unknown error occurred.";
       toast({
         variant: 'destructive',
         title: 'Analysis Failed',
         description: `There was an error analyzing your presentation: ${message}`,
       });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetModelSuggestion = async () => {
    if (!settings) return;
    setIsLoadingSuggestion(true);
    try {
      const result = await generatePresentationSuggestion({
        topic: settings.topic,
        audience: settings.targetAudience,
        timeFrame: settings.timeFrame,
      });
      setModelSuggestion(result.suggestion);
      toast({ title: "Suggestion Ready!", description: "A model outline has been generated." });
    } catch (error) {
      console.error('Error generating suggestion:', error);
      toast({ variant: 'destructive', title: 'Suggestion Failed', description: "Could not generate a model suggestion." });
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const handleEndPractice = () => {
    setIsPracticeActive(false);
    setSettings(null);
    setCurrentAnalysis(null);
    setModelSuggestion(null);
    toast({ title: 'Practice Session Ended', description: 'Great work! You can start a new session anytime.' });
  };

  const handleRetryPractice = () => {
    setCurrentAnalysis(null);
    setModelSuggestion(null);
    toast({
      title: 'Ready for Another Take!',
      description: 'Your settings are the same. Start recording when you are ready.',
    });
  };

  if (loading || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="w-full max-w-lg mx-auto space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 min-h-[calc(100vh-var(--header-height,80px))]">
      {!isPracticeActive ? (
        <>
          <PresentationSetupForm onSubmit={handleStartPractice} isLoading={isLoading} />
          <div className="mt-12">
            {hasMounted ? <PresentationProgressTracker attempts={progress} /> : <p className="text-center text-muted-foreground">Loading progress...</p>}
          </div>
        </>
      ) : settings ? (
        <PresentationArea
          settings={settings}
          onSubmit={handleSubmitPresentation}
          onEndPractice={handleEndPractice}
          onRetryPractice={handleRetryPractice}
          isLoading={isLoading}
          analysisResult={currentAnalysis}
          onGetModelSuggestion={handleGetModelSuggestion}
          isLoadingSuggestion={isLoadingSuggestion}
          modelSuggestion={modelSuggestion}
        />
      ) : (
        <>
          <PresentationSetupForm onSubmit={handleStartPractice} isLoading={isLoading} />
           <div className="mt-12">
            {hasMounted ? <PresentationProgressTracker attempts={progress} /> : <p className="text-center text-muted-foreground">Loading progress...</p>}
          </div>
        </>
      )}
    </div>
  );
}
