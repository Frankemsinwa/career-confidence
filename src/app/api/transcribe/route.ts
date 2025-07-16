
// src/app/api/transcribe/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import OpenAI from 'openai';

// This is the new, direct way to handle transcription.
// We are initializing OpenAI directly here.
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  // Explicitly check for the API key, especially in production
  if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key is not configured on the server.');
      return NextResponse.json({ error: 'The transcription service is not configured correctly. The API key is missing.' }, { status: 500 });
  }
    
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio');

    if (!audioFile || !(audioFile instanceof Blob)) {
      return NextResponse.json({ error: 'No audio file uploaded or invalid format.' }, { status: 400 });
    }
    
    // The OpenAI SDK's `create` method can directly handle the File/Blob object from FormData.
    console.log('API Route: Received audio file, sending to OpenAI Whisper directly.');
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile as File, // Casting to File is safe here.
      model: 'whisper-1',
    });
    console.log('API Route: Transcription successful.');

    return NextResponse.json({ transcript: transcription.text });

  } catch (error) {
    console.error('Error in /api/transcribe:', error);
    
    // Provide more specific error feedback to the client
    let errorMessage = 'An unknown error occurred during transcription.';
    let statusCode = 500;

    if (error instanceof OpenAI.APIError) {
        errorMessage = `OpenAI API Error: ${error.message}`;
        statusCode = error.status || 500;
        if (statusCode === 401) {
            errorMessage = "Invalid OpenAI API key. Please check your hosting environment variables."
        }
    } else if (error instanceof Error) {
        errorMessage = error.message;
    }

    return NextResponse.json({ error: `Transcription failed: ${errorMessage}` }, { status: statusCode });
  }
}
