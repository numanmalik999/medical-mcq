// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define the expected structure of an incoming MCQ object
interface IncomingMcq {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  image_url?: string;
  category_name?: string; 
  difficulty?: string;
  is_trial_mcq?: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client with service role key
  // @ts-ignore
  const supabaseAdmin = createClient(
    // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized: No Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { mcqs: incomingMcqsRaw } = await req.json();
    const incomingMcqs: IncomingMcq[] = incomingMcqsRaw;

    if (!Array.isArray(incomingMcqs)) {
      return new Response(JSON.stringify({ error: 'Invalid input: Expected an array of MCQs.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const mcq of incomingMcqs) {
      try {
        // 1. Insert explanation
        const { data: explanationData, error: explanationError } = await supabaseAdmin
          .from('mcq_explanations')
          .insert({
            explanation_text: mcq.explanation || 'No explanation provided.',
            image_url: mcq.image_url || null,
          })
          .select('id')
          .single();

        if (explanationError) throw new Error(`Explanation insert failed: ${explanationError.message}`);

        // 2. Insert MCQ
        const { data: mcqData, error: mcqError } = await supabaseAdmin
          .from('mcqs')
          .insert({
            question_text: mcq.question,
            option_a: mcq.options.A,
            option_b: mcq.options.B,
            option_c: mcq.options.C,
            option_d: mcq.options.D,
            correct_answer: mcq.correct_answer,
            explanation_id: explanationData.id,
            difficulty: mcq.difficulty || null,
            is_trial_mcq: mcq.is_trial_mcq ?? false,
          })
          .select('id')
          .single();

        if (mcqError) throw new Error(`MCQ insert failed: ${mcqError.message}`);

        // 3. Handle Categories (Multi-support)
        if (mcq.category_name) {
          // Split by comma and trim whitespace
          const categoryNames = mcq.category_name
            .split(',')
            .map(name => name.trim())
            .filter(name => name.length > 0);

          for (const catName of categoryNames) {
            let categoryId: string | null = null;

            // Check if category exists
            const { data: existingCategory, error: categoryFetchError } = await supabaseAdmin
              .from('categories')
              .select('id')
              .eq('name', catName)
              .maybeSingle();

            if (existingCategory) {
              categoryId = existingCategory.id;
            } else {
              // Create new category
              const { data: newCategory, error: categoryInsertError } = await supabaseAdmin
                .from('categories')
                .insert({ name: catName })
                .select('id')
                .single();

              if (categoryInsertError) {
                console.error(`Category insert failed for "${catName}":`, categoryInsertError);
                continue; // Skip this specific category link but continue
              }
              categoryId = newCategory.id;
            }

            // Link MCQ to category
            if (categoryId) {
              const { error: linkError } = await supabaseAdmin
                .from('mcq_category_links')
                .insert({
                  mcq_id: mcqData.id,
                  category_id: categoryId,
                });

              if (linkError) {
                console.error(`Link failed for "${catName}":`, linkError);
              }
            }
          }
        }

        successCount++;
      } catch (e: any) {
        errorCount++;
        errors.push(`Failed to process MCQ "${mcq.question.substring(0, 50)}...": ${(e as Error).message}`);
        console.error(`Error processing MCQ: ${(e as Error).message}`, mcq);
      }
    }

    return new Response(JSON.stringify({
      message: 'Bulk upload process completed.',
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: errorCount > 0 ? 207 : 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unhandled error in bulk-upload-mcqs Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});