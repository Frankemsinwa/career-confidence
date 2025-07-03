'use server';
/**
 * @fileOverview Analyzes a presentation for structure, clarity, pacing, and engagement.
 *
 * - analyzePresentation - A function that analyzes presentation skills.
 * - AnalyzePresentationInput - The input type for the analyzePresentation function.
 * - AnalyzePresentationOutput - The return type for the analyzePresentation function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { presentationTimeFrames } from '@/lib/types';

const timeFrameToMinutes = (timeFrame: (typeof presentationTimeFrames)[number]): number => {
  return parseInt(timeFrame.split(' ')[0]);
}

const AnalyzePresentationInputSchema = z.object({
  topic: z.string().describe('The topic of the presentation.'),
  audience: z.string().describe('The target audience for the presentation.'),
  timeFrame: z.enum(presentationTimeFrames).describe('The target duration of the presentation.'),
  transcript: z.string().describe('The transcribed text of the user\'s presentation.'),
  actualDurationSeconds: z
    .number()
    .min(0)
    .describe('The actual duration of the recording in seconds.'),
});
export type AnalyzePresentationInput = z.infer<typeof AnalyzePresentationInputSchema>;

const AnalyzePresentationOutputSchema = z.object({
  structureFeedback: z.string().describe('Feedback on the logical structure and flow of the presentation (e.g., clear intro, body, conclusion).'),
  clarityFeedback: z.string().describe('Feedback on the clarity of the message and how easy it was to understand.'),
  engagementFeedback: z.string().describe('Feedback on how engaging the presentation was, based on the language used.'),
  paceFeedback: z.string().describe('Feedback on the speaking pace (WPM) and how it fits the context of a presentation.'),
  timeManagementFeedback: z.string().describe('Feedback on how the actual duration compares to the target time frame.'),
  
  structureScore: z.number().min(0).max(100).describe('A score (0-100) for the presentation\'s structure and flow.'),
  clarityScore: z.number().min(0).max(100).describe('A score (0-100) for the clarity of the message.'),
  engagementScore: z.number().min(0).max(100).describe('A score (0-100) for how engaging the presentation was.'),
  timeManagementScore: z.number().min(0).max(100).describe('A score (0-100) for time management, comparing actual vs. target duration.'),
  fillerWordsScore: z.number().min(0).max(100).describe('A score (0-100) based on the minimal use of filler words. Higher is better.'),

  speakingPaceWPM: z.number().describe('The calculated speaking pace in words per minute.'),
  fillerWordsFound: z.array(z.string()).describe('A list of common filler words identified in the transcript.'),
});
export type AnalyzePresentationOutput = z.infer<typeof AnalyzePresentationOutputSchema>;

export async function analyzePresentation(
  input: AnalyzePresentationInput
): Promise<AnalyzePresentationOutput> {
  return analyzePresentationFlow(input);
}

const COMMON_FILLER_WORDS = [
  'um', 'uh', 'er', 'ah', 'like', 'actually', 'basically', 'seriously',
  'literally', 'you know', 'i mean', 'so', 'well', 'right', 'okay', 'see'
].join(', ');


const analyzePresentationFlow = ai.defineFlow(
  {
    name: 'analyzePresentationFlow',
    inputSchema: AnalyzePresentationInputSchema,
    outputSchema: AnalyzePresentationOutputSchema,
    model: 'googleai/gemini-1.5-flash',
  },
  async (input) => {
    const wordCount = input.transcript.split(/\s+/).filter(Boolean).length;
    let speakingPaceWPM = 0;
    if (input.actualDurationSeconds > 0) {
      speakingPaceWPM = Math.round((wordCount / input.actualDurationSeconds) * 60);
    }
    const targetMinutes = timeFrameToMinutes(input.timeFrame);

    const prompt = `You are an expert public speaking coach. Your task is to analyze a presentation transcript and provide constructive feedback as a JSON object.

    Here is the context:
    - Presentation Topic: "${input.topic}"
    - Target Audience: "${input.audience}"
    - Target Time Frame: ${input.timeFrame} (${targetMinutes} minutes)
    - Actual Recorded Duration: ${input.actualDurationSeconds} seconds
    - Word Count: ${wordCount} words
    - Speaking Pace: ${speakingPaceWPM} WPM

    Here is the presentation transcript:
    ---
    ${input.transcript}
    ---

    Please provide your analysis as a JSON object with the following fields:

    1.  **Textual Feedback**:
        - "structureFeedback": Evaluate the presentation's structure. Does it have a clear introduction, body, and conclusion? Is the flow logical?
        - "clarityFeedback": How clear and easy to understand was the content? Was jargon used appropriately for the target audience?
        - "engagementFeedback": Based on the language, how engaging was the presentation? Does it use storytelling, rhetorical questions, or other techniques to hold the audience's attention?
        - "paceFeedback": Comment on the speaking pace (${speakingPaceWPM} WPM). A good presentation pace is typically 140-170 WPM. Is the pace appropriate?
        - "timeManagementFeedback": Analyze the time management. The target was ${targetMinutes} minutes, and the actual duration was ${input.actualDurationSeconds} seconds. Was the presenter on time, too short, or too long? Provide specific feedback.

    2.  **Scores (0-100)**:
        - "structureScore": Rate the structure and logical flow.
        - "clarityScore": Rate the clarity of the message.
        - "engagementScore": Rate how well the presenter likely engaged the audience.
        - "timeManagementScore": Rate the time management. A perfect score is for being very close to the target duration. Deduct points for being significantly over or under time.
        - "fillerWordsScore": Rate the use of filler words. A higher score means fewer filler words were used. A few filler words are acceptable, but many should result in a lower score.

    3.  **Data Points**:
        - "speakingPaceWPM": The calculated speaking pace, which is ${speakingPaceWPM}.
        - "fillerWordsFound": Identify and list common English filler words from the transcript. Common filler words include: ${COMMON_FILLER_WORDS}. If none, return an empty array.
    `;

    const {output} = await ai.generate({
        prompt: prompt,
        output: {
            schema: AnalyzePresentationOutputSchema
        }
    });

    return output!;
  }
);
