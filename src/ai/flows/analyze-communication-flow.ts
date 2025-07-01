
'use server';
/**
 * @fileOverview Analyzes the user's spoken answer for communication quality.
 *
 * - analyzeCommunication - A function that analyzes communication aspects.
 * - AnalyzeCommunicationInput - The input type for the analyzeCommunication function.
 * - AnalyzeCommunicationOutput - The return type for the analyzeCommunication function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeCommunicationInputSchema = z.object({
  answerText: z.string().describe('The transcribed text of the user\'s answer.'),
  recordingDurationSeconds: z
    .number()
    .min(0) // Allow 0, not just positive values.
    .describe('The duration of the user\'s answer recording in seconds.'),
  jobRole: z.string().describe('The job role the user is interviewing for.'),
  difficulty: z.enum(['Beginner', 'Intermediate', 'Advanced']).describe('The difficulty level of the interview.')
});
export type AnalyzeCommunicationInput = z.infer<
  typeof AnalyzeCommunicationInputSchema
>;

// New schema for the prompt's internal use, including wordCount
const AnalyzeCommunicationPromptInternalInputSchema = AnalyzeCommunicationInputSchema.extend({
  wordCount: z.number().describe('The number of words in the transcribed answer.'),
});
type AnalyzeCommunicationPromptInternalInput = z.infer<typeof AnalyzeCommunicationPromptInternalInputSchema>;


const AnalyzeCommunicationOutputSchema = z.object({
  clarityFeedback: z
    .string()
    .describe('Feedback on the clarity and conciseness of the answer.'),
  fillerWordsFound: z
    .array(z.string())
    .describe('A list of common filler words identified in the answer.'),
  confidenceCues: z
    .string()
    .describe(
      'Observations on textual cues that might indicate confidence or lack thereof (e.g., hesitant phrasing, strong statements).'
    ),
  speakingPaceWPM: z
    .number()
    .describe('Calculated speaking pace in words per minute.'),
  paceFeedback: z
    .string()
    .describe('Feedback on the speaking pace (e.g., too fast, too slow, good).'),
});
export type AnalyzeCommunicationOutput = z.infer<
  typeof AnalyzeCommunicationOutputSchema
>;

export async function analyzeCommunication(
  input: AnalyzeCommunicationInput
): Promise<AnalyzeCommunicationOutput> {
  return analyzeCommunicationFlow(input);
}

const COMMON_FILLER_WORDS = [
  'um', 'uh', 'er', 'ah', 'like', 'actually', 'basically', 'seriously',
  'literally', 'you know', 'i mean', 'so', 'well', 'right', 'okay', 'see'
].join(', ');

const analyzeCommunicationPrompt = ai.definePrompt({
  name: 'analyzeCommunicationPrompt',
  model: 'googleai/gemini-1.5-flash',
  input: {schema: AnalyzeCommunicationPromptInternalInputSchema}, // Use the new extended schema
  output: {schema: AnalyzeCommunicationOutputSchema},
  prompt: `You are an expert communication coach analyzing an interview answer.
The candidate is interviewing for the role of "{{jobRole}}" at "{{difficulty}}" level.
The candidate's transcribed answer is below:
---
{{{answerText}}}
---
The answer was delivered in {{recordingDurationSeconds}} seconds.
The answer has {{wordCount}} words.

Based *only* on the provided text, duration, and word count, analyze the following:

1.  **Clarity and Conciseness**: Provide brief feedback on how clear and to-the-point the answer is.
    For example: "The answer is clear and directly addresses the question." or "The answer could be more concise and focused."

2.  **Filler Words**: Identify common English filler words from the text. Common filler words include: ${COMMON_FILLER_WORDS}.
    List any identified filler words. If none, state that.

3.  **Confidence Cues (Textual)**: Analyze the text for phrasing that might suggest confidence (e.g., declarative statements, direct language) or a lack of confidence (e.g., excessive hedging, overly cautious language, very short hesitant sentences).
    Provide a brief observation. For example: "The use of direct statements suggests confidence." or "Phrases like 'I guess' or 'maybe' could suggest some hesitation."

4.  **Speaking Pace**:
    - The answer has {{wordCount}} words.
    - Calculate the speaking pace in words per minute (WPM) using the formula: ({{wordCount}} / {{recordingDurationSeconds}}) * 60. Round to the nearest whole number.
    - Provide feedback on this pace. General guidelines:
        - Slow: < 120 WPM (can sound hesitant or unenthusiastic)
        - Conversational/Good: 120-160 WPM (generally ideal for interviews)
        - Fast: > 160 WPM (can be hard to follow or sound rushed)
    For example: "The pace of 140 WPM is conversational and easy to follow." or "At 100 WPM, the pace is a bit slow, which might make you sound hesitant."

Ensure your entire response is formatted as a JSON object matching the output schema.
Do not add any preamble or explanation outside the JSON structure.
`,
});


const analyzeCommunicationFlow = ai.defineFlow(
  {
    name: 'analyzeCommunicationFlow',
    inputSchema: AnalyzeCommunicationInputSchema, // Flow's public input remains the same
    outputSchema: AnalyzeCommunicationOutputSchema,
  },
  async (input: AnalyzeCommunicationInput) => {
    const wordCount = input.answerText.split(/\s+/).filter(Boolean).length;
    let calculatedWPM = 0;
    if (input.recordingDurationSeconds > 0 && wordCount > 0) {
        calculatedWPM = Math.round((wordCount / input.recordingDurationSeconds) * 60);
    }

    const promptInternalInput: AnalyzeCommunicationPromptInternalInput = {
        ...input,
        wordCount: wordCount,
    };

    const {output} = await analyzeCommunicationPrompt(promptInternalInput);
    
    // Ensure the WPM in the output is the one we calculated, and override pace feedback if calculation is not possible.
    if (output) {
        output.speakingPaceWPM = calculatedWPM;
        if (wordCount === 0 || input.recordingDurationSeconds === 0) {
            output.paceFeedback = "Speaking pace could not be calculated as no recording duration was provided or the answer was empty.";
        }
    }
    return output!;
  }
);
