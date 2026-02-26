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

  // Initialize Supabase client with service role key
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { subscription_id } = await req.json();

    if (!subscription_id) {
      return new Response(JSON.stringify({ error: 'Missing subscription_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch the subscription to get the user ID
    const { data: sub, error: fetchError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id')
      .eq('id', subscription_id)
      .single();

    if (fetchError || !sub) throw new Error("Subscription record not found.");

    // 2. Update the specific subscription record to 'cancelled'
    const { error: subUpdateError } = await supabaseAdmin
      .from('user_subscriptions')
      .update({ 
        status: 'cancelled', 
        end_date: new Date().toISOString() // End access immediately
      })
      .eq('id', subscription_id);

    if (subUpdateError) throw subUpdateError;

    // 3. Update the user's profile to reflect they no longer have an active subscription
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ has_active_subscription: false })
      .eq('id', sub.user_id);

    if (profileUpdateError) throw profileUpdateError;

    return new Response(JSON.stringify({ message: 'Access revoked successfully in the database.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-revoke-subscription:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});