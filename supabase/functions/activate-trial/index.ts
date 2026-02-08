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

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { user_id } = await req.json();

    if (!user_id) throw new Error('User ID is required');

    // 1. Get the '3-Day Trial' tier ID
    const { data: tier } = await supabaseAdmin
      .from('subscription_tiers')
      .select('id')
      .eq('name', '3-Day Trial')
      .single();

    if (!tier) throw new Error("Subscription tier '3-Day Trial' not found. Please create it in Admin Settings.");

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 3);

    // 2. Create the subscription record
    const { error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .insert({
        user_id,
        subscription_tier_id: tier.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active'
      });

    if (subError) throw subError;

    // 3. Update the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        has_active_subscription: true,
        trial_taken: true 
      })
      .eq('id', user_id);

    if (profileError) throw profileError;

    return new Response(JSON.stringify({ message: "Trial activated successfully" }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});