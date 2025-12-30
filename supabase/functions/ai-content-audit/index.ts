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
    
    // Fetch MCQ and Explanation
    const { data: mcq, error: fetchError } = await supabaseAdmin
      .from('mcqs')
      .select(`
        *,
        mcq_explanations (explanation_text)
      `)
      .eq('id', mcq_id)
      .single();

    if (fetchError || !mcq) throw new Error('MCQ not found');

    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Analyze this medical MCQ for clinical accuracy, distractors quality, and explanation clarity.
    
    Question: ${mcq.question_text}
    Options: A: ${mcq.option_a}, B: ${mcq.option_b}, C: ${mcq.option_c}, D: ${mcq.option_d}
    Correct: ${mcq.correct_answer}
    Explanation: ${mcq.mcq_explanations?.explanation_text || 'None'}

    Provide a JSON report with:
    {
      "score": 0-100,
      "issues": ["list of identified issues"],
      "suggestions": "how to improve",
      "is_clinically_sound": boolean,
      "seo_keywords": ["suggested keywords for this topic"]
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

    return new Response(text, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});