// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to sanitize and parse AI JSON responses
function parseAiJson(text: string) {
  try {
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1) {
      cleaned = cleaned.substring(start, end + 1);
    }

    // Escape internal raw newlines within string literals
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
  baseUrl: string,
  apiKey: string,
  openaiModel: string,
  isUncategorized: boolean
) {
  const categoryInstruction = isUncategorized
    ? `The question is currently UN-CATEGORIZED. Suggest the best "suggested_category_name" from the provided list or a relevant medical specialty.`
    : `The question already has a category. Return null for "suggested_category_name". DO NOT suggest a category.`;

  const prompt = `You are an expert medical educator for 'Study Prometric'. Analyze this MCQ:
Question: "${question}"
Options:
A) ${options.A}
B) ${options.B}
C) ${options.C}
D) ${options.D}

Available categories: ${categoryList.join(', ')}
${categoryInstruction}

CRITICAL CONTENT REQUIREMENTS FOR explanation_text:
- Write clear, exam-focused medical reasoning.
- Explicitly explain the clinical scenario.
- Explain why the selected correct answer is correct.
- Explain why EACH incorrect option (A, B, C, D except the correct one) is incorrect.
- Include ALL of these section headings exactly as markdown H2:
  ## Scenario Explanation
  ## Why the Correct Answer Is Correct
  ## Why the Other Options Are Incorrect
  ## The Diagnosis
  ## Best Initial Test
  ## Best Initial  Treatment
  ## Best Diagnostic Test
  ## Best Definitive Treatment


SECTION RULES:
- In "Why the Other Options Are Incorrect", use bullet points for each incorrect option with labels like "- A:", "- B:", etc.
- For any section that is not applicable, write "Not applicable for this scenario." (do not omit the section).
- Keep the explanation clinically accurate and concise.

OUTPUT FORMAT REQUIREMENTS:
1. Return ONLY a valid JSON object.
2. Use keys exactly: "correct_answer", "explanation_text", "difficulty", "suggested_category_name".
3. "correct_answer" must be exactly one of: "A", "B", "C", "D".
4. "difficulty" must be exactly one of: "Easy", "Medium", "Hard".
5. "suggested_category_name" must be a string when suggesting a category, otherwise null.

Expected JSON structure:
{"correct_answer":"A|B|C|D","explanation_text":"...","difficulty":"Easy|Medium|Hard","suggested_category_name":null}`;

  const endpoint = `${baseUrl}/chat/completions`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errText}`);
  }

  const data = await response.json() as any;
  const text = data?.choices?.[0]?.message?.content ?? '';

  if (!text) {
    throw new Error('AI returned an empty response.');
  }

  const parsed = parseAiJson(text);

  if (!['A', 'B', 'C', 'D'].includes(parsed?.correct_answer)) {
    throw new Error('AI returned an invalid correct_answer.');
  }

  if (!['Easy', 'Medium', 'Hard'].includes(parsed?.difficulty)) {
    throw new Error('AI returned an invalid difficulty.');
  }

  if (typeof parsed?.explanation_text !== 'string' || !parsed.explanation_text.trim()) {
    throw new Error('AI returned empty explanation_text.');
  }

  const requiredHeadings = [
    '## Scenario Explanation',
    '## Why the Correct Answer Is Correct',
    '## Why the Other Options Are Incorrect',
    '## The Diagnosis',
    '## Best Initial Diagnostic Test',
    '## Best Initial Definitive Treatment',
    '## Best Diagnostic Test',
    '## Best Definitive Treatment',
  ];

  const missingHeadings = requiredHeadings.filter((heading) => !parsed.explanation_text.includes(heading));
  if (missingHeadings.length > 0) {
    const filler = missingHeadings.map((h) => `${h}\nNot applicable for this scenario.`).join('\n\n');
    parsed.explanation_text = `${parsed.explanation_text.trim()}\n\n${filler}`;
  }

  return parsed;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { mcq_ids } = await req.json();
    if (!mcq_ids || !Array.isArray(mcq_ids)) throw new Error('Missing mcq_ids array');

    // @ts-ignore
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    // @ts-ignore
    const openaiBaseUrl = Deno.env.get('OPENAI_BASE_URL');
    // @ts-ignore
    const openaiModel = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not set.');
    }

    const normalizedBaseUrl = openaiBaseUrl?.trim().replace(/\/$/, '');
    const baseUrlCandidates = normalizedBaseUrl
      ? (normalizedBaseUrl.endsWith('/v1') ? [normalizedBaseUrl] : [`${normalizedBaseUrl}/v1`])
      : ['https://api.openai.com/v1'];

    let resolvedBaseUrl: string | undefined;
    for (const candidate of baseUrlCandidates) {
      try {
        const testResp = await fetch(candidate, { method: 'HEAD' });
        if (testResp.ok || testResp.status < 500) {
          resolvedBaseUrl = candidate;
          break;
        }
      } catch {
        // try next candidate
      }
    }

    if (!resolvedBaseUrl) {
      throw new Error('Could not reach OpenAI API at any known endpoint.');
    }

    // @ts-ignore
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: categories } = await supabaseAdmin.from('categories').select('id, name');
    const categoryList = categories ? categories.map((c: any) => c.name) : [];

    const { data: mcqs } = await supabaseAdmin.from('mcqs').select('*').in('id', mcq_ids);

    let successCount = 0;
    const errors: string[] = [];

    for (const mcq of (mcqs || [])) {
      try {
        // 1. Check current category status
        const { count: linkCount } = await supabaseAdmin
          .from('mcq_category_links')
          .select('*', { count: 'exact', head: true })
          .eq('mcq_id', mcq.id);

        const isUncategorized = (linkCount || 0) === 0;

        const aiResponse = await generateEnhancedContent(
          mcq.question_text,
          { A: mcq.option_a, B: mcq.option_b, C: mcq.option_c, D: mcq.option_d },
          categoryList,
          resolvedBaseUrl,
          openaiApiKey,
          openaiModel,
          isUncategorized
        );

        // 2. Category Logic
        if (isUncategorized && aiResponse.suggested_category_name) {
            let categoryId;
            let existingCategory = (categories || []).find((c: any) => c.name.toLowerCase() === aiResponse.suggested_category_name?.toLowerCase());

            if (existingCategory) {
              categoryId = existingCategory.id;
            } else {
              const { data: newCat, error: catInsertError } = await supabaseAdmin.from('categories').insert({ name: aiResponse.suggested_category_name }).select('id').single();
              if (!catInsertError && newCat) {
                categoryId = newCat.id;
                if (categories) categories.push({ id: categoryId, name: aiResponse.suggested_category_name });
              }
            }

            if (categoryId) {
              await supabaseAdmin.from('mcq_category_links').insert({ mcq_id: mcq.id, category_id: categoryId });
            }
        }

        // 3. Update or Insert Explanation
        const { data: exp, error: expError } = await supabaseAdmin.from('mcq_explanations').upsert({
          id: mcq.explanation_id || undefined,
          explanation_text: aiResponse.explanation_text,
        }).select('id').single();

        if (expError) throw expError;

        // 4. Update MCQ metadata
        await supabaseAdmin.from('mcqs').update({
          correct_answer: aiResponse.correct_answer,
          difficulty: aiResponse.difficulty,
          explanation_id: exp.id,
        }).eq('id', mcq.id);

        successCount++;
      } catch (e: any) {
        console.error(`[bulk-enhance-mcqs] Error for MCQ ${mcq.id}:`, e.message);
        errors.push(`MCQ ${mcq.id}: ${e.message}`);
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