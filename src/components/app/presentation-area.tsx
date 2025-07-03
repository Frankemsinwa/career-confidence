
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  Video,
  VideoOff,
  Clock,
  Users,
  BookOpen,
  ThumbsUp,
  MessageSquare,
  BrainCircuit,
  Download,
  FileText,
  Info,
  X,
  Copy,
  CopyCheck,
  Zap,
  Mic,
  MicOff,
  Clapperboard,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';
import type { PresentationSettings } from '@/lib/types';
import type { AnalyzePresentationOutput } from '@/ai/flows/analyze-presentation-flow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PresentationAreaProps = {
  settings: PresentationSettings;
  onSubmit: (transcript: string, duration: number, recordedVideoUrl?: string | null) => Promise<void>;
  onEndPractice: () => void;
  onRetryPractice: () => void;
  isLoading: boolean;
  analysisResult: AnalyzePresentationOutput | null;
  onGetModelSuggestion: () => Promise<void>;
  isLoadingSuggestion: boolean;
  modelSuggestion: string | null;
};

// Helper to get target seconds from timeFrame string
const timeFrameToSeconds = (timeFrame: string): number => {
    const minutes = parseInt(timeFrame.split(' ')[0]);
    return minutes * 60;
};

// Locally defined component for feedback metric bars
const FeedbackMetricBar = ({ label, score }: { label: string; score: number }) => {
  const getBarColor = (value: number) => {
    if (value < 50) return 'bg-destructive';
    if (value < 75) return 'bg-yellow-400';
    return 'bg-green-500';
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-sm font-bold">{score}</p>
      </div>
      <Progress value={score} indicatorClassName={getBarColor(score)} className="h-2" />
    </div>
  );
};

// Locally defined component for detailed feedback cards
const FeedbackDetailCard = ({ icon, title, content }: { icon: React.ReactNode, title: string, content: string }) => (
    <div className="bg-muted/50 p-4 rounded-lg border">
        <h4 className="font-semibold text-md flex items-center gap-2 mb-1 text-primary">{icon}{title}</h4>
        <p className="text-muted-foreground text-sm">{content}</p>
    </div>
);


