
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Loader2,
  Send,
  Video,
  VideoOff,
  CheckCircle,
  AlertCircle,
  BarChartHorizontal,
  Clock,
  Users,
  BookOpen,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  BrainCircuit,
  MoreVertical,
  Download,
  FileText,
  Info,
  X,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';
import type { PresentationSettings } from '@/lib/types';
import type { AnalyzePresentationOutput } from '@/ai/flows/analyze-presentation-flow';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PresentationAreaProps = {
  settings: PresentationSettings;
  onSubmit: (transcript: string, duration: number, recordedVideoUrl?: string | null) => Promise<void>;
  onEndPractice: () => void;
  isLoading: boolean;
  analysisResult: AnalyzePresentationOutput | null;
};

// Helper to get target seconds from timeFrame string
const timeFrameToSeconds = (timeFrame: string): number => {
    const minutes = parseInt(timeFrame.split(' ')[0]);
    return minutes * 60;
};

export default function PresentationArea({
  settings,
  onSubmit,
  onEndPractice,
  isLoading,
  analysisResult,
}: PresentationAreaProps) {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const chosenMimeTypeRef = useRef<string>('video/webm');

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);

  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const targetSeconds = timeFrameToSeconds(settings.timeFrame);
  const { toast } = useToast();

  // Get camera permissions, runs only once on mount
  useEffect(() => {
    async function getPermissions() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoStreamRef.current = stream;
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
      } catch (error) {
        console.error("Error accessing camera/mic:", error);
        setHasCameraPermission(false);
        toast({ variant: 'destructive', title: 'Device Access Denied', description: 'Camera and mic are needed to practice.' });
      }
    }
    getPermissions();

    return () => {
      // Cleanup: stop camera tracks, clear timer, and revoke any video URLs
      videoStreamRef.current?.getTracks().forEach(track => track.stop());
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array ensures this runs only once.
  
  const startTimer = () => {
    recordingStartTimeRef.current = Date.now();
    timerIntervalRef.current = setInterval(() => {
        if(recordingStartTimeRef.current) {
            setElapsedSeconds(Math.floor((Date.now() - recordingStartTimeRef.current)/1000));
        }
    }, 1000);
  };

  const stopTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = null;
    const duration = recordingStartTimeRef.current ? Math.floor((Date.now() - recordingStartTimeRef.current) / 1000) : elapsedSeconds;
    recordingStartTimeRef.current = null;
    return duration;
  };

  const startCountdown = () => {
      setCountdown(3);
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
            if (prev === null || prev <= 1) {
                clearInterval(countdownIntervalRef.current!);
                countdownIntervalRef.current = null;
                startRecording();
                return null;
            }
            return prev - 1;
        });
      }, 1000);
  };

  const cancelCountdown = () => {
      if (countdownIntervalRef.current) {
          clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
      }
      setCountdown(null);
  }

  const startRecording = () => {
      mediaChunksRef.current = [];

      const mimeType = 'video/webm';
      chosenMimeTypeRef.current = mimeType;
      mediaRecorderRef.current = new MediaRecorder(videoStreamRef.current!, { mimeType });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) mediaChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstart = () => {
        setIsRecording(true);
        startTimer();
        toast({ title: 'Recording started!' });
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsRecording(false);
        const duration = stopTimer();

        if (mediaChunksRef.current.length === 0) {
            toast({ title: "No data recorded", variant: "destructive" });
            return;
        }
        
        setIsTranscribing(true);
        toast({ title: "Recording stopped", description: "Transcribing your presentation..." });

        const mediaBlob = new Blob(mediaChunksRef.current, { type: mimeType });
        const newVideoUrl = URL.createObjectURL(mediaBlob);
        setRecordedVideoUrl(newVideoUrl);
        
        const formData = new FormData();
        formData.append('audio', mediaBlob, `presentation.webm`);
        
        try {
          const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
          if (!response.ok) throw new Error('Transcription failed on server.');
          const result = await response.json();
          setTranscript(result.transcript);
          await onSubmit(result.transcript, duration, newVideoUrl);
        } catch (error) {
          toast({ title: "Transcription Failed", description: "Could not transcribe audio.", variant: "destructive" });
        } finally {
          setIsTranscribing(false);
          mediaChunksRef.current = [];
        }
      };
      mediaRecorderRef.current.start();
  }

  const handleRecordButtonClick = async () => {
    if (countdown !== null) {
        cancelCountdown();
        return;
    }
    if (isTranscribing || hasCameraPermission === false) return;
    if (!videoStreamRef.current) {
        toast({ title: "Camera not ready", variant: "destructive" });
        return;
    }

    if (isRecording) {
      mediaRecorderRef.current?.stop();
    } else {
      setTranscript('');
      // Revoke old URL before creating a new one
      if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
      startCountdown();
    }
  };

  const handleDownloadVideo = () => {
    if (!recordedVideoUrl) return;
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    const extension = chosenMimeTypeRef.current.includes('mp4') ? 'mp4' : 'webm';
    a.download = `career-confidence-presentation-${new Date().toISOString()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast({ title: 'Video Download Started' });
  };

  const handleDownloadTranscript = () => {
    if (!transcript.trim()) return;
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `career-confidence-transcript-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Transcript Download Started' });
  };

  
  const timerColorClass = () => {
      if (!targetSeconds) return 'text-primary';
      const percentage = (elapsedSeconds / targetSeconds) * 100;
      if (percentage > 100) return 'text-red-500';
      if (percentage > 80) return 'text-yellow-500';
      return 'text-primary';
  }

  const recordButtonDisabled = hasCameraPermission === false || isLoading || isTranscribing;

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                    <CardTitle className="text-2xl font-semibold text-primary">Presentation Practice</CardTitle>
                    <CardDescription>Record your presentation and get AI feedback.</CardDescription>
                </div>
                 <div className={`text-3xl font-bold p-2 rounded-lg ${timerColorClass()}`}>
                    <Clock size={28} className="inline-block mr-2"/>
                    {new Date(elapsedSeconds * 1000).toISOString().substr(14, 5)}
                    <span className="text-lg text-muted-foreground"> / {new Date(targetSeconds * 1000).toISOString().substr(14, 5)}</span>
                </div>
            </div>
             <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pt-4">
                <div className="flex items-center gap-2"><BookOpen size={16} className="text-primary"/> <strong>Topic:</strong> {settings.topic}</div>
                <div className="flex items-center gap-2"><Users size={16} className="text-primary"/> <strong>Audience:</strong> {settings.targetAudience}</div>
            </div>
        </CardHeader>

        <CardContent>
          {hasCameraPermission === false && <Alert variant="destructive"><AlertTitle>Camera/Mic Required</AlertTitle><AlertDescription>Please enable device permissions to continue.</AlertDescription></Alert>}
          <div className="mb-4 rounded-md overflow-hidden shadow-inner border bg-black relative">
            <video ref={videoPreviewRef} className="w-full aspect-video" autoPlay muted playsInline />
             {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                    <span className="text-8xl font-bold text-white" style={{textShadow: '0 0 10px rgba(0,0,0,0.7)'}}>{countdown}</span>
                </div>
            )}
          </div>
          <div className="flex justify-center">
            <Button
                onClick={handleRecordButtonClick}
                variant={isRecording || countdown !== null ? "destructive" : "default"}
                size="lg"
                disabled={recordButtonDisabled}
                className="rounded-full w-48 h-16 text-lg gap-2"
            >
                {isRecording && <VideoOff size={24}/>}
                {!isRecording && !isTranscribing && countdown === null && <Video size={24}/>}
                {isTranscribing && <Loader2 size={24} className="animate-spin"/>}
                {countdown !== null && <X size={24}/>}
                {isRecording ? "Stop" : isTranscribing ? "Processing..." : (countdown !== null ? "Cancel" : "Record")}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {isLoading && (
        <Card><CardContent className="p-6 flex items-center justify-center min-h-[150px]"><Loader2 className="h-10 w-10 animate-spin text-primary mr-4" /> Analyzing your presentation...</CardContent></Card>
      )}

      {analysisResult && !isLoading && (
        <Card className="animate-in fade-in duration-500">
            <CardHeader><CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2"><BrainCircuit size={24}/> Presentation Feedback</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                {recordedVideoUrl && (
                  <div>
                     <div className="flex justify-between items-center mb-2">
                        <h3 className="text-lg font-semibold">Your Recorded Presentation:</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                               <span className="sr-only">More options</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={handleDownloadVideo}>
                              <Download className="mr-2 h-4 w-4" />
                              <span>Download Video</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleDownloadTranscript} disabled={!transcript.trim()}>
                              <FileText className="mr-2 h-4 w-4" />
                              <span>Download Transcript</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <video src={recordedVideoUrl} controls className="w-full rounded-md shadow-md aspect-video bg-black"></video>
                    {transcript && (
                        <div className="mt-4">
                            <h4 className="text-md font-semibold mb-1">Transcript</h4>
                            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md border whitespace-pre-wrap">{transcript}</p>
                        </div>
                    )}
                     <Alert variant="default" className="mt-3 bg-blue-50 border-blue-200 text-blue-800">
                        <Info className="h-4 w-4 !text-blue-800" />
                        <AlertTitle>Video is Temporary</AlertTitle>
                        <AlertDescription>
                            This video is not saved permanently. Download it now if you wish to keep a copy.
                        </AlertDescription>
                    </Alert>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                        <FeedbackCard icon={<ThumbsUp size={20}/>} title="Structure & Flow" content={analysisResult.structureFeedback} />
                        <FeedbackCard icon={<MessageSquare size={20}/>} title="Clarity" content={analysisResult.clarityFeedback} />
                        <FeedbackCard icon={<ThumbsUp size={20}/>} title="Engagement" content={analysisResult.engagementFeedback} />
                    </div>
                    <div className="space-y-4">
                         <FeedbackCard icon={<Clock size={20}/>} title="Pacing & Time Management" content={`${analysisResult.paceFeedback} ${analysisResult.timeManagementFeedback}`} />
                         {analysisResult.fillerWordsFound.length > 0 && <FeedbackCard icon={<ThumbsDown size={20}/>} title="Filler Words Found" content={analysisResult.fillerWordsFound.join(', ')} />}
                         <div className="bg-muted p-3 rounded-md">
                            <h4 className="font-semibold flex items-center gap-2"><BarChartHorizontal/>Stats</h4>
                            <p className="text-sm">Speaking Pace: <strong>{analysisResult.speakingPaceWPM} WPM</strong></p>
                            <p className="text-sm">Duration: <strong>{analysisResult.actualDurationSeconds}s</strong></p>
                         </div>
                    </div>
                </div>

            </CardContent>
            <CardFooter>
                 <Button onClick={onEndPractice} className="w-full sm:w-auto ml-auto">End Practice & Start New</Button>
            </CardFooter>
        </Card>
      )}
    </div>
  );
}

const FeedbackCard = ({ icon, title, content }: { icon: React.ReactNode, title: string, content: string }) => (
    <div className="bg-card p-4 rounded-lg border shadow-sm">
        <h4 className="font-semibold text-lg flex items-center gap-2 mb-1">{icon}{title}</h4>
        <p className="text-muted-foreground text-sm">{content}</p>
    </div>
);
