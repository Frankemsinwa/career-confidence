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

export default function PresentationPage() {
  const [settings, setSettings] = useState<PresentationSettings | null>(null);
  const [isPracticeActive, setIsPracticeActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalyzePresentationOutput | null>(null);
  
  // Later, we can create a shared or generic progress tracker. For now, let's keep it separate.
  const [progress, setProgress] = useLocalStorage<StoredPresentationAttempt[]>('careerConfidencePresentationProgress', []);
  const { toast } = useToast();

  const handleStartPractice = (newSettings: PresentationSettings) => {
    setSettings(newSettings);
    setCurrentAnalysis(null);
    setIsPracticeActive(true);
    toast({ title: 'Practice Session Started!', description: 'Your presentation timer has begun.' });
  };

  const handleSubmitPresentation = async (transcript: string, duration: number, recordedVideoUrl?: string | null) => {
    if (!settings) return;
    setIsLoading(true);
    setCurrentAnalysis(null);

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

      // Save the attempt to local storage
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

  const handleEndPractice = () => {
    setIsPracticeActive(false);
    setSettings(null);
    setCurrentAnalysis(null);
    toast({ title: 'Practice Session Ended', description: 'Great work! You can start a new session anytime.' });
  };

  return (
    <div className="container mx-auto px-4 py-8 min-h-[calc(100vh-var(--header-height,80px))]">
      {!isPracticeActive ? (
        <PresentationSetupForm onSubmit={handleStartPractice} isLoading={isLoading} />
      ) : settings ? (
        <PresentationArea
          settings={settings}
          onSubmit={handleSubmitPresentation}
          onEndPractice={handleEndPractice}
          isLoading={isLoading}
          analysisResult={currentAnalysis}
        />
      ) : (
        // Fallback in case state is inconsistent
        <PresentationSetupForm onSubmit={handleStartPractice} isLoading={isLoading} />
      )}
       {/* TODO: Add a ProgressTracker for presentations similar to the interview page */}
    </div>
  );
}
