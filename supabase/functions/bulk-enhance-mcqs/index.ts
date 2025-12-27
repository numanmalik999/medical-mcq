// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.14.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateEnhancedContent(
  question: string,
  options: { A: string; B: string; C: string; D: string },
  categoryList: string[],
  model: any
) {
  const prompt = `You are an expert medical educator for 'Study Prometric'. Analyze this MCQ:
  Question: "${question}"
  Options: A: ${options.A}, B: ${options.B}, C: ${options.C}, D: ${options.D}

  Available categories: ${categoryList.join(', ')}

  Generate a structured explanation including:
  - Scenario Analysis
  - Correct Answer Justification
  - Incorrect Options Analysis
  - The Diagnosis (if applicable)
  - Best Initial/Diagnostic Test (if applicable)
  - Best Initial/Definitive Treatment (if applicable)

  Return ONLY a valid JSON object:
  {"correct_answer": "...", "explanation_text": "...", "difficulty": "Easy/Medium/Hard", "suggested_category_name": "..."}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text();
  text = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(text);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { mcq_ids } = await req.json();
    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // @ts-ignore
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: categories } = await supabaseAdmin.from('categories').select('id, name');
    const categoryList = categories.map((c: any) => c.name);
    const { data: mcqs } = await supabaseAdmin.from('mcqs').select('*').in('id', mcq_ids);

    let successCount = 0;
    const errors = [];

    for (const mcq of (mcqs || [])) {
      try {
        const aiResponse = await generateEnhancedContent(mcq.question_text, { A: mcq.option_a, B: mcq.option_b, C: mcq.option_c, D: mcq.option_d }, categoryList, model);

        let categoryId;
        let existingCategory = categories.find((c: any) => c.name.toLowerCase() === aiResponse.suggested_category_name.toLowerCase());
        if (existingCategory) {
          categoryId = existingCategory.id;
        } else {
          const { data: newCat } = await supabaseAdmin.from('categories').insert({ name: aiResponse.suggested_category_name }).select('id').single();
          categoryId = newCat.id;
          categories.push({ id: categoryId, name: aiResponse.suggested_category_name });
        }

        const { data: exp } = await supabaseAdmin.from('mcq_explanations').upsert({
          id: mcq.explanation_id || undefined,
          explanation_text: aiResponse.explanation_text,
        }).select('id').single();

        await supabaseAdmin.from('mcqs').update({
          correct_answer: aiResponse.correct_answer,
          difficulty: aiResponse.difficulty,
          explanation_id: exp.id,
        }).eq('id', mcq.id);

        await supabaseAdmin.from('mcq_category_links').delete().eq('mcq_id', mcq.id);
        await supabaseAdmin.from('mcq_category_links').insert({ mcq_id: mcq.id, category_id: categoryId });

        successCount++;
      } catch (e: any) {
        errors.push(`MCQ ${mcq.id}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ successCount, errorCount: errors.length, errors }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});