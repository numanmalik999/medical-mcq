// @ts-ignore
import { OpenAI } from 'https://esm.sh/openai@4.52.7';

// Initialize OpenAI client with API key from environment variables
// @ts-ignore
const openai = new OpenAI({
  // @ts-ignore
  apiKey: Deno.env.get('OPENAI_API_KEY'), // Added @ts-ignore
});

export async function generateExplanationAndDifficulty(
  question: string,
  options: { A: string; B: string; C: string; D: string },
  correct_answer: 'A' | 'B' | 'C' | 'D'
) {
  const prompt = `
  You are an expert in medical education. Your task is to provide a concise, accurate explanation for a multiple-choice question (MCQ) and determine its difficulty level.

  MCQ Details:
  Question: ${question}
  Option A: ${options.A}
  Option B: ${options.B}
  Option C: ${options.C}
  Option D: ${options.D}
  Correct Answer: ${correct_answer}

  Please provide:
  1. A detailed explanation for why the correct answer is correct, and briefly explain why the other options are incorrect.
  2. The difficulty level of the question. Choose one from: "Easy", "Medium", "Hard".

  Format your response as a JSON object with two keys: "explanation_text" (string) and "difficulty" (string).
  Example:
  {
    "explanation_text": "...",
    "difficulty": "Medium"
  }
  `;

  const chatCompletion = await openai.chat.completions.create({
    model: 'gpt-4o-mini', // Using gpt-4o-mini for cost-effectiveness and good performance
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = chatCompletion.choices[0].message.content;
  if (!content) {
    throw new Error("OpenAI did not return any content.");
  }
  return JSON.parse(content);
}