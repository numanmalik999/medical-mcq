// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import Stripe from 'https://esm.sh/stripe@16.5.0';

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

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeSecretKey) {
    return new Response(JSON.stringify({ error: 'Stripe secret key is not set.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id');

    if (!sessionId) {
      return new Response('Missing session_id parameter.', { status: 400 });
    }

    // 1. Retrieve the Checkout Session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'line_items.data.price.product'],
    });

    if (session.payment_status !== 'paid' || session.status !== 'complete') {
      return new Response('Payment not successful or session incomplete.', { status: 400 });
    }

    const subscription = session.subscription as Stripe.Subscription;
    const priceId = session.metadata?.price_id;
    const userId = session.metadata?.user_id;
    const customerId = session.customer as string;

    if (!subscription || !priceId || !userId || !customerId) {
      throw new Error('Missing subscription, price ID, user ID, or customer ID in session data.');
    }

    // 2. Get subscription tier details from our DB
    const { data: tierData, error: tierError } = await supabaseAdmin
      .from('subscription_tiers')
      .select('id, duration_in_months')
      .eq('stripe_price_id', priceId)
      .single();

    if (tierError || !tierData) {
      console.error('Error fetching subscription tier by Stripe Price ID:', tierError);
      throw new Error('Subscription tier not found for fulfillment.');
    }
    const subscriptionTierId = tierData.id;
    const durationInMonths = tierData.duration_in_months;

    // Calculate end date based on Stripe's current_period_end (which is a timestamp in seconds)
    const currentPeriodEnd = subscription.current_period_end;
    const endDate = new Date(currentPeriodEnd * 1000).toISOString();
    const startDate = new Date(subscription.current_period_start * 1000).toISOString();

    // 3. Deactivate any existing active subscriptions for the user in our DB
    const { error: deactivateError } = await supabaseAdmin
      .from('user_subscriptions')
      .update({ status: 'inactive' })
      .eq('user_id', userId)
      .eq('status', 'active');

    if (deactivateError) {
      console.warn('Failed to deactivate previous user subscriptions:', deactivateError);
    }

    // 4. Insert new subscription into user_subscriptions table
    const { error: insertError } = await supabaseAdmin
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        subscription_tier_id: subscriptionTierId,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        stripe_status: subscription.status,
      });

    if (insertError) {
      console.error('Error inserting new user subscription:', insertError);
      throw new Error(`Failed to save subscription to database: ${insertError.message}`);
    }

    // 5. Update user's profile
    const { error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ has_active_subscription: true, paypal_customer_id: customerId }) // Reusing paypal_customer_id column for stripe_customer_id for simplicity
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('Error updating user profile for active subscription:', profileUpdateError);
    }

    // 6. Redirect the user back to the client application's success page
    const clientRedirectUrl = `${Deno.env.get('VITE_BASE_URL') || 'http://localhost:8080'}/user/subscriptions?status=success&subId=${subscription.id}`;
    
    return new Response(null, {
      status: 303, // See Other
      headers: {
        'Location': clientRedirectUrl,
      },
    });

  } catch (error) {
    console.error('Error in fulfill-stripe-subscription Edge Function:', error);
    // In case of error, redirect to a failure page
    const clientFailureUrl = `${Deno.env.get('VITE_BASE_URL') || 'http://localhost:8080'}/user/subscriptions?status=failure`;
    return new Response(null, {
      status: 303,
      headers: {
        'Location': clientFailureUrl,
      },
    });
  }
});