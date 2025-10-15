// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get PayPal access token
async function getPayPalAccessToken() {
  // @ts-ignore
  const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
  // @ts-ignore
  const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET');
  // @ts-ignore
  const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE') || 'https://api-m.sandbox.paypal.com';

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal client ID or secret is not set in environment variables.');
  }

  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('PayPal Access Token Error:', errorData);
    throw new Error(`Failed to get PayPal access token: ${errorData.error_description || response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client with service role key for database updates
  // @ts-ignore
  const supabaseAdmin = createClient(
    // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { paypal_subscription_id, user_id, subscription_tier_id } = await req.json();

    if (!paypal_subscription_id || !user_id || !subscription_tier_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: paypal_subscription_id, user_id, or subscription_tier_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getPayPalAccessToken();
    // @ts-ignore
    const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE') || 'https://api-m.sandbox.paypal.com';

    // 1. Activate the PayPal subscription
    const activateResponse = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${paypal_subscription_id}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        reason: 'Subscription activated by user approval',
      }),
    });

    if (!activateResponse.ok) {
      const errorData = await activateResponse.json();
      console.error('PayPal Activate Subscription Error:', errorData);
      throw new Error(`Failed to activate PayPal subscription: ${errorData.message || activateResponse.statusText}`);
    }

    // 2. Get subscription details from PayPal to extract start/end dates and plan ID
    const subscriptionDetailsResponse = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions/${paypal_subscription_id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!subscriptionDetailsResponse.ok) {
      const errorData = await subscriptionDetailsResponse.json();
      console.error('PayPal Get Subscription Details Error:', errorData);
      throw new Error(`Failed to get PayPal subscription details: ${errorData.message || subscriptionDetailsResponse.statusText}`);
    }
    const paypalSubscriptionDetails = await subscriptionDetailsResponse.json();
    console.log('PayPal Subscription Details:', paypalSubscriptionDetails);

    const paypalPlanId = paypalSubscriptionDetails.plan_id;
    const paypalStatus = paypalSubscriptionDetails.status; // e.g., 'ACTIVE'
    const startTime = paypalSubscriptionDetails.start_time; // ISO 8601 format
    const billingInfo = paypalSubscriptionDetails.billing_info;
    const nextBillingTime = billingInfo?.next_billing_time; // ISO 8601 format

    // Determine end_date based on next_billing_time or plan duration
    let endDate = null;
    if (nextBillingTime) {
      endDate = new Date(nextBillingTime);
    } else {
      // Fallback: if next_billing_time is not available, calculate based on plan duration
      // This requires fetching the subscription tier from our DB to get duration_in_months
      const { data: tierData, error: tierError } = await supabaseAdmin
        .from('subscription_tiers')
        .select('duration_in_months')
        .eq('id', subscription_tier_id)
        .single();

      if (tierError) {
        console.error('Error fetching subscription tier duration:', tierError);
        // Proceed without precise end_date if error, or throw
      } else if (tierData) {
        const startDate = new Date(startTime);
        endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + tierData.duration_in_months);
      }
    }

    // 3. Deactivate any existing active subscriptions for the user in our DB
    const { error: deactivateError } = await supabaseAdmin
      .from('user_subscriptions')
      .update({ status: 'inactive' })
      .eq('user_id', user_id)
      .eq('status', 'active');

    if (deactivateError) {
      console.warn('Failed to deactivate previous user subscriptions:', deactivateError);
      // Don't throw, as the new subscription is more important
    }

    // 4. Insert new subscription into user_subscriptions table
    const { data: newSubscription, error: insertError } = await supabaseAdmin
      .from('user_subscriptions')
      .insert({
        user_id: user_id,
        subscription_tier_id: subscription_tier_id,
        start_date: startTime,
        end_date: endDate ? endDate.toISOString() : null, // Use calculated end date
        status: 'active', // Our internal status
        paypal_subscription_id: paypal_subscription_id,
        paypal_plan_id: paypalPlanId,
        paypal_status: paypalStatus, // PayPal's status
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting new user subscription:', insertError);
      throw new Error(`Failed to save subscription to database: ${insertError.message}`);
    }

    // 5. Update user's profile to mark as having an active subscription and store PayPal customer ID
    // Note: PayPal customer ID is usually associated with the user's PayPal account,
    // which might not be directly available here. For simplicity, we'll assume
    // the user_id is sufficient for now, or you might fetch it from PayPal user info if available.
    // For now, we'll just update has_active_subscription.
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ has_active_subscription: true })
      .eq('id', user_id);

    if (profileUpdateError) {
      console.error('Error updating user profile for active subscription:', profileUpdateError);
      // Don't throw, as the subscription itself is recorded
    }

    return new Response(JSON.stringify({ message: 'Subscription activated and recorded.', subscription: newSubscription }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in capture-paypal-subscription Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});