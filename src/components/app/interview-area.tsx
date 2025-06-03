
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send, SkipForward, RefreshCcw, Lightbulb, CheckCircle, XCircle, Target, Award, Mic, MicOff, Play, Square, Video, VideoOff, Eye, Info, Zap, BarChartHorizontal } from 'lucide-react';
import type { EvaluateAnswerOutput } from '@/ai/flows/evaluate-answer';
import type { AnalyzeCommunicationOutput } from '@/ai/flows/analyze-communication-flow';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


type InterviewAreaProps = {
  question: string;
  questionNumber: number;
  totalQuestions: number;
  onSubmitAnswer: (answer: string, recordingDurationSeconds: number, recordedVideoUrl: string | null) => Promise<void>;
  onSkipQuestion: () => void;
  onRegenerateQuestion: () => void;
  onGetModelAnswer: () => Promise<void>;
  onNextQuestion: () => void;
  onFinishInterview: () => void;
  isLoadingEvaluation: boolean; // Covers both eval and comms
  isLoadingModelAnswer: boolean;
  isLoadingNewQuestion: boolean;
  evaluationResult: EvaluateAnswerOutput | null;
  communicationAnalysisResult: AnalyzeCommunicationOutput | null;
  modelAnswerText: string | null;
  isLastQuestion: boolean;
};

