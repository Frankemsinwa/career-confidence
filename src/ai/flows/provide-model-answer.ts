'use server';
/**
 * @fileOverview This file defines a Genkit flow for providing a model answer to an interview question.
 *
 * - provideModelAnswer - A function that generates a model answer for a given interview question.
 * - ProvideModelAnswerInput - The input type for the provideModelAnswer function.
 * - ProvideModelAnswerOutput - The return type for the provideModelAnswer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ProvideModelAnswerInputSchema = z.object({
  question: z.string().describe('The interview question to generate a model answer for.'),
  jobRole: z.string().describe('The job role the interview question is for.'),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).describe('The difficulty level of the interview question.'),
});
export type ProvideModelAnswerInput = z.infer<typeof ProvideModelAnswerInputSchema>;

const ProvideModelAnswerOutputSchema = z.object({
  modelAnswer: z.string().describe('A model answer to the interview question.'),
});
export type ProvideModelAnswerOutput = z.infer<typeof ProvideModelAnswerOutputSchema>;

export async function provideModelAnswer(input: ProvideModelAnswerInput): Promise<ProvideModelAnswerOutput> {
  return provideModelAnswerFlow(input);
}

const provideModelAnswerPrompt = ai.definePrompt({
  name: 'provideModelAnswerPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: {schema: ProvideModelAnswerInputSchema},
  output: {schema: ProvideModelAnswerOutputSchema},
  prompt: `You are an expert career coach providing model answers to interview questions.

  Provide a concise and informative model answer to the following interview question, tailored to the specified job role and difficulty level.

  Job Role: {{{jobRole}}}
  Difficulty Level: {{{difficulty}}}
  Question: {{{question}}}

  Model Answer:`,
});

const provideModelAnswerFlow = ai.defineFlow(
  {
    name: 'provideModelAnswerFlow',
    inputSchema: ProvideModelAnswerInputSchema,
    outputSchema: ProvideModelAnswerOutputSchema,
  },
  async input => {
    const {output} = await provideModelAnswerPrompt(input);
    return output!;
  }
);
