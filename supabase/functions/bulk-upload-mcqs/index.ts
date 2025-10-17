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
  subcategory_name?: string; // Changed from subcategory_id to subcategory_name
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
        let subcategoryId: string | null = null;

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

        // Handle Subcategory (only if categoryId is determined)
        if (mcq.subcategory_name && categoryId) {
          // Check if subcategory exists
          const { data: existingSubcategory, error: subcategoryFetchError } = await supabaseAdmin
            .from('subcategories')
            .select('id')
            .eq('name', mcq.subcategory_name)
            .eq('category_id', categoryId)
            .single();

          if (subcategoryFetchError && subcategoryFetchError.code !== 'PGRST116') {
            throw new Error(`Subcategory fetch failed for "${mcq.subcategory_name}": ${subcategoryFetchError.message}`);
          }

          if (existingSubcategory) {
            subcategoryId = existingSubcategory.id;
          } else {
            // Create new subcategory if it doesn't exist
            const { data: newSubcategory, error: subcategoryInsertError } = await supabaseAdmin
              .from('subcategories')
              .insert({ name: mcq.subcategory_name, category_id: categoryId })
              .select('id')
              .single();

            if (subcategoryInsertError) {
              throw new Error(`Subcategory insert failed for "${mcq.subcategory_name}": ${subcategoryInsertError.message}`);
            }
            subcategoryId = newSubcategory.id;
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
        const { error: mcqError } = await supabaseAdmin
          .from('mcqs')
          .insert({
            question_text: mcq.question,
            option_a: mcq.options.A,
            option_b: mcq.options.B,
            option_c: mcq.options.C,
            option_d: mcq.options.D,
            correct_answer: mcq.correct_answer,
            explanation_id: explanationData.id,
            category_id: categoryId, // Use resolved categoryId
            subcategory_id: subcategoryId, // Use resolved subcategoryId
            difficulty: mcq.difficulty || null,
            is_trial_mcq: mcq.is_trial_mcq ?? false,
          });

        if (mcqError) {
          throw new Error(`MCQ insert failed: ${mcqError.message}`);
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