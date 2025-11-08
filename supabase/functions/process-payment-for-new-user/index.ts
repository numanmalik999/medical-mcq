// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import Stripe from 'https://esm.sh/stripe@16.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      // @ts-ignore
      Deno.env.get('SUPABASE_URL') ?? '',
      // @ts-ignore
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    // @ts-ignore
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { userId, email, name, payment_method_id, price_id, tier_id } = await req.json();

    if (!userId || !email || !payment_method_id || !price_id || !tier_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields for payment processing.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 1. Create Stripe Customer ---
    const customer = await stripe.customers.create({
      email,
      name,
      payment_method: payment_method_id,
      invoice_settings: { default_payment_method: payment_method_id },
      metadata: { supabase_user_id: userId },
    });

    // --- 2. Create Stripe Subscription ---
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price_id }],
      expand: ['latest_invoice.payment_intent'],
    });

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;

    // --- 3. Handle Subscription Fulfillment ---
    let requiresAction = false;
    let clientSecret = null;
    let subscriptionStatus = subscription.status;

    if (paymentIntent && paymentIntent.status === 'requires_action') {
      requiresAction = true;
      clientSecret = paymentIntent.client_secret;
    } else if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
      const endDate = new Date(subscription.current_period_end * 1000).toISOString();
      const startDate = new Date(subscription.current_period_start * 1000).toISOString();

      await supabaseAdmin.from('user_subscriptions').insert({
        user_id: userId,
        subscription_tier_id: tier_id,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customer.id,
        stripe_status: subscriptionStatus,
      });

      await supabaseAdmin.from('profiles').update({ has_active_subscription: true, paypal_customer_id: customer.id }).eq('id', userId);
    }

    return new Response(JSON.stringify({
      requires_action: requiresAction,
      client_secret: clientSecret,
      subscription_status: subscriptionStatus,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in process-payment-for-new-user Edge Function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});