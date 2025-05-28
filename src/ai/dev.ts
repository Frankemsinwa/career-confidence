import { config } from 'dotenv';
config();

import '@/ai/flows/generate-interview-questions.ts';
import '@/ai/flows/provide-model-answer.ts';
import '@/ai/flows/evaluate-answer.ts';