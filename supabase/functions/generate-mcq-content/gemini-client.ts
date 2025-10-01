// @ts-ignore
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.14.1'; // Using a specific version for stability

// @ts-ignore // Ignore the Deno global type error
const genAI = new GoogleGenerativeAI(Deno.env.get('GEMINI_API_KEY') ?? '');
const model = genAI.getGenerativeModel({ model: "gemini-pro" }); // You can choose other models like 'gemini-1.5-flash' if available and preferred

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

Please provide the output in a JSON format with two fields: "explanation_text" (string) and "difficulty" (string, one of "Easy", "Medium", "Hard").
IMPORTANT: Only return the JSON object, no other text or markdown.`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text(); // Gemini often returns raw text, which we expect to be JSON

    if (!text) {
      throw new Error('Gemini AI did not return any content.');
    }

    const parsedContent = JSON.parse(text);
    return {
      explanation_text: parsedContent.explanation_text,
      difficulty: parsedContent.difficulty,
    };
  } catch (error) {
    console.error('Failed to generate content with Gemini AI:', error);
    throw new Error(`Gemini AI generation failed: ${(error as Error).message}`);
  }
}