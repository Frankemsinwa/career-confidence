'use server';
/**
 * @fileOverview Evaluate user answers, providing a score and highlighting strengths and weaknesses.
 *
 * - evaluateAnswer - A function that evaluates the answer.
 * - EvaluateAnswerInput - The input type for the evaluateAnswer function.
 * - EvaluateAnswerOutput - The return type for the evaluateAnswer function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const EvaluateAnswerInputSchema = z.object({
  question: z.string().describe('The interview question asked.'),
  answer: z.string().describe('The user provided answer.'),
  jobRole: z.string().describe('The job role the user is interviewing for.'),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).describe('The difficulty level of the interview.'),
});

export type EvaluateAnswerInput = z.infer<typeof EvaluateAnswerInputSchema>;

const EvaluateAnswerOutputSchema = z.object({
  score: z.number().describe('The score of the answer out of 100.'),
  strengths: z.string().describe('The strengths of the answer.'),
  weaknesses: z.string().describe('The weaknesses of the answer.'),
  modelAnswer: z.string().describe('A model answer to the question.'),
});

export type EvaluateAnswerOutput = z.infer<typeof EvaluateAnswerOutputSchema>;

export async function evaluateAnswer(input: EvaluateAnswerInput): Promise<EvaluateAnswerOutput> {
  return evaluateAnswerFlow(input);
}

const evaluateAnswerPrompt = ai.definePrompt({
  name: 'evaluateAnswerPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: {schema: EvaluateAnswerInputSchema},
  output: {schema: EvaluateAnswerOutputSchema},
  prompt: `You are an AI career coach specializing in evaluating interview answers for the role of {{jobRole}}. 
You will be provided with an interview question, and the candidate's answer. 

Based on the answer, you will provide a score out of 100, highlight the strengths and weaknesses of the answer, and provide a model answer that the candidate can use to improve.

Question: {{{question}}}
Answer: {{{answer}}}

Your evaluation:
`,
});

const evaluateAnswerFlow = ai.defineFlow(
  {
    name: 'evaluateAnswerFlow',
    inputSchema: EvaluateAnswerInputSchema,
    outputSchema: EvaluateAnswerOutputSchema,
  },
  async input => {
    const {output} = await evaluateAnswerPrompt(input);
    return output!;
  }
);
