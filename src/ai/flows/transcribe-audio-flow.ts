'use server';
/**
 * @fileOverview Transcribes audio using a Whisper model via OpenRouter.
 *
 * - transcribeAudio - A function that transcribes an audio file.
 * - TranscribeAudioInput - The input type for the transcribeAudio function.
 * - TranscribeAudioOutput - The return type for the transcribeAudio function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import OpenAI from 'openai';

// Ensure OPENROUTER_API_KEY is available
if (!process.env.OPENROUTER_API_KEY) {
  throw new Error('OPENROUTER_API_KEY is not set in environment variables.');
}

const openrouter = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: { // Optional: OpenRouter might require specific headers for identifying your app
    "HTTP-Referer": typeof window !== 'undefined' ? window.location.href : 'https://careerconfidence.app', // Replace with your actual app URL
    "X-Title": "Career Confidence", // Replace with your actual app name
  },
});

const TranscribeAudioInputSchema = z.object({
  audioFile: z.any().describe('The audio file object to transcribe (e.g., from FormData).'),
});
export type TranscribeAudioInput = z.infer<typeof TranscribeAudioInputSchema>;

const TranscribeAudioOutputSchema = z.object({
  transcript: z.string().describe('The transcribed text from the audio.'),
});
export type TranscribeAudioOutput = z.infer<typeof TranscribeAudioOutputSchema>;

export async function transcribeAudio(input: TranscribeAudioInput): Promise<TranscribeAudioOutput> {
  return transcribeAudioFlow(input);
}

const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeAudioInputSchema,
    outputSchema: TranscribeAudioOutputSchema,
  },
  async (input) => {
    if (!input.audioFile || typeof input.audioFile.arrayBuffer !== 'function') {
        throw new Error('Invalid audio file provided to transcription flow.');
    }
    try {
      console.log('Transcribe Audio Flow (OpenRouter): Received audio file, attempting transcription with Whisper.');
      // For OpenRouter, you might still use 'whisper-1' or a specific model name they provide,
      // e.g., 'openai/whisper-1'. The OpenAI SDK expects the base model name.
      // Check OpenRouter documentation for exact model identifier if 'whisper-1' fails.
      const transcription = await openrouter.audio.transcriptions.create({
        file: input.audioFile,
        model: 'whisper-1', // This should typically be the model identifier like 'openai/whisper-1' for OpenRouter
                               // or just 'whisper-1' if the SDK and OpenRouter handle it.
                               // If OpenRouter requires a prefix like 'openai/whisper-1', you'd use that.
                               // For now, we'll keep it as 'whisper-1' as per typical OpenAI SDK usage.
      });
      console.log('Transcribe Audio Flow (OpenRouter): Transcription successful.');
      return { transcript: transcription.text };
    } catch (error) {
      console.error('Error in transcribeAudioFlow (OpenRouter):', error);
      let message = 'Failed to transcribe audio with Whisper via OpenRouter.';
      if (error instanceof Error) {
        message += ` Details: ${error.message}`;
      }
      throw new Error(message);
    }
  }
);
