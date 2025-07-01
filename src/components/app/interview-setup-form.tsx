'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Briefcase, ListChecks, BarChart3, PlayCircle, Edit } from 'lucide-react';
import type { InterviewSettings, QuestionCount } from '@/lib/types';
import { interviewTypes, difficultyLevels, questionCountOptions } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

const formSchema = z.object({
  jobRole: z.string().min(2, { message: 'Job role must be at least 2 characters.' }).max(50),
  interviewType: z.enum(interviewTypes),
  difficultyLevel: z.enum(difficultyLevels),
  numQuestions: z
    .number({
      invalid_type_error: 'Number of questions must be a selected value.',
    })
    .refine((val): val is QuestionCount => 
      (questionCountOptions as ReadonlyArray<number>).includes(val), 
      {
        message: `Number of questions must be one of: ${questionCountOptions.join(', ')}.`,
      }
    ) as z.ZodType<QuestionCount>,
  customQuestion: z.string().min(10, { message: 'Your question must be at least 10 characters long.' }).optional(),
});

type InterviewSetupFormProps = {
  onSubmit: (settings: InterviewSettings) => void;
  isLoading: boolean;
};

export default function InterviewSetupForm({ onSubmit, isLoading }: InterviewSetupFormProps) {
  const [mode, setMode] = useState<'generate' | 'custom'>('generate');

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobRole: '',
      interviewType: 'Technical',
      difficultyLevel: 'Intermediate',
      numQuestions: 3 as QuestionCount,
      customQuestion: '',
    },
  });

  function handleSubmit(values: z.infer<typeof formSchema>) {
    if (mode === 'custom') {
      if (!values.customQuestion || values.customQuestion.length < 10) {
        form.setError("customQuestion", { type: "manual", message: "Please enter a question with at least 10 characters."});
        return;
      }
      onSubmit({
        jobRole: values.jobRole,
        customQuestion: values.customQuestion,
        // Set constant values for custom question mode for reliable evaluation
        difficultyLevel: 'Intermediate',
        interviewType: 'Behavioral', // A safe, general default
        numQuestions: 1,
      });
    } else {
      onSubmit(values);
    }
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary">Prepare Your Interview</CardTitle>
        <CardDescription className="text-center text-muted-foreground">
          Let AI generate questions or practice with your own.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <Tabs defaultValue="generate" className="w-full" onValueChange={(value) => setMode(value as 'generate' | 'custom')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="generate">AI Generated Questions</TabsTrigger>
                <TabsTrigger value="custom">Use My Own Question</TabsTrigger>
              </TabsList>

              {/* Common Fields */}
              <div className="pt-4 space-y-6">
                 <FormField
                  control={form.control}
                  name="jobRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-lg"><Briefcase size={20} />Job Role</FormLabel>
                      <CardDescription className="text-xs pb-2">Provide a job role for context, even for your own questions.</CardDescription>
                      <FormControl>
                        <Input placeholder="e.g., Software Engineer, Product Manager" {...field} className="text-base"/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <TabsContent value="generate" className="space-y-6">
                <FormField
                  control={form.control}
                  name="interviewType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-lg"><ListChecks size={20} />Interview Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-base">
                            <SelectValue placeholder="Select interview type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {interviewTypes.map((type) => (
                            <SelectItem key={type} value={type} className="text-base">
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="difficultyLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-lg"><BarChart3 size={20} />Difficulty Level</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-base">
                            <SelectValue placeholder="Select difficulty" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {difficultyLevels.map((level) => (
                            <SelectItem key={level} value={level} className="text-base">
                              {level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="numQuestions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-lg">Number of Questions</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(Number(value) as QuestionCount)} 
                        defaultValue={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger className="text-base">
                            <SelectValue placeholder="Select number of questions" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {questionCountOptions.map((num) => (
                            <SelectItem key={num} value={String(num)} className="text-base">
                              {num} Questions
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </TabsContent>

              <TabsContent value="custom" className="space-y-6">
                <FormField
                  control={form.control}
                  name="customQuestion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-lg"><Edit size={20} />Your Interview Question</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="e.g., Tell me about a time you handled a conflict with a coworker." 
                          {...field} 
                          className="text-base min-h-[100px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <CardDescription className="text-xs text-center pt-2">
                    For custom questions, the difficulty is set to 'Intermediate' to ensure consistent and high-quality feedback.
                </CardDescription>
              </TabsContent>
            </Tabs>
            <div className="pt-4">
              <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
                {isLoading ? 'Setting up...' : <><PlayCircle size={22} className="mr-2"/> Start Interview</>}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
