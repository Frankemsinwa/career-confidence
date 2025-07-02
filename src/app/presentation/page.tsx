'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Construction, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function PresentationPage() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-var(--header-height,80px))] p-4">
      <Card className="w-full max-w-lg mx-auto text-center shadow-xl">
        <CardHeader>
          <Construction size={64} className="mx-auto text-accent mb-4" />
          <CardTitle className="text-3xl font-bold">Presentation Mode</CardTitle>
          <CardDescription className="text-lg text-muted-foreground">
            This feature is currently under construction. Check back soon!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/" passHref>
            <Button size="lg" className="w-full">
              <ArrowLeft size={20} className="mr-2"/>
              Back to Home
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
