
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  Send,
  SkipForward,
  RefreshCcw,
  Lightbulb,
  CheckCircle,
  Video,
  VideoOff,
  AlertCircle,
  Eye,
  EyeOff,
  Award,
  BarChartHorizontal,
  Target,
  MoreVertical,
  Download,
  FileText,
  Info,
  Mic,
  X,
  Clapperboard,
  MicOff,
} from 'lucide-react';
import type { EvaluateAnswerOutput } from '@/ai/flows/evaluate-answer';
import type { AnalyzeCommunicationOutput } from '@/ai/flows/analyze-communication-flow';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


type InterviewAreaProps = {
  question: string;
  questionNumber: number;
  totalQuestions: number;
  onSubmitAnswer: (answer: string, voiceRecordingDuration: number, recordedVideoUrl?: string | null) => Promise<void>;
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
  isCustomQuestion: boolean;
};

const EXPECTED_ANSWER_TIME_SECONDS = 120;

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
  isCustomQuestion,
}: InterviewAreaProps) {
  // Shared state
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  const [practiceMode, setPracticeMode] = useState<'audio' | 'video'>('audio');
  const { toast } = useToast();

  // Video Mode State
  const [answer, setAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const chosenMimeTypeRef = useRef<string>('video/webm');
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState<number>(0);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio Mode State (Web Speech API)
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [isAudioSupported, setIsAudioSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [finalTranscript, setFinalTranscript] = useState('');
  const audioRecordingStartTimeRef = useRef<number | null>(null);
  const [audioRecordingDuration, setAudioRecordingDuration] = useState(0);
  const liveTranscriptRef = useRef('');
  const isForcedStopRef = useRef(false);

  // This effect creates and destroys the stream based on practice mode
  useEffect(() => {
    if (practiceMode === 'video') {
      let isMounted = true;
      const enableCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          if (isMounted) {
            videoStreamRef.current = stream;
            setHasCameraPermission(true);
          } else {
            stream.getTracks().forEach(track => track.stop());
          }
        } catch (error) {
          if (isMounted) {
            console.error('Error accessing camera/microphone:', error);
            setHasCameraPermission(false);
            toast({
              variant: 'destructive',
              title: 'Device Access Denied',
              description: 'Video practice requires camera and mic access. Please enable it in browser settings.',
            });
          }
        }
      };
      enableCamera();
      return () => {
        isMounted = false;
        if (videoStreamRef.current) {
          videoStreamRef.current.getTracks().forEach(track => track.stop());
          videoStreamRef.current = null;
        }
        setHasCameraPermission(null);
      };
    }
  }, [practiceMode, toast]);
  
  // This effect attaches the stream to the video element for preview
  useEffect(() => {
    const videoElement = videoPreviewRef.current;
    if (practiceMode === 'video' && videoElement && videoStreamRef.current) {
      if (showVideoPreview) {
        videoElement.srcObject = videoStreamRef.current;
      } else {
        videoElement.srcObject = null;
      }
    }
  }, [practiceMode, showVideoPreview, hasCameraPermission]);


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
        let final = finalTranscript;
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                final += event.results[i][0].transcript;
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        liveTranscriptRef.current = final + interim;
        setLiveTranscript(final + interim);
    };

    recognition.onstart = () => {
        setIsListening(true);
        if (!audioRecordingStartTimeRef.current) {
            audioRecordingStartTimeRef.current = Date.now();
            toast({ title: 'Listening...', description: 'Start speaking now.' });
        }
    };

    recognition.onend = () => {
        // Only truly stop if the user forced it
        if (isForcedStopRef.current) {
            setIsListening(false);
            setFinalTranscript(liveTranscriptRef.current); // Save final transcript
            if (audioRecordingStartTimeRef.current) {
                const duration = Math.round((Date.now() - audioRecordingStartTimeRef.current) / 1000);
                setAudioRecordingDuration(duration);
            }
            audioRecordingStartTimeRef.current = null;
            isForcedStopRef.current = false; // Reset for next time
        } else if (isListening) {
            // If it stopped naturally (e.g., silence), restart it
            try {
                recognitionRef.current?.start();
            } catch (error) {
                console.error("Error restarting recognition:", error);
                setIsListening(false);
            }
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        let title = 'Recognition Error';
        let description = `An error occurred: ${event.error}. Try again or use Video Mode.`;

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            title = 'Microphone Permission Denied';
            description = 'Audio practice requires microphone access. Please enable it in your browser settings for this site and try again.';
        } else if (event.error === 'no-speech') {
            title = 'No Speech Detected';
            description = 'I didn\'t hear anything. Please make sure your microphone is working and try again.';
        }
        
        toast({ 
            variant: 'destructive', 
            title: title, 
            description: description,
            duration: 7000,
        });
        setIsListening(false);
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null; // Prevent onend from firing during cleanup
        recognitionRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalTranscript, isListening]);

  // Effect to reset state when the question changes
  useEffect(() => {
    // Shared resets
    setShowEvaluation(false);
    setShowModelAnswer(false);
    cancelCountdown();

    // Video resets
    setAnswer('');
    setRecordedVideoUrl(prevUrl => { if (prevUrl) URL.revokeObjectURL(prevUrl); return null; });
    if (isRecording && mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    setIsTranscribing(false);
    setRecordingStartTime(null);
    setRecordingDurationSeconds(0);
    mediaChunksRef.current = [];
    
    // Audio resets
    isForcedStopRef.current = true;
    if (recognitionRef.current) {
        recognitionRef.current.stop();
    }
    setIsListening(false);
    setLiveTranscript('');
    setFinalTranscript('');
    liveTranscriptRef.current = '';
    setAudioRecordingDuration(0);
    audioRecordingStartTimeRef.current = null;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]);

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
  };

  const startRecording = async () => {
     try {
        if (!videoStreamRef.current) {
          throw new Error("Camera stream not available. Cannot start recording.");
        }
        const mimeTypeOptions = ['video/webm;codecs=vp9,opus', 'video/webm'];
        let chosenMimeType = mimeTypeOptions.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
        chosenMimeTypeRef.current = chosenMimeType;
        
        mediaRecorderRef.current = new MediaRecorder(videoStreamRef.current, { mimeType: chosenMimeType });

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) mediaChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstart = () => {
          setIsRecording(true);
          setRecordingStartTime(Date.now());
          toast({ title: "Recording Started", description: "Record your video answer. Click camera again to stop."});
        };

        mediaRecorderRef.current.onstop = async () => {
          setIsRecording(false);
          setIsTranscribing(true);
          toast({ title: "Recording Stopped", description: "Processing your answer..." });
          if (recordingStartTime) setRecordingDurationSeconds(Math.round((Date.now() - recordingStartTime) / 1000));
          setRecordingStartTime(null);

          if (mediaChunksRef.current.length === 0) {
            toast({ title: "No Data Recorded", variant: "destructive" });
            setIsTranscribing(false);
            return;
          }

          const mediaBlob = new Blob(mediaChunksRef.current, { type: chosenMimeType });
          setRecordedVideoUrl(URL.createObjectURL(mediaBlob));
          
          const formData = new FormData();
          formData.append('audio', mediaBlob, `recording.webm`);

          try {
            const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ error: "Unknown server error" }));
              throw new Error(errorData.error || `Server error: ${response.status}`);
            }
            const result = await response.json();
            setAnswer(result.transcript);
            toast({ title: "Transcription Complete!", description: "Your answer is ready to submit."});
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error.";
            toast({ title: "Transcription Failed", description: message, variant: "destructive" });
            setAnswer('');
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

  const handleRecordButtonClick = async () => {
    if (countdown !== null) { cancelCountdown(); return; }
    if (isTranscribing) { toast({ title: "Busy", description: "Please wait for transcription to complete." }); return; }
    if (hasCameraPermission === false) { toast({ title: "Permissions Required", description: "Camera and microphone access is needed to record.", variant: "destructive" }); return; }
    if (!videoStreamRef.current || !videoStreamRef.current.active) { toast({ title: "Error", description: "Camera stream not available or inactive. Try refreshing.", variant: "destructive" }); return; }
    if (isRecording) {
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
    } else {
      setAnswer('');
      setRecordingDurationSeconds(0);
      mediaChunksRef.current = [];
      if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
      startCountdown();
    }
  };

  const handleAudioRecordClick = () => {
    if (!isAudioSupported) {
        toast({ variant: 'destructive', title: 'Audio Mode Not Supported', description: 'Please use a different browser like Chrome or use Video Mode.' });
        return;
    }
    if (!recognitionRef.current) return;
    
    if (isListening) {
      isForcedStopRef.current = true;
      recognitionRef.current.stop();
    } else {
      isForcedStopRef.current = false;
      setLiveTranscript('');
      setFinalTranscript('');
      liveTranscriptRef.current = '';
      setAudioRecordingDuration(0);
      audioRecordingStartTimeRef.current = null;
      recognitionRef.current.start();
    }
  };

  const handleSubmit = async () => {
    if (practiceMode === 'video') {
      if (isLoadingEvaluation || isRecording || isTranscribing || countdown !== null) return;
      if (!answer.trim() && !recordedVideoUrl) { toast({title: "No Answer Content", description: "Please record your answer."}); return; }
      if (!answer.trim() && recordedVideoUrl) toast({title: "Submitting Video", description: "Submitting video without transcribed text. AI text analysis will be limited."});
      await onSubmitAnswer(answer, recordingDurationSeconds, recordedVideoUrl);
    } else {
      if (isLoadingEvaluation || isListening) return;
      if (!finalTranscript.trim()) { toast({title: "No Answer Content", description: "Please record an audio answer."}); return; }
      await onSubmitAnswer(finalTranscript, audioRecordingDuration, null);
    }
    setShowEvaluation(true);
  };

  const handleGetModel = async () => {
    if (isLoadingModelAnswer || isRecording || isTranscribing || isListening) return;
    await onGetModelAnswer();
    setShowModelAnswer(true);
  };

  const handleDownloadVideo = () => {
    if (!recordedVideoUrl) return;
    const a = document.createElement('a');
    a.href = recordedVideoUrl;
    a.download = `career-confidence-interview-${new Date().toISOString()}.webm`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast({ title: 'Video Download Started' });
  };

  const handleDownloadTranscript = () => {
    const transcriptToDownload = practiceMode === 'video' ? answer : finalTranscript;
    if (!transcriptToDownload.trim()) return;
    const blob = new Blob([transcriptToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `career-confidence-transcript-${new Date().toISOString()}.txt`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Transcript Download Started' });
  };

  const progressPercentage = (questionNumber / totalQuestions) * 100;
  const timeFeedback = getTimeManagementFeedback();
  function getTimeManagementFeedback() {
    if (!evaluationResult) return null;
    const duration = practiceMode === 'video' ? recordingDurationSeconds : audioRecordingDuration;
    if (duration <= 0) return null;
    if (duration < EXPECTED_ANSWER_TIME_SECONDS * 0.75) return `Your answer was brief (${duration}s). Consider elaborating. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
    if (duration > EXPECTED_ANSWER_TIME_SECONDS * 1.25) return `Your answer was a bit long (${duration}s). Try to be more concise. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
    return `Your answer duration (${duration}s) was good. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
  }
  
  const recordButtonDisabled = hasCameraPermission === false || isLoadingEvaluation || isLoadingNewQuestion || isTranscribing;
  const submitButtonDisabled = practiceMode === 'video'
    ? (!answer.trim() && !recordedVideoUrl) || isLoadingEvaluation || isLoadingNewQuestion || isRecording || isTranscribing || countdown !== null
    : !finalTranscript.trim() || isLoadingEvaluation || isLoadingNewQuestion || isListening;
    
  return (
    <TooltipProvider>
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-2xl font-semibold text-primary">Question {questionNumber} of {totalQuestions}</CardTitle>
            { practiceMode === 'video' &&
                <Tooltip>
                    <TooltipTrigger asChild><Button variant="outline" size="sm" onClick={() => setShowVideoPreview(p => !p)} className="gap-1"><EyeOff size={16}/>{showVideoPreview ? 'Hide Preview' : 'Show Preview'}</Button></TooltipTrigger>
                    <TooltipContent><p>{showVideoPreview ? 'Hide live camera preview' : 'Show live camera preview'}</p></TooltipContent>
                </Tooltip>
            }
          </div>
          <Progress value={progressPercentage} className="w-full h-2" />
          {isLoadingNewQuestion ? (
            <div className="flex items-center justify-center h-24"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-2 text-muted-foreground">Generating question...</p></div>
          ) : (
            <p className="text-xl mt-4 py-4 min-h-[6rem] leading-relaxed">{question}</p>
          )}
        </CardHeader>

        <CardContent className="relative">
          <Tabs value={practiceMode} onValueChange={(v) => setPracticeMode(v as 'audio' | 'video')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="video" disabled={hasCameraPermission === false}><Clapperboard className="mr-2 h-5 w-5"/>Video Practice</TabsTrigger>
              <TabsTrigger value="audio" disabled={!isAudioSupported}><Mic className="mr-2 h-5 w-5"/>Audio Practice (Free)</TabsTrigger>
            </TabsList>

            <TabsContent value="video">
              {hasCameraPermission === null && (<Alert variant="default"><AlertDescription>Checking camera permissions...</AlertDescription></Alert>)}
              {hasCameraPermission === false && (<Alert variant="destructive"><AlertTitle>Device Access Required</AlertTitle><AlertDescription>Camera and microphone access is required for video practice. Enable permissions in your browser. Audio practice may still be available.</AlertDescription></Alert>)}
              {
                <div className={`mb-4 rounded-md overflow-hidden shadow-inner border bg-black relative ${!showVideoPreview || practiceMode !== 'video' ? 'hidden' : ''}`}>
                  <video ref={videoPreviewRef} className="w-full aspect-video" autoPlay muted playsInline />
                  {countdown !== null && (<div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50"><span className="text-8xl font-bold text-white" style={{textShadow: '0 0 10px rgba(0,0,0,0.7)'}}>{countdown}</span></div>)}
                </div>
              }
              {isRecording && (<div className="absolute top-16 left-1/2 -translate-x-1/2 bg-red-600 text-white px-3 py-1 rounded-full text-xs flex items-center shadow-lg animate-pulse z-10"><Video size={14} className="mr-1" /> REC</div>)}
              {isTranscribing && (<div className="absolute top-16 left-1/2 -translate-x-1/2 bg-purple-600 text-white px-3 py-1 rounded-full text-xs flex items-center shadow-lg animate-pulse z-10"><Loader2 size={14} className="mr-1 animate-spin" /> TRANSCRIBING...</div>)}
              <div className={`min-h-[50px] p-3 rounded-md border bg-muted text-muted-foreground ${answer.trim() ? 'text-foreground' : ''}`}>{answer.trim() ? answer : "Transcribed text from video will appear here..."}</div>
              {(!isRecording && !isTranscribing && !answer.trim() && !recordedVideoUrl && hasCameraPermission) && (<div className="text-center text-muted-foreground py-4">Click the video camera below to start recording.</div>)}
              {(!isRecording && !isTranscribing && (answer.trim() || recordedVideoUrl) && hasCameraPermission) && (<div className="text-center text-green-600 py-4 flex items-center justify-center"><CheckCircle size={20} className="mr-2"/> Answer recorded. Ready to submit.</div>)}
            </TabsContent>

            <TabsContent value="audio">
                <div className="flex flex-col items-center justify-center space-y-4">
                  <div className={`w-full min-h-[50px] p-3 rounded-md border bg-muted text-muted-foreground ${liveTranscript.trim() ? 'text-foreground' : ''}`}>{liveTranscript.trim() ? liveTranscript : "Your live transcript will appear here..."}</div>
                  <Button onClick={handleAudioRecordClick} variant={isListening ? 'destructive' : 'outline'} size="lg" disabled={isLoadingEvaluation || isLoadingNewQuestion} className="rounded-full py-3 px-6 gap-2">
                    {isListening ? <MicOff size={24}/> : <Mic size={24} />}
                    <span className="ml-0 text-base">{isListening ? "Stop Listening" : "Start Listening"}</span>
                  </Button>
                  {!isListening && finalTranscript && <div className="text-center text-green-600 pt-2 flex items-center justify-center"><CheckCircle size={16} className="mr-2"/> Ready to submit.</div>}
                  {!isAudioSupported && <Alert variant="destructive"><AlertTitle>Audio Not Supported</AlertTitle><AlertDescription>Your browser doesn't support live transcription. Try Chrome/Edge or use Video Mode.</AlertDescription></Alert>}
                </div>
            </TabsContent>
          </Tabs>
        </CardContent>

        {!showEvaluation && !isLoadingNewQuestion && (
          <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-4">
            <div className="flex gap-2 w-full sm:w-auto">
              <Tooltip><TooltipTrigger asChild><Button onClick={onRegenerateQuestion} variant="outline" disabled={recordButtonDisabled || isRecording || isCustomQuestion} className="gap-1"><RefreshCcw size={18} /> Regenerate</Button></TooltipTrigger><TooltipContent><p>{isCustomQuestion ? 'Cannot regenerate your own question' : 'Get a different question.'}</p></TooltipContent></Tooltip>
              <Tooltip><TooltipTrigger asChild><Button onClick={onSkipQuestion} variant="outline" disabled={recordButtonDisabled || isRecording || isCustomQuestion} className="gap-1"><SkipForward size={18} /> Skip</Button></TooltipTrigger><TooltipContent><p>{isCustomQuestion ? 'Cannot skip your own question' : 'Skip this question.'}</p></TooltipContent></Tooltip>
            </div>
            <div className="flex gap-2 w-full sm:w-auto items-center">
              {practiceMode === 'video' && 
                <Tooltip>
                  <TooltipTrigger asChild><Button onClick={handleRecordButtonClick} variant={isRecording || countdown !== null ? "destructive" : "outline"} size="lg" disabled={recordButtonDisabled} aria-label={isRecording ? "Stop video" : (countdown !== null ? "Cancel" : "Start video")} className={`${isRecording ? "bg-red-500 hover:bg-red-600 text-white" : ""} py-3 px-6 rounded-full gap-2`}>{isRecording ? <VideoOff size={24} /> : (countdown !== null ? <X size={24} /> : <Video size={24} />)}<span className="ml-0 text-base">{isRecording ? "Stop" : (countdown !== null ? "Cancel" : (isTranscribing ? "Processing" : "Record"))}</span></Button></TooltipTrigger>
                  <TooltipContent><p>{isRecording ? "Stop video recording" : (isTranscribing ? "Processing video..." : "Start video recording")}</p></TooltipContent>
                </Tooltip>
              }
              <Button onClick={handleSubmit} disabled={submitButtonDisabled} className="flex-grow sm:flex-grow-0 gap-1" size="lg">
                {isLoadingEvaluation ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send size={20} />}
                Submit Answer
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>

      {isLoadingEvaluation && ( <Card className="shadow-xl mt-4"><CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]"><Loader2 className="h-12 w-12 animate-spin text-primary mb-4" /><p className="text-muted-foreground text-lg">Analyzing your answer...</p></CardContent></Card> )}

      {showEvaluation && evaluationResult && !isLoadingEvaluation && (
        <Card className="shadow-xl animate-in fade-in duration-500">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2"><Award size={24}/> Performance Feedback</CardTitle>
            <Alert variant={evaluationResult.score >= 70 ? "default" : "destructive"} className="mt-2 border-2"><Badge variant={evaluationResult.score >=70 ? 'default': 'destructive'} className="text-lg">Score: {evaluationResult.score}/100</Badge></Alert>
          </CardHeader>
          <CardContent className="space-y-4">
            {practiceMode === 'video' && recordedVideoUrl && (
              <div>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-lg font-semibold">Your Recorded Answer</h3>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /><span className="sr-only">More</span></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleDownloadVideo}><Download className="mr-2 h-4 w-4" /><span>Download Video</span></DropdownMenuItem>
                        <DropdownMenuItem onClick={handleDownloadTranscript} disabled={!answer.trim()}><FileText className="mr-2 h-4 w-4" /><span>Download Transcript</span></DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <video src={recordedVideoUrl} controls className="w-full rounded-md shadow-md aspect-video bg-black"></video>
              </div>
            )}
             <div>
                <h3 className="text-lg font-semibold">Your Answer Transcript</h3>
                <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md border whitespace-pre-wrap">{practiceMode === 'video' ? (answer || '(No text was transcribed)') : (finalTranscript || '(No text was recorded)')}</p>
             </div>
             {practiceMode === 'video' && recordedVideoUrl && (<Alert variant="default" className="mt-3 bg-blue-50 border-blue-200 text-blue-800"><Info className="h-4 w-4 !text-blue-800" /><AlertTitle>Video is Temporary</AlertTitle><AlertDescription>This video is not saved permanently. Download it now if you wish to keep a copy.</AlertDescription></Alert>)}
            <div>
              <h3 className="text-lg font-semibold flex items-center text-green-600"><CheckCircle size={20} className="mr-2" />Strengths</h3>
              <p className="text-muted-foreground bg-green-50 p-3 rounded-md border border-green-200">{evaluationResult.strengths}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold flex items-center text-red-600"><AlertCircle size={20} className="mr-2" />Areas for Improvement</h3>
              <p className="text-muted-foreground bg-red-50 p-3 rounded-md border border-red-200">{evaluationResult.weaknesses}</p>
            </div>

            {communicationAnalysisResult && (
              <div className="space-y-3 pt-3 border-t mt-4">
                <h3 className="text-xl font-semibold flex items-center text-primary gap-1"><BarChartHorizontal size={22} className="mr-1" />Communication Analysis</h3>
                <div className="space-y-1">
                  <p><strong className="font-medium">Clarity:</strong> {communicationAnalysisResult.clarityFeedback}</p>
                  <p><strong className="font-medium">Confidence Cues:</strong> {communicationAnalysisResult.confidenceCues}</p>
                  <p><strong className="font-medium">Speaking Pace:</strong> {communicationAnalysisResult.speakingPaceWPM} WPM. {communicationAnalysisResult.paceFeedback}</p>
                  {communicationAnalysisResult.fillerWordsFound.length > 0 && (<p><strong className="font-medium">Filler Words Found:</strong> {communicationAnalysisResult.fillerWordsFound.join(', ')}</p>)}
                  {timeFeedback && <p><strong className="font-medium">Time Management:</strong> {timeFeedback}</p>}
                </div>
              </div>
            )}
             {(!answer.trim() && recordedVideoUrl) && (<Alert variant="default" className="mt-3"><AlertCircle className="h-4 w-4" /><AlertTitle>Note on Text Analysis</AlertTitle><AlertDescription>No text was transcribed from your video. AI analysis may be limited.</AlertDescription></Alert>)}
            {!modelAnswerText && (<Tooltip><TooltipTrigger asChild><Button onClick={handleGetModel} variant="outline" className="w-full sm:w-auto border-accent text-accent-foreground hover:bg-accent/10 mt-2 gap-1" disabled={isLoadingModelAnswer || isRecording || isTranscribing} >{isLoadingModelAnswer ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : (<Lightbulb size={18} />)}Show Model Answer</Button></TooltipTrigger><TooltipContent><p>Get an AI-generated ideal answer for this question.</p></TooltipContent></Tooltip>)}
          </CardContent>
        </Card>
      )}

      {showModelAnswer && modelAnswerText && !isLoadingEvaluation && (
         <Card className="shadow-xl animate-in fade-in duration-500 mt-4"><CardHeader className="flex flex-row justify-between items-center"><CardTitle className="text-xl font-semibold flex items-center text-indigo-600 gap-1"><Target size={20} className="mr-1" />Model Answer</CardTitle></CardHeader><CardContent><p className="text-muted-foreground bg-indigo-50 p-3 rounded-md border border-indigo-200">{modelAnswerText}</p></CardContent></Card>
      )}

      {showEvaluation && !isLoadingEvaluation && (
        <div className="mt-6 flex justify-end">
          {isLastQuestion ? (<Button onClick={onFinishInterview} size="lg" className="bg-green-500 hover:bg-green-600 gap-1">Finish Interview <Award size={20} className="ml-2"/></Button>) : (<Button onClick={onNextQuestion} size="lg" className="gap-1">Next Question <SkipForward size={20} className="ml-2"/></Button>)}
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
