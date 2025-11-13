// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use the service role key to be able to call the SECURITY DEFINER function
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Ensure a daily MCQ is set by calling the database function.
    // This acts as a fallback in case the cron job hasn't run yet.
    const { error: rpcError } = await supabaseAdmin.rpc('set_daily_mcq_if_not_exists');
    if (rpcError) {
      console.error('Error calling set_daily_mcq_if_not_exists:', rpcError);
      // Don't throw, just log. The next step might still succeed if a question already exists.
    }

    // 2. Get today's date in YYYY-MM-DD format (UTC)
    const today = new Date().toISOString().split('T')[0];

    // 3. Fetch today's daily MCQ and join with the mcqs table
    const { data, error } = await supabaseAdmin
      .from('daily_mcqs')
      .select(`
        id,
        mcq_id,
        mcqs (*)
      `)
      .eq('date', today)
      .single();

    if (error) {
      console.error('Error fetching today\'s MCQ:', error);
      throw new Error('Could not retrieve today\'s question.');
    }
    
    if (!data || !data.mcqs) {
        throw new Error('No question of the day found, and automatic selection failed.');
    }

    const responsePayload = {
      daily_mcq_id: data.id,
      mcq: data.mcqs,
    };

    return new Response(JSON.stringify(responsePayload), {
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