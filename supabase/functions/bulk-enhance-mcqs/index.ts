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

// Helper to sanitize and parse AI JSON responses
function parseAiJson(text: string) {
  try {
    // 1. Strip markdown code blocks
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 2. Locate the first '{' and last '}' to handle any surrounding text
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      cleaned = cleaned.substring(start, end + 1);
    }

    // 3. Replace internal raw newlines within string literals (common source of "Bad control character" error)
    // This looks for content between quotes and ensures literal newlines are escaped
    cleaned = cleaned.replace(/(?<=[:[])\s*"(?:[^"\\]|\\.)*"/gs, (match) => {
      return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    });

    return JSON.parse(cleaned);
  } catch (e: any) {
    console.error("[bulk-enhance-mcqs] JSON Parse Error. Raw text:", text);
    throw new Error(`Failed to parse AI response as valid JSON: ${e.message}`);
  }
}

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

  OUTPUT FORMAT REQUIREMENTS:
  1. Return ONLY a valid JSON object.
  2. Use the keys: "correct_answer", "explanation_text", "difficulty", "suggested_category_name".
  3. "difficulty" must be exactly one of: "Easy", "Medium", or "Hard".
  4. CRITICAL: Ensure all internal newlines in strings are escaped as "\\n". No raw unescaped newlines in the string values.

  Expected JSON structure:
  {"correct_answer": "...", "explanation_text": "...", "difficulty": "...", "suggested_category_name": "..."}`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  
  return parseAiJson(text);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { mcq_ids } = await req.json();
    if (!mcq_ids || !Array.isArray(mcq_ids)) throw new Error('Missing mcq_ids array');

    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // @ts-ignore
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: categories } = await supabaseAdmin.from('categories').select('id, name');
    const categoryList = categories ? categories.map((c: any) => c.name) : [];
    
    // Fetch MCQs in chunks or as a set
    const { data: mcqs } = await supabaseAdmin.from('mcqs').select('*').in('id', mcq_ids);

    let successCount = 0;
    const errors = [];

    for (const mcq of (mcqs || [])) {
      try {
        const aiResponse = await generateEnhancedContent(
          mcq.question_text, 
          { A: mcq.option_a, B: mcq.option_b, C: mcq.option_c, D: mcq.option_d }, 
          categoryList, 
          model
        );

        let categoryId;
        let existingCategory = (categories || []).find((c: any) => c.name.toLowerCase() === aiResponse.suggested_category_name?.toLowerCase());
        
        if (existingCategory) {
          categoryId = existingCategory.id;
        } else if (aiResponse.suggested_category_name) {
          const { data: newCat } = await supabaseAdmin.from('categories').insert({ name: aiResponse.suggested_category_name }).select('id').single();
          categoryId = newCat.id;
          if (categories) categories.push({ id: categoryId, name: aiResponse.suggested_category_name });
        }

        // Update or Insert Explanation
        const { data: exp } = await supabaseAdmin.from('mcq_explanations').upsert({
          id: mcq.explanation_id || undefined,
          explanation_text: aiResponse.explanation_text,
        }).select('id').single();

        // Update MCQ metadata
        await supabaseAdmin.from('mcqs').update({
          correct_answer: aiResponse.correct_answer,
          difficulty: aiResponse.difficulty,
          explanation_id: exp.id,
        }).eq('id', mcq.id);

        // Update Category Links
        if (categoryId) {
          await supabaseAdmin.from('mcq_category_links').delete().eq('mcq_id', mcq.id);
          await supabaseAdmin.from('mcq_category_links').insert({ mcq_id: mcq.id, category_id: categoryId });
        }

        successCount++;
      } catch (e: any) {
        console.error(`[bulk-enhance-mcqs] Error for MCQ \${mcq.id}:`, e.message);
        errors.push(`MCQ \${mcq.id}: \${e.message}`);
      }
    }

    return new Response(JSON.stringify({ successCount, errorCount: errors.length, errors }), { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  } catch (error: any) {
    console.error("[bulk-enhance-mcqs] Unhandled Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});