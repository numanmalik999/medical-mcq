// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import OpenAI from 'https://esm.sh/openai@4.52.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateEnhancedContent(
  question: string,
  options: { A: string; B: string; C: string; D: string },
  categoryList: string[]
) {
  // @ts-ignore
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) throw new Error('OpenAI API key is missing.');

  const openai = new OpenAI({ apiKey: openaiApiKey });

  const prompt = `You are an expert medical educator and content creator for a platform called 'Study Prometric,' which helps users prepare for medical licensing exams.

Your task is to analyze a given multiple-choice question (MCQ) and its options. You must first determine the single best correct answer and then generate a comprehensive, structured explanation.

MCQ to analyze:
Question: "${question}"
Options:
A: ${options.A}
B: ${options.B}
C: ${options.C}
D: ${options.D}

Here is a list of available categories:
${categoryList.join(', ')}

The explanation must be structured as follows:

Brief Scenario Analysis: Start with a 1-2 sentence summary of the clinical scenario presented in the question.
Correct Answer Justification: Clearly state the correct answer (e.g., 'The correct answer is B.') and provide a detailed, step-by-step justification for why it is the best choice.
Incorrect Options Analysis: Explain why each of the other three options is incorrect. Use clear headings for each (e.g., 'Why A is incorrect:').
After the main explanation, you MUST include the following five sections, using the exact markdown headings provided. If a section is not applicable to the question (e.g., no specific diagnosis), you MUST omit that section entirely from the output.

The Diagnosis
Best Initial Test
Best Diagnostic Test
Best Initial Treatment
Best Treatment
Finally, assign a difficulty level to the question. It must be one of three values: 'Easy', 'Medium', or 'Hard'.

The entire output MUST be a single, valid JSON object with exactly four top-level keys: correct_answer, explanation_text, difficulty, and suggested_category_name.
The value for "explanation_text" MUST be a single string containing the full, formatted explanation. Use markdown for headings (e.g., '### Correct Answer Justification') and newlines (\\n) for spacing.

Example format: {"correct_answer": "B", "explanation_text": "### Brief Scenario Analysis...", "difficulty": "Medium", "suggested_category_name": "Cardiology"}

Do not include any introductory text, markdown code blocks (like \`\`\`json), or any other text outside of this JSON object.`;

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const responseContent = chatCompletion.choices[0].message.content;
  if (!responseContent) throw new Error('OpenAI did not return any content.');
  
  const parsedContent = JSON.parse(responseContent);

  // Defensive check for explanation format
  let explanationText = parsedContent.explanation_text;
  if (typeof explanationText === 'object' && explanationText !== null) {
      console.warn("AI returned an object for explanation_text. Formatting it into a string.");
      explanationText = Object.entries(explanationText)
          .map(([key, value]) => `**${key.replace(/_/g, ' ')}**\n${value}`)
          .join('\n\n');
  }
  parsedContent.explanation_text = explanationText;

  return parsedContent;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mcq_ids } = await req.json();
    if (!Array.isArray(mcq_ids) || mcq_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'mcq_ids must be a non-empty array.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Fetch all categories and MCQs
    const { data: categories, error: catError } = await supabaseAdmin.from('categories').select('id, name');
    if (catError) throw catError;
    const categoryList = categories.map((c: { name: string }) => c.name);

    const { data: mcqs, error: mcqError } = await supabaseAdmin.from('mcqs').select('*').in('id', mcq_ids);
    if (mcqError) throw mcqError;

    let successCount = 0;
    const errors: string[] = [];

    // 2. Process each MCQ
    for (const mcq of mcqs) {
      try {
        const aiResponse = await generateEnhancedContent(
          mcq.question_text,
          { A: mcq.option_a, B: mcq.option_b, C: mcq.option_c, D: mcq.option_d },
          categoryList
        );

        // 3. Find or create category
        let categoryId: string;
        let existingCategory = categories.find((c: { name: string }) => c.name.toLowerCase() === aiResponse.suggested_category_name.toLowerCase());
        if (existingCategory) {
          categoryId = existingCategory.id;
        } else {
          const { data: newCategory, error: newCatError } = await supabaseAdmin.from('categories').insert({ name: aiResponse.suggested_category_name }).select('id').single();
          if (newCatError) throw newCatError;
          categoryId = newCategory.id;
          categories.push({ id: categoryId, name: aiResponse.suggested_category_name }); // Add to local list
        }

        // 4. Upsert explanation
        const { data: explanation, error: expError } = await supabaseAdmin.from('mcq_explanations').upsert({
          id: mcq.explanation_id || undefined,
          explanation_text: aiResponse.explanation_text,
        }).select('id').single();
        if (expError) throw expError;

        // 5. Update MCQ
        const { error: updateMcqError } = await supabaseAdmin.from('mcqs').update({
          correct_answer: aiResponse.correct_answer,
          difficulty: aiResponse.difficulty,
          explanation_id: explanation.id,
        }).eq('id', mcq.id);
        if (updateMcqError) throw updateMcqError;

        // 6. Update category link
        await supabaseAdmin.from('mcq_category_links').delete().eq('mcq_id', mcq.id);
        const { error: linkError } = await supabaseAdmin.from('mcq_category_links').insert({ mcq_id: mcq.id, category_id: categoryId });
        if (linkError) throw linkError;

        successCount++;
      } catch (e: any) {
        errors.push(`MCQ ${mcq.id}: ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ successCount, errorCount: errors.length, errors }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});