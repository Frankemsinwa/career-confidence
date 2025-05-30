
'use client';

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
import { Briefcase, ListChecks, BarChart3, PlayCircle } from 'lucide-react';
import type { InterviewSettings, InterviewType, DifficultyLevel, QuestionCount } from '@/lib/types';
import { interviewTypes, difficultyLevels, questionCountOptions } from '@/lib/types';

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
});

type InterviewSetupFormProps = {
  onSubmit: (settings: InterviewSettings) => void;
  onDailyPractice: () => void; // Kept in props in case it's used elsewhere, but button removed
  isLoading: boolean;
};

export default function InterviewSetupForm({ onSubmit, isLoading }: InterviewSetupFormProps) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobRole: '',
      interviewType: 'Technical',
      difficultyLevel: 'Intermediate',
      numQuestions: 3 as QuestionCount,
    },
  });

  function handleSubmit(values: z.infer<typeof formSchema>) {
    onSubmit(values);
  }

  return (
    <Card className="w-full max-w-lg mx-auto shadow-xl">
      <CardHeader>
        <CardTitle className="text-3xl font-bold text-center text-primary">Prepare Your Interview</CardTitle>
        <CardDescription className="text-center text-muted-foreground">
          Tailor your practice session for the best results.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="jobRole"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2 text-lg"><Briefcase size={20} />Job Role</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Software Engineer, Product Manager" {...field} className="text-base"/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                          {num}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="pt-4">
              <Button type="submit" className="w-full text-lg py-6" disabled={isLoading}>
                <PlayCircle size={22} className="mr-2"/> Start Interview
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
