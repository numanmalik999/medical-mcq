// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

declare global {
  namespace Deno {
    namespace env {
      function get(key: string): string | undefined;
    }
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // 1. Try to fetch today's MCQ
    let { data: dailyMcq, error: fetchError } = await supabaseAdmin
      .from('daily_mcqs')
      .select(`
        id,
        mcq_id,
        mcqs (
          id,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer,
          explanation_id,
          difficulty,
          is_trial_mcq
        )
      `)
      .eq('date', today)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Error fetching daily MCQ:', fetchError);
      throw new Error(`Failed to fetch daily MCQ: ${fetchError.message}`);
    }

    // 2. If no MCQ for today, select a random one and assign it
    if (!dailyMcq) {
      // Select a random MCQ that hasn't been a daily_mcq in the last 30 days (optional, for variety)
      const { data: recentDailyMcqIds, error: _recentError } = await supabaseAdmin
        .from('daily_mcqs')
        .select('mcq_id')
        .gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);

      const excludedMcqIds = recentDailyMcqIds?.map((d: { mcq_id: string }) => d.mcq_id) || [];

      const { data: randomMcq, error: randomMcqError } = await supabaseAdmin
        .from('mcqs')
        .select(`
          id,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer,
          explanation_id,
          difficulty,
          is_trial_mcq
        `)
        .not('id', 'in', `(${excludedMcqIds.join(',')})`) // Exclude recently used MCQs
        .limit(1)
        .order('random()'); // PostgreSQL specific for random row

      if (randomMcqError || !randomMcq || randomMcq.length === 0) {
        console.error('Error fetching random MCQ:', randomMcqError);
        throw new Error('No available MCQs to set as Question of the Day.');
      }

      const selectedMcq = randomMcq[0];

      const { data: newDailyMcq, error: insertError } = await supabaseAdmin
        .from('daily_mcqs')
        .insert({ date: today, mcq_id: selectedMcq.id })
        .select(`
          id,
          mcq_id,
          mcqs (
            id,
            question_text,
            option_a,
            option_b,
            option_c,
            option_d,
            correct_answer,
            explanation_id,
            difficulty,
            is_trial_mcq
          )
        `)
        .single();

      if (insertError) {
        console.error('Error inserting new daily MCQ:', insertError);
        throw new Error(`Failed to set new daily MCQ: ${insertError.message}`);
      }
      dailyMcq = newDailyMcq;
    }

    if (!dailyMcq || !dailyMcq.mcqs) {
      throw new Error('Daily MCQ data could not be retrieved.');
    }

    return new Response(JSON.stringify({
      daily_mcq_id: dailyMcq.id,
      mcq: dailyMcq.mcqs,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-daily-mcq Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});