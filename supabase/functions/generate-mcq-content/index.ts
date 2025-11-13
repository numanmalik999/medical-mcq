// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import OpenAI from 'https://esm.sh/openai@4.52.0'; // Using a specific version for stability

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateExplanationAndDifficulty(
  question: string,
  options: { A: string; B: string; C: string; D: string },
) {
  // @ts-ignore // Ignore the Deno global type error
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    console.error('OPENAI_API_KEY is not set in environment variables.');
    throw new Error('OpenAI API key is missing. Please configure it in Supabase secrets.');
  }

  // Initialize OpenAI client
  const openai = new OpenAI({
    apiKey: openaiApiKey,
  });

  const prompt = `You are an expert medical educator and content creator for a platform called 'Study Prometric,' which helps users prepare for medical licensing exams.

Your task is to analyze the following multiple-choice question (MCQ) and its options:

Question: ${question}
Option A: ${options.A}
Option B: ${options.B}
Option C: ${options.C}
Option D: ${options.D}

You must first determine the single best correct answer and then generate a comprehensive, structured explanation.

The explanation must be structured as follows:
1.  **Brief Scenario Analysis:** Start with a 1-2 sentence summary of the clinical scenario presented in the question.
2.  **Correct Answer Justification:** Clearly state the correct answer (e.g., 'The correct answer is B.') and provide a detailed, step-by-step justification for why it is the best choice.
3.  **Incorrect Options Analysis:** Explain why each of the other three options is incorrect. Use clear headings for each (e.g., 'Why A is incorrect:').

After the main explanation, you MUST include the following five sections, using the exact markdown headings provided. If a section is not applicable to the question, you MUST omit that section entirely from the output.

### The Diagnosis
State the clinical diagnosis, followed by a brief 1-2 sentence summary of the condition.
### Best Initial Test
### Best Diagnostic Test
### Best Initial Treatment
### Best Treatment

Finally, assign a difficulty level to the question. It must be one of three values: 'Easy', 'Medium', or 'Hard'.

The entire output MUST be a single, valid JSON object with exactly three top-level keys: \`correct_answer\`, \`explanation_text\`, and \`difficulty\`. The value for the \`explanation_text\` key MUST be a single string containing all the structured parts of the explanation, formatted with markdown (using newlines and headings).

Example format: \`{"correct_answer": "B", "explanation_text": "Brief Scenario Analysis...\\n\\nCorrect Answer Justification...\\n\\n### The Diagnosis\\n...", "difficulty": "Medium"}\`

Do not include any introductory text, markdown code blocks (like \`\`\`json), or any other text outside of this JSON object.`;

  console.log('OpenAI Prompt:', prompt); // Log the prompt being sent to OpenAI

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Using a widely available and capable model
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }, // Request JSON output
      temperature: 0.7, // Adjust for creativity vs. consistency
    });

    const responseContent = chatCompletion.choices[0].message.content;
    console.log('OpenAI Raw Response Content:', responseContent); // Log the raw response from OpenAI

    if (!responseContent) {
      throw new Error('OpenAI AI did not return any content.');
    }

    const parsedContent = JSON.parse(responseContent);
    
    // Ensure the AI returned the determined correct answer
    if (!parsedContent.correct_answer || !['A', 'B', 'C', 'D'].includes(parsedContent.correct_answer)) {
        throw new Error('AI failed to determine and return a valid "correct_answer" (A, B, C, or D).');
    }

    // Defensive check: if explanation_text is an object, stringify it to prevent UI errors.
    let explanationText = parsedContent.explanation_text;
    if (typeof explanationText === 'object' && explanationText !== null) {
        console.warn("AI returned an object for explanation_text despite instructions. Stringifying it as a fallback.");
        explanationText = JSON.stringify(explanationText, null, 2); // Pretty-print JSON as a fallback
    }

    return {
      explanation_text: explanationText,
      difficulty: parsedContent.difficulty,
      correct_answer: parsedContent.correct_answer, // Return the AI-determined correct answer
    };
  } catch (error) {
    console.error('Failed to generate content with OpenAI AI:', error);
    throw new Error(`OpenAI AI generation failed: ${(error as Error).message}`);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log('Incoming Request Body:', requestBody); // Log the incoming request body

    const { question, options } = requestBody;

    if (!question || !options) {
      return new Response(JSON.stringify({ error: 'Missing required fields: question or options.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Call AI function without the pre-selected correct_answer
    const aiResponse = await generateExplanationAndDifficulty(question, options);

    // Merge the AI-determined correct answer back into the response structure
    return new Response(JSON.stringify({
      explanation_text: aiResponse.explanation_text,
      difficulty: aiResponse.difficulty,
      correct_answer: aiResponse.correct_answer, // This is the AI-determined answer
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-mcq-content Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});