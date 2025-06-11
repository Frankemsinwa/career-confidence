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
  // The 'File' object from FormData is not directly a Zod type.
  // The API route will pass the file object which the OpenAI SDK can handle.
  // We use z.any() here and rely on the runtime check in the flow.
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
      console.log('Transcribe Audio Flow: Received audio file, attempting transcription with Whisper.');
      const transcription = await openai.audio.transcriptions.create({
        file: input.audioFile, // The OpenAI SDK can handle File-like objects
        model: 'whisper-1',
      });
      console.log('Transcribe Audio Flow: Transcription successful.');
      return { transcript: transcription.text };
    } catch (error) {
      console.error('Error in transcribeAudioFlow:', error);
      // Try to provide a more specific error message if possible
      let message = 'Failed to transcribe audio with Whisper.';
      if (error instanceof Error) {
        message += ` Details: ${error.message}`;
      }
      // It's important for flows to throw errors that can be caught by the caller
      // Or return a structured error response if preferred
      throw new Error(message);
    }
  }
);
