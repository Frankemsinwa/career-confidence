
'use client';

import { StoredPresentationAttempt } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { TrendingUp, Archive, Clock, Users, BookOpen, Clapperboard, Mic, BarChartHorizontal } from 'lucide-react';
import { Progress } from '@/components/ui/progress';


type PresentationProgressTrackerProps = {
  attempts: StoredPresentationAttempt[];
};

const FeedbackMetricBar = ({ label, score }: { label: string; score: number }) => {
  const getBarColor = (value: number) => {
    if (value < 50) return 'bg-destructive';
    if (value < 75) return 'bg-yellow-400';
    return 'bg-green-500';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xs font-bold">{score}</p>
      </div>
      <Progress value={score} indicatorClassName={getBarColor(score)} className="h-1.5" />
    </div>
  );
};


export default function PresentationProgressTracker({ attempts }: PresentationProgressTrackerProps) {
  if (attempts.length === 0) {
    return (
      <Card className="mt-8 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl flex items-center gap-2"><Archive size={28} className="text-muted-foreground"/>Presentation Progress</CardTitle>
          <CardDescription>No presentation practice attempts recorded yet. Start a session to see your progress!</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mt-10 shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary flex items-center justify-center gap-2">
          <TrendingUp size={32} /> Presentation Progress
        </CardTitle>
        <CardDescription className="text-center text-muted-foreground">
          Review your past presentation attempts and track your improvement.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <Accordion type="single" collapsible className="w-full">
            {attempts.sort((a,b) => b.timestamp - a.timestamp).map((attempt, index) => (
              <AccordionItem value={`item-${index}`} key={attempt.id} className="mb-2 border-b-0">
                <AccordionTrigger className="bg-secondary/50 hover:bg-secondary/80 px-4 py-3 rounded-lg shadow-sm data-[state=open]:rounded-b-none data-[state=open]:shadow-md">
                  <div className="flex justify-between items-center w-full">
                    <div className='text-left'>
                      <p className="font-semibold text-primary-foreground text-lg">{attempt.settings.topic.length > 25 ? `${attempt.settings.topic.substring(0,25)}...` : attempt.settings.topic}</p>
                      <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(attempt.timestamp), { addSuffix: true })}</p>
                    </div>
                    <div className="flex items-center gap-2">
                       {attempt.practiceMode === 'video' ? (
                        <Badge variant="outline" className="text-xs hidden sm:flex items-center gap-1"><Clapperboard size={12}/> Video</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs hidden sm:flex items-center gap-1"><Mic size={12}/> Audio</Badge>
                      )}
                      <Badge variant="outline" className="text-xs hidden sm:flex items-center gap-1">
                        <Clock size={12}/> {attempt.actualDurationSeconds}s
                      </Badge>
                      <Badge variant={attempt.analysis.timeManagementScore >= 70 ? 'default' : 'destructive'} className="text-sm px-3 py-1">
                        Time: {attempt.analysis.timeManagementScore}
                      </Badge>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="bg-card p-4 rounded-b-lg shadow-inner border border-t-0">
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1"><BookOpen size={14}/> <strong>Topic:</strong> {attempt.settings.topic}</div>
                        <div className="flex items-center gap-1"><Users size={14}/> <strong>Audience:</strong> {attempt.settings.targetAudience}</div>
                        <div className="flex items-center gap-1"><Clock size={14}/> <strong>Target:</strong> {attempt.settings.timeFrame}</div>
                    </div>

                    <Card className="p-4 bg-muted/30">
                      <CardTitle className="text-base mb-3 flex items-center gap-2"><BarChartHorizontal size={18}/> Performance Scores</CardTitle>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3">
                        <FeedbackMetricBar label="Structure" score={attempt.analysis.structureScore} />
                        <FeedbackMetricBar label="Clarity" score={attempt.analysis.clarityScore} />
                        <FeedbackMetricBar label="Engagement" score={attempt.analysis.engagementScore} />
                        <FeedbackMetricBar label="Time Mgmt" score={attempt.analysis.timeManagementScore} />
                        <FeedbackMetricBar label="Filler Words" score={attempt.analysis.fillerWordsScore} />
                         <div className="flex items-center justify-between pt-1">
                            <p className="text-xs font-medium text-muted-foreground">Speaking Pace</p>
                            <p className="text-xs font-bold">{attempt.analysis.speakingPaceWPM} WPM</p>
                        </div>
                      </div>
                    </Card>
                    
                    <div>
                      <h4 className="font-medium text-muted-foreground">Transcript:</h4>
                      <p className="pl-2 mt-1 text-sm bg-muted p-2 rounded-md border whitespace-pre-wrap">{attempt.transcript || '(No text was transcribed for this attempt.)'}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                      <div className="bg-blue-50 p-3 rounded border border-blue-200">
                        <h4 className="font-medium text-blue-700">Clarity & Pacing:</h4>
                        <p className="text-sm text-blue-600">{attempt.analysis.clarityFeedback} {attempt.analysis.paceFeedback}</p>
                      </div>
                      <div className="bg-green-50 p-3 rounded border border-green-200">
                        <h4 className="font-medium text-green-700">Structure & Engagement:</h4>
                        <p className="text-sm text-green-600">{attempt.analysis.structureFeedback} {attempt.analysis.engagementFeedback}</p>
                      </div>
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
