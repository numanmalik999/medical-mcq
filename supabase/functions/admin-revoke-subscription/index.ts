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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  // Initialize Supabase client with service role key to bypass RLS
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { subscription_id } = await req.json();

    if (!subscription_id) {
      throw new Error('Missing subscription_id in request body.');
    }

    console.log(`[revoke] Attempting to revoke subscription: ${subscription_id}`);

    // 1. Fetch the subscription to verify it exists and get the user ID
    const { data: sub, error: fetchError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id, status')
      .eq('id', subscription_id)
      .single();

    if (fetchError || !sub) {
        console.error(`[revoke] Subscription ${subscription_id} not found.`);
        throw new Error("Subscription record not found.");
    }

    console.log(`[revoke] Found subscription for user ${sub.user_id}. Current status: ${sub.status}`);

    // 2. Update the subscription record
    // We use 'inactive' as it is a standard allowed value in the status check constraint
    const { error: subUpdateError } = await supabaseAdmin
      .from('user_subscriptions')
      .update({ 
        status: 'inactive', 
        end_date: new Date().toISOString() 
      })
      .eq('id', subscription_id);

    if (subUpdateError) {
        console.error(`[revoke] Database error during status update:`, subUpdateError);
        throw subUpdateError;
    }

    // 3. Update the user's profile
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ has_active_subscription: false })
      .eq('id', sub.user_id);

    if (profileUpdateError) {
        console.error(`[revoke] Database error during profile update:`, profileUpdateError);
        throw profileUpdateError;
    }

    console.log(`[revoke] Successfully revoked access for user ${sub.user_id}`);

    return new Response(JSON.stringify({ 
        message: 'Access revoked successfully.',
        status: 'inactive'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[revoke] Unhandled Error:', error.message);
    return new Response(JSON.stringify({ 
        error: error.message,
        details: error.details || null
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});