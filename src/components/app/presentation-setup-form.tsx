'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BookOpen, Users, Clock, PlayCircle } from 'lucide-react';
import type { PresentationSettings, PresentationTimeFrame } from '@/lib/types';
import { presentationTimeFrames } from '@/lib/types';

const formSchema = z.object({
  topic: z.string().min(10, 'Topic must be at least 10 characters.').max(200, 'Topic is too long.'),
  targetAudience: z.string().min(3, 'Audience must be at least 3 characters.').max(100, 'Audience is too long.'),
  timeFrame: z.enum(presentationTimeFrames, {
    required_error: 'You must select a time frame.',
  }),
});

type PresentationSetupFormProps = {
  onSubmit: (settings: PresentationSettings) => void;
  isLoading: boolean;
};

export default function PresentationSetupForm({ onSubmit, isLoading }: PresentationSetupFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      topic: '',
      targetAudience: '',
      timeFrame: '5 minutes',
    },
  });

  function handleSubmit(values: z.infer<typeof formSchema>) {
    onSubmit(values);
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary">Presentation Practice Setup</CardTitle>
        <CardDescription className="text-center text-muted-foreground">
          Define your presentation goals to get tailored feedback.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="topic"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-lg"><BookOpen size={20} /> Presentation Topic</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., 'Q3 Marketing Results' or 'My Thesis on Renewable Energy'" {...field} className="min-h-[100px]" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="targetAudience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-lg"><Users size={20} /> Target Audience</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 'Company Executives', 'High School Students'" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeFrame"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-lg"><Clock size={20} /> Target Time Frame</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a time frame" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {presentationTimeFrames.map(time => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="pt-4">
              <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
                {isLoading ? 'Setting up...' : <><PlayCircle size={22} className="mr-2"/> Start Practice</>}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
