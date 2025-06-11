// src/app/api/transcribe/route.ts
import { transcribeAudio } from '@/ai/flows/transcribe-audio-flow';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: 'No audio file uploaded or invalid format.' }, { status: 400 });
    }

    // The OpenAI SDK expects a File-like object.
    // A Blob can be treated as a File by giving it a name.
    // If the SDK needs a proper File, we might need to ensure it has name & type.
    // For Whisper, the SDK handles this well.
    const fileForWhisper = audioFile as File; // Cast if necessary, or ensure client sends it as File

    console.log('API Route: Received audio file, invoking transcription flow.');
    const result = await transcribeAudio({ audioFile: fileForWhisper });
    console.log('API Route: Transcription flow completed.');

    return NextResponse.json({ transcript: result.transcript });
  } catch (error) {
    console.error('Error in /api/transcribe:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error during transcription.';
    return NextResponse.json({ error: `Transcription failed: ${errorMessage}` }, { status: 500 });
  }
}