const EXPECTED_ANSWER_TIME_SECONDS = 120; // 2 minutes, for example

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
}: InterviewAreaProps) {
  const [answer, setAnswer] = useState('');
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  
  const [isSpeechToTextRecording, setIsSpeechToTextRecording] = useState(false);
  const [speechApiSupported, setSpeechApiSupported] = useState(true);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  
  const [isSpeakingModelAnswer, setIsSpeakingModelAnswer] = useState(false);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] = useState(true);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null); 
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [isVideoRecordingActive, setIsVideoRecordingActive] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState<number>(0);

  const { toast } = useToast();

  useEffect(() => {
    const requestPermissionsAndStream = async () => {
      if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("Media devices API not supported.");
        if (typeof window !== 'undefined') { // Check for window again for client-side toast
            toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'Camera/Microphone access is not supported by your browser.' });
        }
        setHasCameraPermission(false);
        return;
      }
      try {
        console.log("Attempting to get user media (video & audio)...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log("User media stream obtained.");
        setVideoStream(stream);
        setHasCameraPermission(true);
      } catch (error) {
        console.error('Error accessing camera/microphone:', error);
        setHasCameraPermission(false);
        toast({
            variant: 'destructive',
            title: 'Camera/Mic Access Denied',
            description: 'Please enable camera/microphone permissions in your browser settings and refresh the page to use recording features. If it still fails, try closing other apps that might be using the camera/mic.',
            duration: 10000,
        });
      }
    };
    requestPermissionsAndStream();
    
    return () => {
      console.log("Cleaning up InterviewArea: stopping media streams, recorder, and revoking object URL.");
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      if (recordedVideoUrl && typeof recordedVideoUrl === 'string' && recordedVideoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        console.log("Video stream tracks stopped on cleanup.");
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (hasCameraPermission === true && videoStream && videoPreviewRef.current) {
      console.log("Attaching video stream to preview element.");
      videoPreviewRef.current.srcObject = videoStream;
      videoPreviewRef.current.play().catch(error => {
        console.warn("Video preview autoplay was prevented:", error);
         toast({
           title: "Video Preview Info",
           description: "Video autoplay might require user interaction if blocked by the browser.",
           variant: "default",
         });
      });
    }
  }, [hasCameraPermission, videoStream, toast]);


  useEffect(() => {
    setAnswer('');
    setShowEvaluation(false);
    setShowModelAnswer(false);
    setIsSpeakingModelAnswer(false);
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    setRecordingStartTime(null);
    setRecordingDurationSeconds(0);

    if (speechRecognitionRef.current && isSpeechToTextRecording) {
      console.log("Question changed: Stopping active speech recognition.");
      speechRecognitionRef.current.stop();
    }
    if (mediaRecorderRef.current && isVideoRecordingActive) {
      console.log("Question changed: Stopping active video recording.");
      mediaRecorderRef.current.stop(); 
    }
    if (recordedVideoUrl) { 
      console.log("Question changed: Revoking old recorded video URL.");
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }
    recordedChunksRef.current = [];

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]); 

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("SpeechRecognition API not supported by this browser.");
      setSpeechApiSupported(false);
      return; 
    }
    setSpeechApiSupported(true);
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true; 
    recognition.interimResults = false; 
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        console.log("SpeechRecognition: onstart fired.");
        setIsSpeechToTextRecording(true);
    };

    recognition.onresult = (event) => {
      console.log("SpeechRecognition: onresult fired.", event.results);
      let newTranscriptPart = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) { 
              newTranscriptPart += event.results[i][0].transcript.trim() + " ";
          }
      }
      if (newTranscriptPart.trim()) {
          console.log("SpeechRecognition: Transcript part:", newTranscriptPart);
          setAnswer(prev => (prev ? prev.trim() + ' ' : '') + newTranscriptPart.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error("SpeechRecognition: onerror fired.", event.error, event.message);
      setIsSpeechToTextRecording(false); // Ensure state is reset
      let errorMessage = `Speech recognition error: ${event.error}.`;
      if (event.message) errorMessage += ` Message: ${event.message}`;

      if (event.error === 'no-speech') {
        errorMessage = "No speech was detected. Please ensure your microphone is unmuted, the volume is adequate, you're speaking clearly, and there isn't excessive background noise. Also, try closing other applications that might be using the microphone.";
      } else if (event.error === 'audio-capture') {
        errorMessage = "Audio capture failed. Ensure your microphone is properly connected, configured in your OS, and not being used exclusively by another application.";
      } else if (event.error === 'not-allowed') {
        errorMessage = "Microphone access was denied or disallowed by the browser or OS. Please check permissions in your browser settings for this site and ensure your OS allows microphone access for this browser. You might need to refresh the page after granting permissions.";
      } else if (event.error === 'network') {
        errorMessage = "A network error occurred during speech recognition. Please check your internet connection as some speech services rely on it.";
      } else if (event.error === 'aborted') {
        errorMessage = "Speech recognition was aborted. This might happen if you navigate away or if another action interrupted it. Please try again.";
      } else if (event.error === 'service-not-allowed') {
        errorMessage = "The speech recognition service is not allowed or unavailable. This could be due to browser/OS settings, policy restrictions, or a temporary service issue."
      }
      
      toast({ title: "Voice Input Error", description: errorMessage, variant: "destructive", duration: 10000 });
    };

    recognition.onend = () => {
      console.log("SpeechRecognition: onend fired.");
      setIsSpeechToTextRecording(false);
    };
    speechRecognitionRef.current = recognition;
    
    if (!('speechSynthesis' in window)) {
      console.warn("SpeechSynthesis API not supported by this browser.");
      setSpeechSynthesisSupported(false);
    } else {
      setSpeechSynthesisSupported(true);
    }
    
    return () => {
      if (speechRecognitionRef.current) {
        console.log("Cleaning up SpeechRecognition instance.");
        speechRecognitionRef.current.abort(); 
      }
      if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); 

  const startFullRecording = () => {
    console.log("Start full recording. Permissions: Camera=", hasCameraPermission, "Speech API Supported=", speechApiSupported);
    if (hasCameraPermission === null) {
        toast({ title: "Permissions Pending", description: "Please wait for camera/microphone permission check.", variant: "default" });
        return;
    }
    // Stricter check: if camera permission is false, and speech API is not supported, then definitely cannot record.
    // If camera is false BUT speech API IS supported, voice-only might be possible if SpeechRecognition can grab mic.
    if (hasCameraPermission === false && !speechApiSupported) {
         toast({ title: "Features Unavailable", description: "Voice and video input require camera/microphone access and browser support.", variant: "destructive"});
         return;
    }

    if (recordedVideoUrl) { 
        console.log("Revoking previous recorded video URL before new recording.");
        URL.revokeObjectURL(recordedVideoUrl);
        setRecordedVideoUrl(null);
    }
    recordedChunksRef.current = []; 
    setRecordingStartTime(Date.now());
    setRecordingDurationSeconds(0);
    setAnswer(''); 
    console.log("Starting full recording. Cleared answer, reset timers.");

    let attemptedSpeechStart = false;
    let attemptedVideoStart = false;

    // Try to start speech recognition
    if (speechRecognitionRef.current && speechApiSupported) {
      // Check if already recording speech, though toggle logic should prevent this
      if(isSpeechToTextRecording) {
        console.log("Speech recognition is already active, not starting again.");
      } else {
        try {
          console.log("Attempting to start SpeechRecognition.");
          speechRecognitionRef.current.start();
          attemptedSpeechStart = true; 
          // setIsSpeechToTextRecording(true) will be set by onstart
        } catch (e: any) {
          console.error("Error starting speech recognition:", e);
          toast({ title: "Speech Error", description: `Could not start voice input: ${e.message || e.name || 'Unknown error'}. Ensure microphone is available.`, variant: "destructive" });
          setIsSpeechToTextRecording(false); 
        }
      }
    } else if (!speechApiSupported) {
        console.log("Speech API not supported, skipping speech start.");
    }

    // Try to start video recording
    if (hasCameraPermission === true && videoStream && !isVideoRecordingActive) {
      try {
        console.log("Attempting to start MediaRecorder.");
        mediaRecorderRef.current = new MediaRecorder(videoStream, { mimeType: 'video/webm' });
        
        mediaRecorderRef.current.onstart = () => {
            console.log("MediaRecorder: onstart fired.");
            setIsVideoRecordingActive(true);
        };

        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorderRef.current.onstop = () => {
          console.log("MediaRecorder: onstop fired.");
          if (recordedChunksRef.current.length > 0) {
            const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(videoBlob);
            setRecordedVideoUrl(url);
          } else {
            console.log("MediaRecorder: onstop fired but no data chunks recorded.");
            setRecordedVideoUrl(null); // Ensure no old URL persists
          }
          setIsVideoRecordingActive(false); 
          if (recordingStartTime) { 
              setRecordingDurationSeconds(Math.round((Date.now() - recordingStartTime) / 1000));
          }
        };
        
        mediaRecorderRef.current.start();
        attemptedVideoStart = true;
      } catch (e: any) {
         console.error("MediaRecorder setup/start failed:", e);
         toast({title: "Video Recording Error", description: `Could not start video recording: ${e.message || 'Unknown error'}. Ensure camera is available.`, variant: "destructive"});
         setIsVideoRecordingActive(false);
      }
    } else if (hasCameraPermission !== true) {
        console.log("Camera permission not granted or stream not available, skipping video start.");
    } else if (isVideoRecordingActive) {
        console.log("Video recording is already active, not starting again.");
    }
    
    if (attemptedSpeechStart && attemptedVideoStart) {
        toast({ title: "Recording Started", description: "Video and voice input active. Click mic again to stop."});
    } else if (attemptedSpeechStart) {
        toast({ title: "Voice Recording Started", description: "Voice input active. Click mic again to stop. (Video not active due to permissions or issue)"});
    } else if (attemptedVideoStart) {
        toast({ title: "Video Recording Started", description: "Video recording active. Click mic again to stop. (Voice input not active or not supported)"});
    } else if (!attemptedSpeechStart && !attemptedVideoStart && (hasCameraPermission === false && speechApiSupported)) {
         toast({ title: "Voice Recording Only?", description: "Trying voice recording as camera is not permitted. Click mic to stop.", variant: "default" });
    } else if (!attemptedSpeechStart && !attemptedVideoStart && hasCameraPermission === true && !videoStream ) {
         toast({ title: "Camera Not Ready", description: "Camera stream initializing. Please wait a moment.", variant: "default" });
    } else if (!attemptedSpeechStart && !attemptedVideoStart && (hasCameraPermission === false || !speechApiSupported)) {
        toast({ title: "Recording Not Started", description: "Could not start recording due to permission or support issues for both video and voice.", variant: "destructive"});
    }
  };

  const stopFullRecording = () => {
    console.log("Attempting to stop full recording.");
    if (recordingStartTime) {
        const duration = Math.round((Date.now() - recordingStartTime) / 1000);
        setRecordingDurationSeconds(duration); 
        console.log(`Recording duration: ${duration}s`);
    }

    let speechWasActive = false;
    if (speechRecognitionRef.current && isSpeechToTextRecording) {
      console.log("Stopping SpeechRecognition.");
      speechRecognitionRef.current.stop(); 
      speechWasActive = true;
      // setIsSpeechToTextRecording(false) will be set by onend
    }
    
    let videoWasActive = false;
    if (mediaRecorderRef.current && isVideoRecordingActive) {
      console.log("Stopping MediaRecorder.");
      mediaRecorderRef.current.stop(); 
      videoWasActive = true;
      // setIsVideoRecordingActive(false) and URL creation will be handled by onstop
    }
    
    if (videoWasActive && speechWasActive) {
        toast({ title: "Recording Stopped", description: "Processing audio and video..."});
    } else if (speechWasActive) {
        toast({ title: "Voice Recording Stopped", description: "Processing audio..." });
    } else if (videoWasActive) {
        toast({ title: "Video Recording Stopped", description: "Processing video..." });
    } else {
        console.log("Stop called, but no active recording found (or already stopping).");
    }
    
    setRecordingStartTime(null); 
  };

  const toggleRecording = () => {
    console.log("Toggle recording called. Current states: isSpeechToTextRecording:", isSpeechToTextRecording, "isVideoRecordingActive:", isVideoRecordingActive);
    if (isSpeechToTextRecording || isVideoRecordingActive) {
      stopFullRecording();
    } else {
      startFullRecording();
    }
  };

  const handleSubmit = async () => {
    if (isLoadingEvaluation || (isSpeechToTextRecording || isVideoRecordingActive)) {
      console.log("Submit attempt while busy or recording, returning.");
      toast({title: "Busy", description: "Please stop recording or wait for current analysis to finish.", variant: "default"});
      return;
    }
    
    // This explicit check is largely redundant if button is disabled correctly, but as a safeguard:
    if (isSpeechToTextRecording || isVideoRecordingActive) { 
        console.warn("Submit called while recording was indicated as active - this shouldn't happen if UI is correct. Stopping recordings.");
        stopFullRecording();
        await new Promise(resolve => setTimeout(resolve, 500)); // Allow time for stop handlers
    }
    
    console.log("Submitting answer. Text:", answer, "Duration:", recordingDurationSeconds, "Video URL:", recordedVideoUrl);
    await onSubmitAnswer(answer, recordingDurationSeconds, recordedVideoUrl || null); 
    setShowEvaluation(true);
  };

  const handleGetModel = async () => {
    if (isLoadingModelAnswer || isAnyRecordingActive) return;
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel(); 
      setIsSpeakingModelAnswer(false);
    }
    await onGetModelAnswer();
    setShowModelAnswer(true);
  }

  const handleSpeakModelAnswer = () => {
    if (typeof window === 'undefined' || !speechSynthesisSupported || !modelAnswerText) {
      toast({ title: "Speech Output Not Available", description: "Text-to-speech is not available or not supported by your browser.", variant: "destructive"});
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      setIsSpeakingModelAnswer(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(modelAnswerText);
      utterance.lang = 'en-US';
      utterance.onstart = () => setIsSpeakingModelAnswer(true);
      utterance.onend = () => setIsSpeakingModelAnswer(false);
      utterance.onerror = (event) => {
        console.error("SpeechSynthesis error:", event);
        setIsSpeakingModelAnswer(false);
        toast({ title: "Speech Error", description: `Could not play audio: ${event.error}`, variant: "destructive"});
      };
      window.speechSynthesis.speak(utterance);
    }
  };

  const progressPercentage = (questionNumber / totalQuestions) * 100;
  const isAnyRecordingActive = isSpeechToTextRecording || isVideoRecordingActive;

  const getTimeManagementFeedback = () => {
    if (!evaluationResult || recordingDurationSeconds <= 0) return null; // Also check evaluationResult to ensure feedback is relevant
    if (recordingDurationSeconds < EXPECTED_ANSWER_TIME_SECONDS * 0.75) {
      return `Your answer was quite brief (${recordingDurationSeconds}s). Consider elaborating more. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
    } else if (recordingDurationSeconds > EXPECTED_ANSWER_TIME_SECONDS * 1.25) {
      return `Your answer was a bit long (${recordingDurationSeconds}s). Try to be more concise. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
    }
    return `Your answer duration (${recordingDurationSeconds}s) was good. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
  };
  const timeFeedback = getTimeManagementFeedback();

  const micButtonDisabled = 
    hasCameraPermission === null || 
    (hasCameraPermission === false && !speechApiSupported) || // Both cam denied AND speech not supported
    isLoadingEvaluation || 
    isLoadingNewQuestion;

  const micButtonTitle = () => {
    if (hasCameraPermission === null) return "Checking permissions...";
    if (hasCameraPermission === false && !speechApiSupported) return "Video/Voice input disabled: Check permissions and browser support.";
    if (hasCameraPermission === false && speechApiSupported) return isAnyRecordingActive ? "Stop voice recording" : "Start voice recording (Video disabled due to permissions)";
    if (!speechApiSupported && hasCameraPermission === true) return isAnyRecordingActive ? "Stop video recording" : "Start video recording (Voice input not supported by browser)";
    return isAnyRecordingActive ? "Stop recording (voice & video)" : "Start voice and video input";
  };


  return (
    <TooltipProvider>
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="text-2xl font-semibold text-primary">Question {questionNumber} of {totalQuestions}</CardTitle>
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

        {hasCameraPermission === null && (
          <CardContent>
            <Alert>
              <Video className="h-5 w-5" />
              <AlertTitle>Permissions Check</AlertTitle>
              <AlertDescription>Attempting to access your camera and microphone. Please check browser prompts.</AlertDescription>
            </Alert>
          </CardContent>
        )}

        {hasCameraPermission === false && (
           <CardContent>
            <Alert variant="destructive">
              <VideoOff className="h-5 w-5" />
              <AlertTitle>Camera/Microphone Access Problem</AlertTitle>
              <AlertDescription>
                Video and/or audio recording features may be limited or disabled. Please enable camera/microphone permissions in your browser settings and refresh the page. If issues persist, ensure no other app is exclusively using the camera/mic.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
        
        {hasCameraPermission === true && videoStream && ( 
          <CardContent className="relative">
            <video ref={videoPreviewRef} muted autoPlay playsInline className="w-full aspect-video rounded-md bg-muted border shadow-inner" />
             {isVideoRecordingActive && (
                <div className="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full text-xs flex items-center shadow-lg animate-pulse">
                    <Mic size={14} className="mr-1.5" /> REC
                </div>
            )}
          </CardContent>
        )}
         {hasCameraPermission === true && !videoStream && ( 
            <CardContent>
                <Alert>
                    <Loader2 className="h-5 w-5 animate-spin"/>
                    <AlertTitle>Initializing Camera</AlertTitle>
                    <AlertDescription>Camera stream is being prepared...</AlertDescription>
                </Alert>
            </CardContent>
        )}


        {!showEvaluation && !isLoadingNewQuestion && (
          <>
            <CardContent>
              <Textarea
                placeholder="Type or use microphone to record your answer..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={6}
                className="text-base border-2 focus:border-primary transition-colors"
                disabled={isLoadingEvaluation || isLoadingNewQuestion || isAnyRecordingActive}
              />
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2">
              <div className="flex gap-2 w-full sm:w-auto">
                <Button onClick={onRegenerateQuestion} variant="outline" disabled={isLoadingEvaluation || isLoadingNewQuestion || isAnyRecordingActive}>
                  <RefreshCcw size={18} /> Regenerate
                </Button>
                <Button onClick={onSkipQuestion} variant="outline" disabled={isLoadingEvaluation || isLoadingNewQuestion || isAnyRecordingActive}>
                  <SkipForward size={18} /> Skip
                </Button>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                     <Button 
                      onClick={toggleRecording} 
                      variant={isAnyRecordingActive ? "destructive" : "outline"}
                      size="icon"
                      disabled={micButtonDisabled}
                      aria-label={isAnyRecordingActive ? "Stop recording" : "Start recording"}
                      className={isAnyRecordingActive ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                    >
                      {isAnyRecordingActive ? <MicOff size={20} /> : <Mic size={20} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{micButtonTitle()}</p>
                  </TooltipContent>
                </Tooltip>

                <Button onClick={handleSubmit} disabled={!answer.trim() || isLoadingEvaluation || isLoadingNewQuestion || isAnyRecordingActive} className="flex-grow sm:flex-grow-0">
                  {isLoadingEvaluation ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send size={18} />
                  )}
                  Submit Answer
                </Button>
              </div>
            </CardFooter>
          </>
        )}
      </Card>

      {isLoadingEvaluation && (
        <Card className="shadow-xl mt-4">
          <CardContent className="p-6 flex flex-col items-center justify-center min-h-[200px]">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground text-lg">Analyzing your answer...</p>
          </CardContent>
        </Card>
      )}

      {showEvaluation && evaluationResult && !isLoadingEvaluation && (
        <Card className="shadow-xl animate-in fade-in duration-500">
          <CardHeader>
            <CardTitle className="text-2xl font-semibold text-primary flex items-center gap-2"><Award size={24}/> Performance Feedback</CardTitle>
            <Alert variant={evaluationResult.score >= 70 ? "default" : "destructive"} className="mt-2 border-2">
              <Zap className={`h-5 w-5 ${evaluationResult.score >=70 ? 'text-green-500': 'text-red-500'}`} />
              <AlertTitle className="text-xl">Your Score: {evaluationResult.score}/100</AlertTitle>
            </Alert>
          </CardHeader>
          <CardContent className="space-y-4">
            {recordedVideoUrl && (
              <div className="space-y-2">
                <h3 className="text-lg font-semibold flex items-center text-foreground"><Eye size={20} className="mr-2 text-primary" />Review Your Recording</h3>
                <video src={recordedVideoUrl} controls className="w-full aspect-video rounded-md border shadow-inner bg-muted"></video>
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold flex items-center text-green-600"><CheckCircle size={20} className="mr-2" />Strengths</h3>
              <p className="text-muted-foreground bg-green-50 p-3 rounded-md border border-green-200">{evaluationResult.strengths}</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold flex items-center text-red-600"><XCircle size={20} className="mr-2" />Areas for Improvement</h3>
              <p className="text-muted-foreground bg-red-50 p-3 rounded-md border border-red-200">{evaluationResult.weaknesses}</p>
            </div>

            {communicationAnalysisResult && (
              <div className="space-y-3 pt-3 border-t mt-4">
                <h3 className="text-xl font-semibold flex items-center text-primary"><BarChartHorizontal size={22} className="mr-2" />Communication Analysis</h3>
                <div className="space-y-1">
                  <p><strong className="font-medium">Clarity:</strong> {communicationAnalysisResult.clarityFeedback}</p>
                  <p><strong className="font-medium">Confidence Cues:</strong> {communicationAnalysisResult.confidenceCues}</p>
                  <p><strong className="font-medium">Speaking Pace:</strong> {communicationAnalysisResult.speakingPaceWPM} WPM. {communicationAnalysisResult.paceFeedback}</p>
                  {communicationAnalysisResult.fillerWordsFound.length > 0 && (
                    <p><strong className="font-medium">Filler Words:</strong> {communicationAnalysisResult.fillerWordsFound.join(', ')}</p>
                  )}
                  {timeFeedback && <p><strong className="font-medium">Time Management:</strong> {timeFeedback}</p>}
                </div>
              </div>
            )}
            
            {!modelAnswerText && (
               <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={handleGetModel} variant="outline" className="w-full sm:w-auto border-accent text-accent-foreground hover:bg-accent/10 mt-2" disabled={isLoadingModelAnswer || isAnyRecordingActive}>
                    {isLoadingModelAnswer ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lightbulb size={18} />
                    )}
                    Show Model Answer
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Get an AI-generated ideal answer for this question.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </CardContent>
        </Card>
      )}

      {showModelAnswer && modelAnswerText && !isLoadingEvaluation && (
         <Card className="shadow-xl animate-in fade-in duration-500 mt-4">
           <CardHeader className="flex flex-row justify-between items-center">
             <CardTitle className="text-xl font-semibold flex items-center text-indigo-600"><Target size={20} className="mr-2" />Model Answer</CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleSpeakModelAnswer}
                    variant="outline" 
                    size="icon"
                    disabled={!speechSynthesisSupported || isLoadingModelAnswer || isAnyRecordingActive}
                    aria-label={isSpeakingModelAnswer ? "Stop speaking" : "Speak model answer"}
                    className={isSpeakingModelAnswer ? "border-destructive text-destructive" : "border-primary text-primary"}
                  >
                    {isSpeakingModelAnswer ? <Square size={20} /> : <Play size={20} />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{!speechSynthesisSupported ? "Speech synthesis not supported by browser" : (isSpeakingModelAnswer ? "Stop speaking model answer" : "Speak model answer aloud")}</p>
                </TooltipContent>
              </Tooltip>
           </CardHeader>
           <CardContent>
             <p className="text-muted-foreground bg-indigo-50 p-3 rounded-md border border-indigo-200">{modelAnswerText}</p>
           </CardContent>
         </Card>
      )}
      
      {showEvaluation && !isLoadingEvaluation && (
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
    </TooltipProvider>
  );
}

