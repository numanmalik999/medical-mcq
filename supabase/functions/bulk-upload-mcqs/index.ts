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
  category_name?: string; // Changed from category_id to category_name
  difficulty?: string;
  is_trial_mcq?: boolean;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client with service role key
  // This bypasses RLS, which is necessary for bulk admin inserts
  // @ts-ignore
  const supabaseAdmin = createClient(
    // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Basic authentication check (optional, but good practice for admin functions)
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
        let categoryId: string | null = null;

        // Handle Category
        if (mcq.category_name) {
          // Check if category exists
          const { data: existingCategory, error: categoryFetchError } = await supabaseAdmin
            .from('categories')
            .select('id')
            .eq('name', mcq.category_name)
            .single();

          if (categoryFetchError && categoryFetchError.code !== 'PGRST116') { // PGRST116 means no rows found
            throw new Error(`Category fetch failed for "${mcq.category_name}": ${categoryFetchError.message}`);
          }

          if (existingCategory) {
            categoryId = existingCategory.id;
          } else {
            // Create new category if it doesn't exist
            const { data: newCategory, error: categoryInsertError } = await supabaseAdmin
              .from('categories')
              .insert({ name: mcq.category_name })
              .select('id')
              .single();

            if (categoryInsertError) {
              throw new Error(`Category insert failed for "${mcq.category_name}": ${categoryInsertError.message}`);
            }
            categoryId = newCategory.id;
          }
        }

        // 1. Insert explanation
        const { data: explanationData, error: explanationError } = await supabaseAdmin
          .from('mcq_explanations')
          .insert({
            explanation_text: mcq.explanation,
            image_url: mcq.image_url || null,
          })
          .select('id')
          .single();

        if (explanationError) {
          throw new Error(`Explanation insert failed: ${explanationError.message}`);
        }

        // 2. Insert MCQ
        const { data: mcqData, error: mcqError } = await supabaseAdmin // Capture mcqData to get its ID
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
          .select('id') // Select the ID of the newly inserted MCQ
          .single();

        if (mcqError) {
          throw new Error(`MCQ insert failed: ${mcqError.message}`);
        }

        // 3. Link MCQ to category if categoryId exists
        if (categoryId) {
          const { error: linkError } = await supabaseAdmin
            .from('mcq_category_links')
            .insert({
              mcq_id: mcqData.id, // CORRECTED: Use mcqData.id here
              category_id: categoryId,
            });

          if (linkError) {
            throw new Error(`MCQ category link failed: ${linkError.message}`);
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