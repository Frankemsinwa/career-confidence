'use server';
/**
 * @fileOverview Transcribes audio using OpenAI's Whisper model.
 *
 * - transcribeAudio - A function that transcribes an audio file.
 * - TranscribeAudioInput - The input type for the transcribeAudio function.
 * - TranscribeAudioOutput - The return type for the transcribeAudio function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import OpenAI from 'openai';

// Ensure OPENAI_API_KEY is available
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables.');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
      console.log('Transcribe Audio Flow (OpenAI): Received audio file, attempting transcription with whisper-1.');
      const transcription = await openai.audio.transcriptions.create({
        file: input.audioFile,
        model: 'whisper-1', 
      });
      console.log('Transcribe Audio Flow (OpenAI): Transcription successful.');
      return { transcript: transcription.text };
    } catch (error) {
      console.error('Error in transcribeAudioFlow (OpenAI):', error);
      let message = 'Failed to transcribe audio with OpenAI Whisper.';
      if (error instanceof Error) {
        message += ` Details: ${error.message}`;
      }
      throw new Error(message);
    }
  }
);