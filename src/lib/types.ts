
import type { EvaluateAnswerOutput } from '@/ai/flows/evaluate-answer';
import type { AnalyzeCommunicationOutput } from '@/ai/flows/analyze-communication-flow';

export const interviewTypes = ["Technical", "Behavioral", "Situational", "General HR"] as const;
export type InterviewType = typeof interviewTypes[number];

export const difficultyLevels = ["Beginner", "Intermediate", "Advanced"] as const;
export type DifficultyLevel = typeof difficultyLevels[number];

export const questionCountOptions = [1, 3, 5, 7, 10] as const;
export type QuestionCount = typeof questionCountOptions[number];

export interface InterviewSettings {
  jobRole: string;
  interviewType: InterviewType;
  difficultyLevel: DifficultyLevel;
  numQuestions: QuestionCount;
}

export interface StoredAttempt {
  id: string;
  timestamp: number;
  question: string;
  userAnswer: string; // Transcribed text
  evaluation: EvaluateAnswerOutput;
  settings: Pick<InterviewSettings, 'jobRole' | 'interviewType' | 'difficultyLevel'>;
  communicationAnalysis?: AnalyzeCommunicationOutput;
  recordingDurationSeconds?: number; // Duration of video/audio input
  recordedVideoUrl?: string; // URL for the recorded video playback
}
