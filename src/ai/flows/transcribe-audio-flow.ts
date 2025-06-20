
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
  defaultHeaders: {
    "HTTP-Referer": typeof window !== 'undefined' ? window.location.href : 'https://your-app-url.com', // Replace with your actual app URL
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
      // Using 'openai/whisper-1' which is a common identifier for Whisper on OpenRouter.
      // Check OpenRouter documentation for the most up-to-date or specific model identifiers if needed.
      const transcription = await openrouter.audio.transcriptions.create({
        file: input.audioFile,
        model: 'openai/whisper-1', 
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

