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
    const { category_id, limit = 10 } = await req.json();
    
    // @ts-ignore
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 1. Find MCQs in this category that DON'T have a flashcard yet
    const { data: existingCards } = await supabaseAdmin.from('flashcards').select('mcq_id');
    const existingMcqIds = existingCards?.map((c: any) => c.mcq_id) || [];

    let mcqQuery = supabaseAdmin
      .from('mcq_category_links')
      .select('mcq_id, mcqs(*, mcq_explanations(explanation_text))')
      .eq('category_id', category_id);

    if (existingMcqIds.length > 0) {
      mcqQuery = mcqQuery.not('mcq_id', 'in', `(${existingMcqIds.join(',')})`);
    }

    const { data: links, error: fetchErr } = await mcqQuery.limit(limit);
    if (fetchErr) throw fetchErr;

    const mcqsToProcess = links?.map((l: any) => l.mcqs).filter((m: any) => !!m) || [];
    
    let successCount = 0;
    const errors = [];

    for (const mcq of mcqsToProcess) {
      try {
        const prompt = `You are a medical education expert. Transform this MCQ into a Spaced Repetition (Anki-style) Flashcard.
        
        MCQ: ${mcq.question_text}
        Explanation: ${mcq.mcq_explanations?.explanation_text || 'None'}

        Return ONLY a JSON object: { "front": "Scenario/Question", "back": "Key Clinical Pearl" }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
        const cardData = JSON.parse(text);

        await supabaseAdmin.from('flashcards').insert({
          mcq_id: mcq.id,
          category_id: category_id,
          front_text: cardData.front,
          back_text: cardData.back
        });

        successCount++;
      } catch (e: any) {
        errors.push(`MCQ ${mcq.id}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ successCount, errorCount: errors.length, errors }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});