export default function PresentationArea({
  settings,
  onSubmit,
  onEndPractice,
  onRetryPractice,
  isLoading,
  analysisResult,
  onGetModelSuggestion,
  isLoadingSuggestion,
  modelSuggestion,
}: PresentationAreaProps) {
  // Shared state
  const [practiceMode, setPracticeMode] = useState<'video' | 'audio'>('audio');
  const [hasCopied, setHasCopied] = useState(false);
  const { toast } = useToast();

  // Video Mode State
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const chosenMimeTypeRef = useRef<string>('video/webm');
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Audio Mode State
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isAudioSupported, setIsAudioSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const audioRecordingStartTimeRef = useRef<number | null>(null);
  const [audioRecordingDuration, setAudioRecordingDuration] = useState(0);
  const liveTranscriptRef = useRef('');

  // Timer State
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);

  const targetSeconds = timeFrameToSeconds(settings.timeFrame);

  // Get camera permissions, runs only once on mount
  useEffect(() => {
    async function getPermissions() {
      if (videoStreamRef.current) return;
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        videoStreamRef.current = stream;
        setHasCameraPermission(true);
      } catch (error) {
        console.error("Error accessing camera/mic:", error);
        setHasCameraPermission(false);
        toast({ variant: 'destructive', title: 'Device Access Denied', description: 'Camera and mic are needed to record a video.' });
      }
    }
    getPermissions();

    return () => {
      // Cleanup: stop camera tracks, clear timers, and revoke any video URLs
      videoStreamRef.current?.getTracks().forEach(track => track.stop());
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect for Web Speech API setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsAudioSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
        let final = finalTranscript; // Append to existing final transcript
        let interim = '';
        for (const result of event.results) {
            if (result.isFinal) {
                final += result[0].transcript;
            } else {
                interim += result[0].transcript;
            }
        }
        const currentLive = final + interim;
        liveTranscriptRef.current = currentLive;
        setLiveTranscript(currentLive);
    };

    recognition.onstart = () => {
        setIsListening(true);
        startTimer();
        toast({ title: 'Listening...', description: 'Start your presentation.' });
    };

    recognition.onend = () => {
        setIsListening(false);
        const duration = stopTimer();
        const final = liveTranscriptRef.current;
        setFinalTranscript(final);
        
        if (final.trim()) {
            onSubmit(final, duration, null);
        } else {
            toast({ title: "No speech detected", variant: "destructive" });
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        toast({ variant: 'destructive', title: 'Recognition Error', description: `An error occurred: ${event.error}. Try again or use Video Mode.` });
        setIsListening(false);
        stopTimer();
    };

    return () => {
        if(recognitionRef.current) {
          recognitionRef.current.stop();
        }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalTranscript]);
  
  // Effect to manage video preview element
  useEffect(() => {
    const videoElement = videoPreviewRef.current;
    if (practiceMode === 'video' && hasCameraPermission && videoElement && videoStreamRef.current) {
      if (videoElement.srcObject !== videoStreamRef.current) {
        videoElement.srcObject = videoStreamRef.current;
      }
      videoElement.play().catch(e => console.error("Error playing video preview:", e));
    }
  }, [practiceMode, hasCameraPermission]);


  useEffect(() => {
    // Reset state when analysis result is cleared (new session starts)
    if (!analysisResult) {
        setTranscript('');
        setFinalTranscript('');
        setLiveTranscript('');
        setRecordedVideoUrl(null);
        setElapsedSeconds(0);
        cancelCountdown();
    }
  }, [analysisResult]);
  
  const startTimer = () => {
    recordingStartTimeRef.current = Date.now() - (elapsedSeconds * 1000);
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
                if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
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
    try {
      if (!videoStreamRef.current) throw new Error("Camera stream not available.");
      mediaChunksRef.current = [];
      const mimeTypeOptions = ['video/webm;codecs=vp9,opus', 'video/webm'];
      let chosenMimeType = mimeTypeOptions.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
      chosenMimeTypeRef.current = chosenMimeType;

      mediaRecorderRef.current = new MediaRecorder(videoStreamRef.current, { mimeType: chosenMimeType });

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
        const mediaBlob = new Blob(mediaChunksRef.current, { type: chosenMimeType });
        const newVideoUrl = URL.createObjectURL(mediaBlob);
        setRecordedVideoUrl(newVideoUrl);
        const formData = new FormData();
        const fileExtension = chosenMimeType.includes('mp4') ? 'mp4' : 'webm';
        formData.append('audio', mediaBlob, `presentation.${fileExtension}`);
        
        try {
          const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Could not read server error response.' }));
            throw new Error(errorData.error || `Server error: ${response.status}`);
          }
          const result = await response.json();
          setTranscript(result.transcript);
          await onSubmit(result.transcript, duration, newVideoUrl);

        } catch (error) {
          const message = error instanceof Error ? error.message : "An unknown error occurred during transcription.";
          toast({ title: "Transcription Failed", description: message, variant: "destructive" });
        } finally {
          setIsTranscribing(false);
          mediaChunksRef.current = [];
        }
      };
      mediaRecorderRef.current.start();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start recording.";
      toast({ title: "Recording Error", description: `Failed to start video recording: ${message}`, variant: "destructive" });
      setIsRecording(false);
    }
  }

  const handleVideoRecordButtonClick = async () => {
    if (countdown !== null) { cancelCountdown(); return; }
    if (isTranscribing || hasCameraPermission === false) return;
    if (!videoStreamRef.current) { toast({ title: "Camera not ready", variant: "destructive" }); return; }
    if (isRecording) mediaRecorderRef.current?.stop();
    else {
      setTranscript('');
      setElapsedSeconds(0);
      if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
      startCountdown();
    }
  };

  const handleAudioRecordClick = () => {
    if (!isAudioSupported) {
        toast({ variant: 'destructive', title: 'Audio Mode Not Supported' });
        return;
    }
    if (!recognitionRef.current || isLoading) return;
    
    if (isListening) {
      recognitionRef.current.stop(); // This triggers onend, which stops the timer and submits
    } else {
      setFinalTranscript('');
      setLiveTranscript('');
      liveTranscriptRef.current = '';
      setAudioRecordingDuration(0);
      setElapsedSeconds(0);
      recognitionRef.current.start();
    }
  };

  const displayedTranscript = (practiceMode === 'video' ? transcript : finalTranscript) || (analysisResult ? 'Could not retrieve transcript from this session.' : '');

  const handleDownloadVideo = () => {
    if (!recordedVideoUrl) return;
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    a.download = `career-confidence-presentation-${new Date().toISOString()}.webm`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast({ title: 'Video Download Started' });
  };

  const handleDownloadTranscript = () => {
    if (!displayedTranscript.trim()) return;
    const blob = new Blob([displayedTranscript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `career-confidence-transcript-${new Date().toISOString()}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Transcript Download Started' });
  };

  const handleCopyTranscript = () => {
    if (!displayedTranscript.trim()) return;
    navigator.clipboard.writeText(displayedTranscript);
    setHasCopied(true);
    toast({ title: 'Transcript Copied!' });
    setTimeout(() => setHasCopied(false), 2000);
  };
  
  const timerColorClass = () => {
      if (!targetSeconds) return 'text-primary';
      const percentage = (elapsedSeconds / targetSeconds) * 100;
      if (percentage > 100) return 'text-red-500';
      if (percentage > 80) return 'text-yellow-500';
      return 'text-primary';
  }

  const videoRecordButtonDisabled = hasCameraPermission === false || isLoading || isTranscribing;
  const audioRecordButtonDisabled = !isAudioSupported || isLoading;

  return (
    <div className="space-y-6 w-full max-w-4xl mx-auto">
      {!analysisResult && (
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
          <Tabs value={practiceMode} onValueChange={(v) => setPracticeMode(v as 'video' | 'audio')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="video" disabled={hasCameraPermission === false}><Clapperboard className="mr-2 h-5 w-5"/>Video Practice</TabsTrigger>
              <TabsTrigger value="audio" disabled={!isAudioSupported}><Mic className="mr-2 h-5 w-5"/>Audio Practice (Free)</TabsTrigger>
            </TabsList>
            <TabsContent value="video">
              {hasCameraPermission === false && <Alert variant="destructive"><AlertTitle>Camera/Mic Required</AlertTitle><AlertDescription>Please enable device permissions for video practice.</AlertDescription></Alert>}
              <div className="mb-4 rounded-lg overflow-hidden shadow-inner border bg-black relative">
                <video ref={videoPreviewRef} className="w-full aspect-video" autoPlay muted playsInline />
                {countdown !== null && (<div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50"><span className="text-8xl font-bold text-white" style={{textShadow: '0 0 10px rgba(0,0,0,0.7)'}}>{countdown}</span></div>)}
              </div>
              <div className="flex justify-center">
                <Button onClick={handleVideoRecordButtonClick} variant={isRecording || countdown !== null ? "destructive" : "default"} size="lg" disabled={videoRecordButtonDisabled} className="rounded-full w-48 h-16 text-lg gap-2">
                    {isRecording && <VideoOff size={24}/>}
                    {!isRecording && !isTranscribing && countdown === null && <Video size={24}/>}
                    {isTranscribing && <Loader2 size={24} className="animate-spin"/>}
                    {countdown !== null && <X size={24}/>}
                    {isRecording ? "Stop" : isTranscribing ? "Processing..." : (countdown !== null ? "Cancel" : "Record")}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="audio">
              {!isAudioSupported && <Alert variant="destructive"><AlertTitle>Audio Not Supported</AlertTitle><AlertDescription>Your browser doesn't support live transcription. Try Chrome/Edge or use Video Mode.</AlertDescription></Alert>}
              <div className="flex flex-col items-center justify-center space-y-4">
                  <div className={`w-full min-h-[50px] p-3 rounded-md border bg-muted text-muted-foreground ${liveTranscript.trim() ? 'text-foreground' : ''}`}>{liveTranscript.trim() ? liveTranscript : "Your live transcript will appear here..."}</div>
                  <Button onClick={handleAudioRecordClick} variant={isListening ? 'destructive' : 'default'} size="lg" disabled={audioRecordButtonDisabled} className="rounded-full w-48 h-16 text-lg gap-2">
                    {isListening ? <MicOff size={24}/> : <Mic size={24} />}
                    {isListening ? "Stop" : "Speak"}
                  </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      )}
      
      {(isLoading || isTranscribing) && (
        <Card><CardContent className="p-6 flex items-center justify-center min-h-[150px]"><Loader2 className="h-10 w-10 animate-spin text-primary mr-4" /> {isTranscribing ? 'Transcribing and analyzing...' : 'Analyzing your presentation...'}</CardContent></Card>
      )}

      {analysisResult && !isLoading && !isTranscribing && (
        <>
            <Card className="animate-in fade-in duration-500">
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2"><BrainCircuit size={24}/> Presentation Feedback</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="icon" onClick={handleDownloadVideo} disabled={!recordedVideoUrl} aria-label="Download Video">
                        <Download className="h-5 w-5" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={handleDownloadTranscript} disabled={!displayedTranscript} aria-label="Download Transcript">
                        <FileText className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {recordedVideoUrl && (
                      <div className="rounded-lg overflow-hidden border shadow-md">
                        <video src={recordedVideoUrl} controls className="w-full aspect-video bg-black"></video>
                      </div>
                    )}
                    
                    <Card className="p-6 bg-secondary/30">
                      <CardTitle className="text-lg mb-4">Feedback Summary</CardTitle>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <FeedbackMetricBar label="Structure &amp; Flow" score={analysisResult.structureScore} />
                        <FeedbackMetricBar label="Clarity" score={analysisResult.clarityScore} />
                        <FeedbackMetricBar label="Engagement" score={analysisResult.engagementScore} />
                        <FeedbackMetricBar label="Time Management" score={analysisResult.timeManagementScore} />
                        <FeedbackMetricBar label="Use of Filler Words" score={analysisResult.fillerWordsScore} />
                         <div className="flex items-center justify-between pt-2">
                            <p className="text-sm font-medium text-muted-foreground">Speaking Pace</p>
                            <p className="text-sm font-bold">{analysisResult.speakingPaceWPM} WPM</p>
                        </div>
                      </div>
                    </Card>

                    <div className="space-y-4 pt-4">
                        <CardTitle className="text-lg">Detailed Analysis</CardTitle>
                        <FeedbackDetailCard icon={<Zap size={20}/>} title="Structure &amp; Flow" content={analysisResult.structureFeedback} />
                        <FeedbackDetailCard icon={<MessageSquare size={20}/>} title="Clarity" content={analysisResult.clarityFeedback} />
                        <FeedbackDetailCard icon={<ThumbsUp size={20}/>} title="Engagement" content={analysisResult.engagementFeedback} />
                        <FeedbackDetailCard icon={<Clock size={20}/>} title="Pacing &amp; Time Management" content={`${analysisResult.paceFeedback} ${analysisResult.timeManagementFeedback}`} />
                        {analysisResult.fillerWordsFound.length > 0 && <FeedbackDetailCard icon={<BookOpen size={20}/>} title="Filler Words" content={`The following filler words were detected: ${analysisResult.fillerWordsFound.join(', ')}.`} />}
                    </div>

                    {displayedTranscript && (
                      <div className="mt-4">
                        <div className="relative">
                          <h4 className="text-md font-semibold mb-1">Your Transcript</h4>
                          <p className="text-sm text-muted-foreground bg-muted p-3 pr-10 rounded-md border whitespace-pre-wrap">{displayedTranscript}</p>
                          <Button variant="ghost" size="icon" className="absolute top-0 right-0" onClick={handleCopyTranscript}>
                            {hasCopied ? <CopyCheck className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                    )}
                    <Alert variant="default" className="mt-3 bg-blue-50 border-blue-200 text-blue-800">
                        <Info className="h-4 w-4 !text-blue-800" />
                        <AlertTitle>Video is Temporary</AlertTitle>
                        <AlertDescription>
                            This video is not saved permanently. Download it now if you wish to keep a copy.
                        </AlertDescription>
                    </Alert>
                    {!modelSuggestion && (
                        <div className="pt-4 mt-4 border-t">
                            <Button onClick={onGetModelSuggestion} variant="outline" className="w-full sm:w-auto border-accent text-accent-foreground hover:bg-accent/10 mt-2 gap-1" disabled={isLoadingSuggestion}>
                                {isLoadingSuggestion ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb size={18} />}
                                Show Model Suggestion
                            </Button>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                  <Button onClick={onRetryPractice} variant="outline" className="gap-2">
                    <RefreshCw size={16} />
                    Retry
                  </Button>
                  <Button onClick={onEndPractice}>End Practice &amp; Start New</Button>
                </CardFooter>
            </Card>

            {modelSuggestion && (
                <Card className="shadow-xl animate-in fade-in duration-500 mt-4">
                    <CardHeader>
                        <CardTitle className="text-xl font-semibold flex items-center text-indigo-600 gap-1">
                            <BrainCircuit size={20} className="mr-1" />Model Outline Suggestion
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-muted-foreground bg-indigo-50 p-4 rounded-md border border-indigo-200 whitespace-pre-wrap">
                          {modelSuggestion}
                        </div>
                    </CardContent>
                </Card>
            )}
        </>
      )}
    </div>
  );
}
