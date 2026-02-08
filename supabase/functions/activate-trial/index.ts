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
    console.log("[activate-trial] Starting activation for user:", user_id);

    if (!user_id) throw new Error('User ID is required');

    // 1. Get the '3-Day Trial' tier ID
    console.log("[activate-trial] Looking for '3-Day Trial' tier...");
    const { data: tier, error: tierError } = await supabaseAdmin
      .from('subscription_tiers')
      .select('id, duration_in_months')
      .eq('name', '3-Day Trial')
      .maybeSingle();

    if (tierError) {
      console.error("[activate-trial] Error fetching tier:", tierError);
      throw tierError;
    }

    if (!tier) {
      console.error("[activate-trial] '3-Day Trial' tier NOT FOUND in subscription_tiers table.");
      throw new Error("Subscription tier '3-Day Trial' not found. Please create it in Admin Settings.");
    }

    console.log("[activate-trial] Tier found. ID:", tier.id);

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 3);

    // 2. Create the subscription record
    console.log("[activate-trial] Inserting user_subscriptions record...");
    const { error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .insert({
        user_id,
        subscription_tier_id: tier.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active'
      });

    if (subError) {
      console.error("[activate-trial] Error inserting subscription:", subError);
      throw subError;
    }

    // 3. Update the profile
    console.log("[activate-trial] Updating profile status...");
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        has_active_subscription: true,
        trial_taken: true 
      })
      .eq('id', user_id);

    if (profileError) {
      console.error("[activate-trial] Error updating profile:", profileError);
      throw profileError;
    }

    console.log("[activate-trial] Success! Trial activated.");

    return new Response(JSON.stringify({ message: "Trial activated successfully" }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[activate-trial] Final Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});