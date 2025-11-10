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
  correct_answer: 'A' | 'B' | 'C' | 'D'
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

  const prompt = `Given the following multiple-choice question, its options, and the correct answer, generate a detailed explanation. The explanation should clearly state why the correct answer is right and why each of the other options is wrong, with each point on a new line.
After the explanation, include the following five distinct sections in this exact order:
1. A section titled '### The Diagnosis' with the clinical diagnosis, if the question implies a specific condition. If no diagnosis is applicable, omit this section entirely.
2. A section titled '### Best Initial Test' with the first test that should be ordered in the clinical scenario.
3. A section titled '### Best Diagnostic Test' with the most definitive test to confirm the diagnosis.
4. A section titled '### Best Initial Treatment' with the immediate first-line therapy.
5. A section titled '### Best Treatment' with the overall management plan for the condition.
Also, assign a difficulty level (Easy, Medium, Hard) to the question.

Question: ${question}
Options:
A: ${options.A}
B: ${options.B}
C: ${options.C}
D: ${options.D}
Correct Answer: ${correct_answer}

Please provide the output in a JSON format with two fields: "explanation_text" (string, containing the structured explanation and all five sections), and "difficulty" (string, one of "Easy", "Medium", "Hard").
IMPORTANT: Only return the JSON object, no other text or markdown.`;

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
    return {
      explanation_text: parsedContent.explanation_text,
      difficulty: parsedContent.difficulty,
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

    const { question, options, correct_answer } = requestBody;

    if (!question || !options || !correct_answer) {
      return new Response(JSON.stringify({ error: 'Missing required fields: question, options, or correct_answer.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await generateExplanationAndDifficulty(question, options, correct_answer);

    return new Response(JSON.stringify(aiResponse), {
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