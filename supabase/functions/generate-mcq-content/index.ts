// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import OpenAI from 'https://esm.sh/openai@4.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateExplanationAndDifficulty(
  question: string,
  options: { A: string; B: string; C: string; D: string },
) {
  // @ts-ignore
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY is missing.');

  const openai = new OpenAI({ apiKey: openaiApiKey });

  const prompt = `You are an expert medical educator. Analyze the MCQ:
Question: ${question}
Options: A: ${options.A}, B: ${options.B}, C: ${options.C}, D: ${options.D}

Return JSON: {"correct_answer": "...", "explanation_text": "...", "difficulty": "..."}`;

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
  });

  return JSON.parse(chatCompletion.choices[0].message.content || '{}');
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { question, options } = await req.json();
    const result = await generateExplanationAndDifficulty(question, options);
    return new Response(JSON.stringify(result), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});