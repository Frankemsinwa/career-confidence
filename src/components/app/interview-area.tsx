
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Send, SkipForward, RefreshCcw, Lightbulb, CheckCircle, XCircle, Target, Award, Mic, MicOff, Play, Square, Video, VideoOff, Eye, Info, Zap, BarChartHorizontal, Disc3, CircleDot } from 'lucide-react';
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
  isLoadingEvaluation: boolean; 
  isLoadingModelAnswer: boolean;
  isLoadingNewQuestion: boolean;
  evaluationResult: EvaluateAnswerOutput | null;
  communicationAnalysisResult: AnalyzeCommunicationOutput | null;
  modelAnswerText: string | null;
  isLastQuestion: boolean;
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
}: InterviewAreaProps) {
  const [answer, setAnswer] = useState('');
  const [showEvaluation, setShowEvaluation] = useState(false);
  const [showModelAnswer, setShowModelAnswer] = useState(false);
  
  const [isSpeechToTextRecording, setIsSpeechToTextRecording] = useState(false); // True if SpeechRec is active (from voice OR video button)
  const [isVideoRecordingActive, setIsVideoRecordingActive] = useState(false); // True if MediaRecorder is active

  const [speechApiSupported, setSpeechApiSupported] = useState(true);
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);
  
  const [isSpeakingModelAnswer, setIsSpeakingModelAnswer] = useState(false);
  const [speechSynthesisSupported, setSpeechSynthesisSupported] = useState(true);

  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null); 
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDurationSeconds, setRecordingDurationSeconds] = useState<number>(0);

  const { toast } = useToast();

  useEffect(() => {
    const requestPermissionsAndStream = async () => {
      if (typeof window === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("Media devices API not supported.");
        if (typeof window !== 'undefined') { 
            toast({ variant: 'destructive', title: 'Unsupported Browser', description: 'Camera/Microphone access is not supported by your browser.' });
        }
        setHasCameraPermission(false);
        return;
      }
      try {
        console.log("Attempting to get user media (video & audio for preview/recording)...");
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log("User media stream obtained for preview/recording.");
        setVideoStream(stream);
        setHasCameraPermission(true);
      } catch (error) {
        console.error('Error accessing camera/microphone for preview/recording:', error);
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
      if (speechRecognitionRef.current && isSpeechToTextRecording) {
        speechRecognitionRef.current.stop();
      }
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
      });
    }
  }, [hasCameraPermission, videoStream]);


  useEffect(() => {
    // Reset states when question changes
    setAnswer('');
    setShowEvaluation(false);
    setShowModelAnswer(false);
    setIsSpeakingModelAnswer(false);
    if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    
    if (isSpeechToTextRecording) {
        console.log("Question changed: Stopping active speech recognition.");
        speechRecognitionRef.current?.stop();
    }
    if (isVideoRecordingActive) {
        console.log("Question changed: Stopping active video recording.");
        mediaRecorderRef.current?.stop();
    }
    if (recordedVideoUrl) { 
      console.log("Question changed: Revoking old recorded video URL.");
      URL.revokeObjectURL(recordedVideoUrl);
      setRecordedVideoUrl(null);
    }
    recordedChunksRef.current = [];
    setRecordingStartTime(null);
    setRecordingDurationSeconds(0);
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question]); 

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      console.warn("SpeechRecognition API not supported by this browser.");
      setSpeechApiSupported(false);
      return; 
    }
    setSpeechApiSupported(true);
    
    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true; 
    recognition.interimResults = false; 
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        console.log("SpeechRecognition: onstart fired.");
        // Note: isSpeechToTextRecording is set by the calling toggle function
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
      setIsSpeechToTextRecording(false); // Ensure state is reset on error
      let errorMessage = `Speech recognition error: ${event.error}.`;
      if (event.message) errorMessage += ` Message: ${event.message}`;

      if (event.error === 'no-speech') {
        errorMessage = "No speech was detected. Please ensure your microphone is unmuted, the volume is adequate, you're speaking clearly, and there isn't excessive background noise. Also, try closing other applications that might be using the microphone.";
      } else if (event.error === 'audio-capture') {
        errorMessage = "Audio capture failed. Ensure your microphone is properly connected, configured in your OS, and not being used exclusively by another application. You may need to re-grant microphone permissions.";
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
      // Only set to false if it wasn't intentionally stopped and restarted by video toggle
      // The toggle functions will manage this state more directly.
      // setIsSpeechToTextRecording(false); 
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
        speechRecognitionRef.current.onstart = null;
        speechRecognitionRef.current.onresult = null;
        speechRecognitionRef.current.onerror = null;
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.abort(); 
      }
      if (typeof window !== 'undefined' && window.speechSynthesis && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]); 


  const toggleVoiceInput = () => {
    if (!speechRecognitionRef.current || !speechApiSupported) {
      toast({ title: "Voice Input Unavailable", description: "Speech recognition is not supported or not initialized.", variant: "destructive"});
      return;
    }
    if (isVideoRecordingActive) {
      toast({ title: "Voice Input Unavailable", description: "Cannot start voice input while video recording is active. Stop video first.", variant: "default"});
      return;
    }

    if (isSpeechToTextRecording) { // This implies it was started by voice-only
      console.log("Stopping SpeechRecognition (voice input).");
      speechRecognitionRef.current.stop();
      setIsSpeechToTextRecording(false);
      toast({ title: "Voice Input Stopped"});
    } else {
      console.log("Attempting to start SpeechRecognition (voice input).");
      try {
        setAnswer(''); // Clear previous text for new voice input
        speechRecognitionRef.current.start();
        setIsSpeechToTextRecording(true);
        toast({ title: "Voice Input Active", description: "Speak into your microphone. Click mic again to stop."});
      } catch (e: any) {
        console.error("Error starting speech recognition (voice input):", e);
        toast({ title: "Speech Error", description: `Could not start voice input: ${e.message || e.name || 'Unknown error'}.`, variant: "destructive" });
        setIsSpeechToTextRecording(false); 
      }
    }
  };

  const toggleVideoRecording = () => {
    if (hasCameraPermission === null) {
      toast({ title: "Permissions Pending", description: "Please wait for camera/microphone permission check.", variant: "default" });
      return;
    }
    if (hasCameraPermission === false || !videoStream) {
      toast({ title: "Video Unavailable", description: "Camera access denied or stream not available for video recording.", variant: "destructive"});
      return;
    }
    if (isSpeechToTextRecording && !isVideoRecordingActive) { // Voice-only is active
        toast({ title: "Video Recording Unavailable", description: "Cannot start video recording while voice-only input is active. Stop voice input first.", variant: "default"});
        return;
    }

    if (isVideoRecordingActive) { // Video is active, stop everything related to it
      console.log("Stopping MediaRecorder and associated SpeechRecognition (video recording).");
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop(); 
      }
      if (speechRecognitionRef.current && isSpeechToTextRecording) { // Stop speech if it was started with video
        speechRecognitionRef.current.stop();
      }
      setIsVideoRecordingActive(false);
      setIsSpeechToTextRecording(false); // Speech tied to video stops too

      if (recordingStartTime) {
        const duration = Math.round((Date.now() - recordingStartTime) / 1000);
        setRecordingDurationSeconds(duration);
        console.log(`Video recording duration: ${duration}s`);
      }
      setRecordingStartTime(null);
      toast({ title: "Video Recording Stopped", description: "Processing video and transcript..."});

    } else { // Video is not active, start it and associated speech recognition
      if (recordedVideoUrl) { 
        console.log("Revoking previous recorded video URL before new video recording.");
        URL.revokeObjectURL(recordedVideoUrl);
        setRecordedVideoUrl(null);
      }
      recordedChunksRef.current = [];
      
      console.log("Attempting to start MediaRecorder and associated SpeechRecognition (video recording).");
      try {
        // Start MediaRecorder
        mediaRecorderRef.current = new MediaRecorder(videoStream, { mimeType: 'video/webm' });
        mediaRecorderRef.current.onstart = () => {
            console.log("MediaRecorder: onstart fired.");
            setIsVideoRecordingActive(true); // Set video recording active
            setRecordingStartTime(Date.now());
            setRecordingDurationSeconds(0); 
        };
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            recordedChunksRef.current.push(event.data);
          }
        };
        mediaRecorderRef.current.onstop = () => {
          console.log("MediaRecorder: onstop fired.");
          // isVideoRecordingActive will be set to false by the toggle function
          if (recordedChunksRef.current.length > 0) {
            const videoBlob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
            const url = URL.createObjectURL(videoBlob);
            setRecordedVideoUrl(url);
            console.log("MediaRecorder: Video ready at", url);
          } else {
            console.log("MediaRecorder: onstop fired but no data chunks recorded.");
            setRecordedVideoUrl(null);
            setRecordingDurationSeconds(0);
          }
        };
        mediaRecorderRef.current.start();

        // Start SpeechRecognition
        if (speechRecognitionRef.current && speechApiSupported) {
          setAnswer(''); // Clear previous text
          speechRecognitionRef.current.start();
          setIsSpeechToTextRecording(true); // Speech is active due to video
        }
        
        toast({ title: "Video & Voice Recording Started", description: "Your video and voice for transcription are being recorded. Click camera icon again to stop."});
      } catch (e: any) {
         console.error("MediaRecorder or SpeechRec setup/start failed for video mode:", e);
         toast({title: "Recording Error", description: `Could not start video/voice recording: ${e.message || 'Unknown error'}.`, variant: "destructive"});
         setIsVideoRecordingActive(false);
         setIsSpeechToTextRecording(false);
      }
    }
  };


  const handleSubmit = async () => {
    if (isLoadingEvaluation || isSpeechToTextRecording || isVideoRecordingActive) {
      let busyReason = "current analysis to finish";
      if (isSpeechToTextRecording && isVideoRecordingActive) busyReason = "voice and video recording to finish";
      else if (isSpeechToTextRecording) busyReason = "voice input to finish";
      else if (isVideoRecordingActive) busyReason = "video recording to finish";
      
      console.log("Submit attempt while busy, returning.");
      toast({title: "Busy", description: `Please stop ${busyReason} before submitting.`, variant: "default"});
      return;
    }
    if (!answer.trim()) {
        toast({title: "No Answer Text", description: "Please provide an answer (type or use voice/video recording which includes transcription).", variant: "default"});
        return;
    }
    
    console.log("Submitting answer. Text:", answer, "Duration:", recordingDurationSeconds, "Video URL:", recordedVideoUrl);
    await onSubmitAnswer(answer, recordingDurationSeconds, recordedVideoUrl || null); 
    setShowEvaluation(true);
  };

  const handleGetModel = async () => {
    if (isLoadingModelAnswer || isSpeechToTextRecording || isVideoRecordingActive) return;

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
  
  const getTimeManagementFeedback = () => {
    if (!evaluationResult || recordingDurationSeconds <= 0) return null;
    if (recordingDurationSeconds < EXPECTED_ANSWER_TIME_SECONDS * 0.75) {
      return `Your answer video was quite brief (${recordingDurationSeconds}s). Consider elaborating more. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
    } else if (recordingDurationSeconds > EXPECTED_ANSWER_TIME_SECONDS * 1.25) {
      return `Your answer video was a bit long (${recordingDurationSeconds}s). Try to be more concise. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
    }
    return `Your answer video duration (${recordingDurationSeconds}s) was good. (Target: ~${EXPECTED_ANSWER_TIME_SECONDS}s)`;
  };
  const timeFeedback = getTimeManagementFeedback();

  const voiceInputButtonDisabled = !speechApiSupported || isLoadingEvaluation || isLoadingNewQuestion || isVideoRecordingActive;
  const videoRecordButtonDisabled = hasCameraPermission !== true || isLoadingEvaluation || isLoadingNewQuestion || (isSpeechToTextRecording && !isVideoRecordingActive);
  const submitButtonDisabled = !answer.trim() || isLoadingEvaluation || isLoadingNewQuestion || isSpeechToTextRecording || isVideoRecordingActive;

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
             {(isSpeechToTextRecording && !isVideoRecordingActive) && ( // Voice-only REC
                <div className="absolute top-3 left-3 bg-blue-600 text-white px-3 py-1 rounded-full text-xs flex items-center shadow-lg animate-pulse">
                    <Mic size={14} className="mr-1.5" /> REC Voice
                </div>
            )}
            {isVideoRecordingActive && ( // Video REC (implies speech is also active)
                <div className="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full text-xs flex items-center shadow-lg animate-pulse">
                    <Disc3 size={14} className="mr-1.5 animate-spin-slow" /> REC Video & Voice
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
                placeholder="Type or use microphone/video to record your answer..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={6}
                className="text-base border-2 focus:border-primary transition-colors"
                disabled={isLoadingEvaluation || isLoadingNewQuestion || isSpeechToTextRecording /* Allow typing while speech is active if user wants to correct */}
              />
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row justify-between items-center gap-2">
              <div className="flex gap-2 w-full sm:w-auto">
                <Button onClick={onRegenerateQuestion} variant="outline" disabled={isLoadingEvaluation || isLoadingNewQuestion || isSpeechToTextRecording || isVideoRecordingActive}>
                  <RefreshCcw size={18} /> Regenerate
                </Button>
                <Button onClick={onSkipQuestion} variant="outline" disabled={isLoadingEvaluation || isLoadingNewQuestion || isSpeechToTextRecording || isVideoRecordingActive}>
                  <SkipForward size={18} /> Skip
                </Button>
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Tooltip>
                  <TooltipTrigger asChild>
                     <Button 
                      onClick={toggleVoiceInput} 
                      variant={(isSpeechToTextRecording && !isVideoRecordingActive) ? "destructive" : "outline"}
                      size="icon"
                      disabled={voiceInputButtonDisabled}
                      aria-label={(isSpeechToTextRecording && !isVideoRecordingActive) ? "Stop voice input" : "Start voice input"}
                      className={(isSpeechToTextRecording && !isVideoRecordingActive) ? "bg-blue-500 hover:bg-blue-600 text-white" : ""}
                    >
                      {(isSpeechToTextRecording && !isVideoRecordingActive) ? <MicOff size={20} /> : <Mic size={20} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{!speechApiSupported ? "Voice input not supported" : ((isSpeechToTextRecording && !isVideoRecordingActive) ? "Stop voice input" : (isVideoRecordingActive ? "Voice input via video active" : "Start voice input (for text answer)"))}</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                     <Button 
                      onClick={toggleVideoRecording} 
                      variant={isVideoRecordingActive ? "destructive" : "outline"}
                      size="icon"
                      disabled={videoRecordButtonDisabled}
                      aria-label={isVideoRecordingActive ? "Stop video & voice recording" : "Start video & voice recording"}
                       className={isVideoRecordingActive ? "bg-red-500 hover:bg-red-600 text-white" : ""}
                    >
                      {isVideoRecordingActive ? <Square size={20} /> : <Video size={20} />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{hasCameraPermission !== true ? "Video recording disabled" : (isVideoRecordingActive ? "Stop video & linked voice recording" : ((isSpeechToTextRecording && !isVideoRecordingActive) ? "Video recording disabled (voice-only active)" : "Start video & linked voice recording"))}</p>
                  </TooltipContent>
                </Tooltip>

                <Button onClick={handleSubmit} disabled={submitButtonDisabled} className="flex-grow sm:flex-grow-0">
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
                  <Button onClick={handleGetModel} variant="outline" className="w-full sm:w-auto border-accent text-accent-foreground hover:bg-accent/10 mt-2" disabled={isLoadingModelAnswer || isSpeechToTextRecording || isVideoRecordingActive}>
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
                    disabled={!speechSynthesisSupported || isLoadingModelAnswer || isSpeechToTextRecording || isVideoRecordingActive}
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
    
