// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.14.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { mcq_id } = await req.json();
    
    // @ts-ignore
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 1. Fetch the MCQ and its explanation
    const { data: mcq, error: mcqErr } = await supabaseAdmin
      .from('mcqs')
      .select('*, mcq_explanations(explanation_text)')
      .eq('id', mcq_id)
      .single();

    if (mcqErr || !mcq) throw new Error('MCQ not found');

    // 2. AI Brainstorming
    const prompt = `You are a medical education expert. Transform this MCQ into a Spaced Repetition (Anki-style) Flashcard.
    
    MCQ Question: ${mcq.question_text}
    Explanation: ${mcq.mcq_explanations?.explanation_text || 'No explanation provided'}

    TASK:
    Extract the most important clinical pearl or "must-know" fact.
    Front Side: A concise question or scenario.
    Back Side: The diagnosis, treatment, or key mechanism in 1-2 short sentences.

    Return ONLY a JSON object:
    { "front": "...", "back": "..." }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const cardData = JSON.parse(text);

    return new Response(JSON.stringify(cardData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});