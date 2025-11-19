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
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: 'Missing user_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Get the 'Monthly Basic' subscription tier ID
    const { data: tierData, error: tierError } = await supabaseAdmin
      .from('subscription_tiers')
      .select('id, duration_in_months')
      .eq('name', 'Monthly Basic') // Assuming 'Monthly Basic' is the tier to award
      .single();

    if (tierError || !tierData) {
      console.error('Error fetching Monthly Basic subscription tier:', tierError);
      throw new Error('Monthly Basic subscription tier not found.');
    }

    const subscriptionTierId = tierData.id;
    const durationInMonths = tierData.duration_in_months;

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + durationInMonths);

    // 2. Deactivate any existing active free subscriptions for the user
    // This prevents stacking free months if they already have one
    const { error: deactivateError } = await supabaseAdmin
      .from('user_subscriptions')
      .update({ status: 'inactive' })
      .eq('user_id', user_id)
      .eq('status', 'active')
      .is('stripe_subscription_id', null); // Corrected: Check for Stripe ID instead of non-existent PayPal ID

    if (deactivateError) {
      console.warn('Failed to deactivate previous free user subscriptions:', deactivateError);
    }

    // 3. Insert a new active subscription for 1 month
    const { data: newSubscription, error: insertError } = await supabaseAdmin
      .from('user_subscriptions')
      .insert({
        user_id: user_id,
        subscription_tier_id: subscriptionTierId,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active',
        // No stripe_subscription_id for free awards
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting free user subscription:', insertError);
      throw new Error(`Failed to save free subscription to database: ${insertError.message}`);
    }

    // 4. Update user's profile to mark as having an active subscription
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ has_active_subscription: true })
      .eq('id', user_id);

    if (profileUpdateError) {
      console.error('Error updating user profile for active subscription:', profileUpdateError);
    }

    // 5. Update user_daily_mcq_scores to mark when the award was given
    const { error: scoreUpdateError } = await supabaseAdmin
      .from('user_daily_mcq_scores')
      .update({ last_awarded_subscription_at: new Date().toISOString() })
      .eq('user_id', user_id);

    if (scoreUpdateError) {
      console.error('Error updating user_daily_mcq_scores with award date:', scoreUpdateError);
    }

    return new Response(JSON.stringify({ message: 'Free subscription awarded successfully.', subscription: newSubscription }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in award-free-subscription Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});