// src/ai/flows/generate-interview-questions.ts
'use server';

/**
 * @fileOverview Generates personalized interview questions based on user-selected criteria.
 *
 * - generateInterviewQuestions - A function that generates interview questions.
 * - GenerateInterviewQuestionsInput - The input type for the generateInterviewQuestions function.
 * - GenerateInterviewQuestionsOutput - The return type for the generateInterviewQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateInterviewQuestionsInputSchema = z.object({
  jobRole: z.string().describe('The job role for which interview questions should be generated.'),
  interviewType: z.string().describe('The type of interview (e.g., Technical, Behavioral).'),
  difficultyLevel: z.string().describe('The difficulty level (Beginner, Intermediate, Advanced).'),
  numQuestions: z.number().default(3).describe('The number of questions to generate. Defaults to 3.'),
});
export type GenerateInterviewQuestionsInput = z.infer<
  typeof GenerateInterviewQuestionsInputSchema
>;

const GenerateInterviewQuestionsOutputSchema = z.object({
  questions: z.array(z.string()).describe('An array of generated interview questions.'),
});
export type GenerateInterviewQuestionsOutput = z.infer<
  typeof GenerateInterviewQuestionsOutputSchema
>;

export async function generateInterviewQuestions(
  input: GenerateInterviewQuestionsInput
): Promise<GenerateInterviewQuestionsOutput> {
  return generateInterviewQuestionsFlow(input);
}

const generateInterviewQuestionsPrompt = ai.definePrompt({
  name: 'generateInterviewQuestionsPrompt',
  input: {schema: GenerateInterviewQuestionsInputSchema},
  output: {schema: GenerateInterviewQuestionsOutputSchema},
  prompt: `You are an intelligent and professional interview assistant AI.

  Your primary task is to generate {{numQuestions}} diverse and highly specific interview questions for a candidate applying for the role of "{{jobRole}}".
  The interview is a "{{interviewType}}" type, and the difficulty level is "{{difficultyLevel}}".

  Key Instructions:
  1. Specificity is Crucial: Questions must be directly and deeply relevant to the specified {{jobRole}}, {{interviewType}}, and {{difficultyLevel}}. Consider the typical skills, responsibilities, and scenarios associated with this exact role and level.
  2. Ensure Variety: Generate a diverse set of questions. Avoid asking questions that are too similar to each other or repetitive. Each question should explore a different aspect or scenario relevant to the role.
  3. Quality over Trivia: Focus on real-world, high-quality questions that assess genuine understanding and capability, not just rote memorization or trivia.
  4. Unique Generation: Strive to generate unique sets of questions each time, even if the input parameters are the same.
  5. Professional Tone: Maintain a professional and supportive tone throughout.

  Example: If the user selects "Senior Frontend Developer", "Technical" interview, "Advanced" difficulty, generate {{numQuestions}} questions that a senior frontend developer would genuinely encounter, covering complex JavaScript concepts, architectural patterns, performance optimization, and leadership/mentoring scenarios, rather than basic HTML/CSS questions.

  Format your response as a JSON object with a "questions" field, which is an array of strings. For example:
  {
    "questions": [
      "Describe a time you had to refactor a large legacy codebase. What was your approach and what were the outcomes?",
      "How would you design a scalable and resilient micro-frontend architecture for a high-traffic e-commerce platform?"
    ]
  }`,
});

const generateInterviewQuestionsFlow = ai.defineFlow(
  {
    name: 'generateInterviewQuestionsFlow',
    inputSchema: GenerateInterviewQuestionsInputSchema,
    outputSchema: GenerateInterviewQuestionsOutputSchema,
  },
  async input => {
    const {output} = await generateInterviewQuestionsPrompt(input);
    return output!;
  }
);

