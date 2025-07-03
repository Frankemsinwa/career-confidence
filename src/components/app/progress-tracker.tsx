
'use client';

import { StoredAttempt } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { TrendingUp, Archive, Clock, MicVocal, BarChartHorizontal, Clapperboard, Mic } from 'lucide-react';

type ProgressTrackerProps = {
  attempts: StoredAttempt[];
};

export default function ProgressTracker({ attempts }: ProgressTrackerProps) {
  if (attempts.length === 0) {
    return (
      <Card className="mt-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Archive size={28} className="text-muted-foreground"/>Your Progress</CardTitle>
          <CardDescription>No practice attempts recorded yet. Start an interview to see your progress!</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mt-10 shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary flex items-center justify-center gap-2">
          <TrendingUp size={32} /> Progress Overview
        </CardTitle>
        <CardDescription className="text-center text-muted-foreground">
          Review your past interview attempts and track your improvement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4"> {/* Increased height slightly */}
          <Accordion type="single" collapsible className="w-full">
            {attempts.sort((a,b) => b.timestamp - a.timestamp).map((attempt, index) => (
              <AccordionItem value={`item-${index}`} key={attempt.id} className="mb-2 border-b-0">
                <AccordionTrigger className="bg-secondary/50 hover:bg-secondary/80 px-4 py-3 rounded-lg shadow-sm data-[state=open]:rounded-b-none data-[state=open]:shadow-md">
                  <div className="flex justify-between items-center w-full">
                    <div className='text-left'>
                      <p className="font-semibold text-primary-foreground text-lg">{attempt.settings.jobRole.length > 25 ? `${attempt.settings.jobRole.substring(0,25)}...` : attempt.settings.jobRole}</p>
                      <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(attempt.timestamp), { addSuffix: true })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {attempt.practiceMode === 'video' ? (
                        <Badge variant="outline" className="text-xs hidden sm:flex items-center gap-1"><Clapperboard size={12}/> Video</Badge>
                      ) : attempt.practiceMode === 'audio' ? (
                        <Badge variant="outline" className="text-xs hidden sm:flex items-center gap-1"><Mic size={12}/> Audio</Badge>
                      ) : null}
                      {attempt.recordingDurationSeconds !== undefined && attempt.recordingDurationSeconds > 0 ? (
                        <Badge variant="outline" className="text-xs hidden sm:flex items-center gap-1">
                          <Clock size={12}/> {attempt.recordingDurationSeconds}s
                        </Badge>
                      ) : null}
                      <Badge variant={attempt.evaluation.score >= 70 ? 'default' : 'destructive'} className="text-sm px-3 py-1">
                        Score: {attempt.evaluation.score}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="bg-card p-4 rounded-b-lg shadow-inner border border-t-0">
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-muted-foreground">Question:</h4>
                      <p className="pl-2">{attempt.question}</p>
                    </div>
                    <div>
                      <h4 className="font-medium text-muted-foreground">Your Answer (Text):</h4>
                      <p className="pl-2 whitespace-pre-wrap">{attempt.userAnswer || '(No text was transcribed for this attempt.)'}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <div className="bg-green-50 p-3 rounded border border-green-200">
                        <h4 className="font-medium text-green-700">Strengths:</h4>
                        <p className="text-sm text-green-600">{attempt.evaluation.strengths}</p>
                      </div>
                      <div className="bg-red-50 p-3 rounded border border-red-200">
                        <h4 className="font-medium text-red-700">Weaknesses:</h4>
                        <p className="text-sm text-red-600">{attempt.evaluation.weaknesses}</p>
                      </div>
                    </div>

                    {attempt.communicationAnalysis && (
                       <div className="mt-3 pt-3 border-t">
                         <h4 className="font-medium text-muted-foreground flex items-center gap-1 mb-1"><BarChartHorizontal size={16}/>Communication Analysis:</h4>
                         <div className="pl-2 space-y-1 text-sm">
                            <p><strong>Clarity:</strong> {attempt.communicationAnalysis.clarityFeedback}</p>
                            <p><strong>Confidence Cues:</strong> {attempt.communicationAnalysis.confidenceCues}</p>
                            <p>
                                <strong>Pace:</strong> {attempt.communicationAnalysis.speakingPaceWPM} WPM. {attempt.communicationAnalysis.paceFeedback}
                                {attempt.recordingDurationSeconds && ` (Total: ${attempt.recordingDurationSeconds}s)`}
                            </p>
                            {attempt.communicationAnalysis.fillerWordsFound.length > 0 && (
                                <p><strong>Filler Words:</strong> {attempt.communicationAnalysis.fillerWordsFound.join(', ')}</p>
                            )}
                         </div>
                       </div>
                    )}

                     <div className="bg-indigo-50 p-3 rounded border border-indigo-200 mt-2">
                        <h4 className="font-medium text-indigo-700 flex items-center gap-1"><MicVocal size={16}/>Model Answer Suggestion:</h4>
                        <p className="text-sm text-indigo-600">{attempt.evaluation.modelAnswer}</p>
                      </div>
                    <div className="text-xs text-muted-foreground pt-2">
                      Type: {attempt.settings.interviewType} | Difficulty: {attempt.settings.difficultyLevel}
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
