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

async function auditSingleMcq(mcq: any, categoryId: string | null, supabase: any, model: any) {
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

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const report = JSON.parse(text);

    // Save to database
    await supabase.from('content_audit_reports').insert({
      mcq_id: mcq.id,
      category_id: categoryId,
      score: report.score,
      issues: report.issues,
      suggestions: report.suggestions,
      is_clinically_sound: report.is_clinically_sound,
      seo_keywords: report.seo_keywords
    });

    return report;
  } catch (e) {
    console.error(`Audit failed for MCQ ${mcq.id}:`, e);
    return null;
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { mcq_id, category_id } = await req.json();
    
    // @ts-ignore
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    
    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    if (mcq_id) {
      // Single MCQ Audit
      const { data: mcq } = await supabaseAdmin.from('mcqs').select('*, mcq_explanations(explanation_text)').eq('id', mcq_id).single();
      const report = await auditSingleMcq(mcq, null, supabaseAdmin, model);
      return new Response(JSON.stringify(report), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else if (category_id) {
      // Category Audit (Background Process)
      const { data: links } = await supabaseAdmin.from('mcq_category_links').select('mcq_id').eq('category_id', category_id);
      const mcqIds = links?.map((l: any) => l.mcq_id) || [];

      // We use Edge Function backgrounding by not awaiting the loop
      (async () => {
        for (const id of mcqIds) {
          const { data: mcq } = await supabaseAdmin.from('mcqs').select('*, mcq_explanations(explanation_text)').eq('id', id).single();
          if (mcq) await auditSingleMcq(mcq, category_id, supabaseAdmin, model);
          await new Promise(r => setTimeout(r, 1000));
        }
      })();

      return new Response(JSON.stringify({ message: `Audit of ${mcqIds.length} MCQs started in background.` }), { 
        status: 202, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    throw new Error('Missing mcq_id or category_id');
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});