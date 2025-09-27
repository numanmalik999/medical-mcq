/// <reference lib="deno.ns" />
// @ts-ignore
import OpenAI from 'https://deno.land/x/openai@v4.33.0/mod.ts';

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

export async function generateExplanationAndDifficulty(
  question: string,
  options: { A: string; B: string; C: string; D: string },
  correct_answer: 'A' | 'B' | 'C' | 'D'
) {
  const prompt = `Given the following multiple-choice question, its options, and the correct answer, generate a detailed explanation for why the correct answer is right and why the other options are wrong. Also, assign a difficulty level (Easy, Medium, Hard) to the question.

Question: ${question}
Options:
A: ${options.A}
B: ${options.B}
C: ${options.C}
D: ${options.D}
Correct Answer: ${correct_answer}

Please provide the output in a JSON format with two fields: "explanation_text" (string) and "difficulty" (string, one of "Easy", "Medium", "Hard").`;

  const chatCompletion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo', // You can change this to 'gpt-4o' if you prefer and have access
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: "json_object" },
  });

  const content = chatCompletion.choices[0].message.content;
  if (!content) {
    throw new Error('AI did not return any content.');
  }

  try {
    const parsedContent = JSON.parse(content);
    return {
      explanation_text: parsedContent.explanation_text,
      difficulty: parsedContent.difficulty,
    };
  } catch (parseError) {
    console.error('Failed to parse AI response:', content, parseError);
    throw new Error('Failed to parse AI response into expected JSON format.');
  }
}