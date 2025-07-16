'use server';
/**
 * @fileOverview Generates a model presentation outline/script.
 *
 * - generatePresentationSuggestion - A function that creates a presentation suggestion.
 * - GeneratePresentationSuggestionInput - The input type for the function.
 * - GeneratePresentationSuggestionOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { presentationTimeFrames } from '@/lib/types';

const GeneratePresentationSuggestionInputSchema = z.object({
  topic: z.string().describe('The topic of the presentation.'),
  audience: z.string().describe('The target audience for the presentation.'),
  timeFrame: z.enum(presentationTimeFrames).describe('The target duration of the presentation.'),
});
export type GeneratePresentationSuggestionInput = z.infer<typeof GeneratePresentationSuggestionInputSchema>;

const GeneratePresentationSuggestionOutputSchema = z.object({
  suggestion: z.string().describe('A model presentation outline or script, structured with an introduction, key points for the body, and a conclusion.'),
});
export type GeneratePresentationSuggestionOutput = z.infer<typeof GeneratePresentationSuggestionOutputSchema>;

export async function generatePresentationSuggestion(
  input: GeneratePresentationSuggestionInput
): Promise<GeneratePresentationSuggestionOutput> {
  return generatePresentationSuggestionFlow(input);
}

const prompt = ai.definePrompt({
    name: 'generatePresentationSuggestionPrompt',
    input: { schema: GeneratePresentationSuggestionInputSchema },
    output: { schema: GeneratePresentationSuggestionOutputSchema },
    prompt: `You are an expert public speaking coach. Your task is to create a model presentation outline based on the user's requirements.

    The outline should be structured, clear, and tailored to the provided context. It should include a compelling introduction, a few well-defined key points for the body, and a strong conclusion.

    Here is the context:
    - Presentation Topic: "{{topic}}"
    - Target Audience: "{{audience}}"
    - Target Time Frame: {{timeFrame}}

    Please generate a model presentation outline as a JSON object with a single "suggestion" field. The suggestion should be a markdown-formatted string. For example:

    ### Introduction
    - **Hook:** Start with a surprising statistic about [Topic].
    - **Introduce Yourself:** Briefly state your name and expertise in [Topic].
    - **State the Purpose:** "Today, I'm going to talk about..."

    ### Key Point 1: [Name of Point 1]
    - Detail A...
    - Detail B...
    - Provide a brief example or data point.

    ### Key Point 2: [Name of Point 2]
    - Detail A...
    - Detail B...

    ### Conclusion
    - **Summarize Key Points:** Briefly recap the main takeaways.
    - **Call to Action:** What do you want the audience to do or think about next?
    - **Q&A:** Open the floor for questions.
    `
});

const generatePresentationSuggestionFlow = ai.defineFlow(
  {
    name: 'generatePresentationSuggestionFlow',
    inputSchema: GeneratePresentationSuggestionInputSchema,
    outputSchema: GeneratePresentationSuggestionOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
