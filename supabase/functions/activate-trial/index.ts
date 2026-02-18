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

  // MAINTENANCE BLOCK: Temporarily disabled during WhatsApp verification setup
  return new Response(JSON.stringify({ 
    error: "Trial system is currently undergoing maintenance for verification setup. Please try again in 24 hours." 
  }), { 
    status: 503, 
    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
  });

  /*
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { user_id } = await req.json();
    console.log("[activate-trial] Starting activation for user:", user_id);

    if (!user_id) throw new Error('User ID is required');

    // 1. Fetch the current user's profile
    const { data: currentUser, error: userFetchError } = await supabaseAdmin
      .from('profiles')
      .select('phone_number, whatsapp_number, first_name, last_name')
      .eq('id', user_id)
      .single();

    if (userFetchError) throw userFetchError;

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const userEmail = authUser?.user?.email || 'Unknown';

    // 2. FRAUD CHECK
    if (currentUser.phone_number || currentUser.whatsapp_number) {
        const { data: duplicateTrials } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('trial_taken', true)
            .neq('id', user_id)
            .or(`phone_number.eq.${currentUser.phone_number},whatsapp_number.eq.${currentUser.whatsapp_number}`);

        if (duplicateTrials && duplicateTrials.length > 0) {
            return new Response(JSON.stringify({ 
                error: "Activation blocked. A free trial has already been utilized with these contact details." 
            }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
    }

    // 3. Get '3-Day Trial' tier
    const { data: tier } = await supabaseAdmin.from('subscription_tiers').select('id').eq('name', '3-Day Trial').maybeSingle();
    if (!tier) throw new Error("Trial tier not configured.");

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 3);

    // 4. Create subscription
    await supabaseAdmin.from('user_subscriptions').insert({
        user_id,
        subscription_tier_id: tier.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active'
    });

    // 5. Update profile
    await supabaseAdmin.from('profiles').update({ has_active_subscription: true, trial_taken: true }).eq('id', user_id);

    return new Response(JSON.stringify({ message: "Trial activated" }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  */
});