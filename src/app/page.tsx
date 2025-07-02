'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Mic, Presentation as PresentationIcon } from 'lucide-react';

export default function ChooseModePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height,80px))] p-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-primary">What would you like to practice today?</h1>
        <p className="text-lg text-muted-foreground mt-2">Choose a mode below to get started.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <Link href="/interview" passHref>
          <Card className="hover:shadow-2xl hover:border-primary transition-all duration-300 cursor-pointer transform hover:-translate-y-2">
            <CardHeader className="items-center text-center">
              <Mic size={64} className="text-accent mb-4" />
              <CardTitle className="text-3xl">Practice an Interview</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-base">
                Use AI-generated or your own questions to sharpen your interview skills and get detailed feedback.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
        <Link href="/presentation" passHref>
          <Card className="hover:shadow-2xl hover:border-primary transition-all duration-300 cursor-pointer transform hover:-translate-y-2">
            <CardHeader className="items-center text-center">
              <PresentationIcon size={64} className="text-accent mb-4" />
              <CardTitle className="text-3xl">Practice a Presentation</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center text-base">
                Rehearse your presentation, get feedback on clarity, pacing, and structure.
              </CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
