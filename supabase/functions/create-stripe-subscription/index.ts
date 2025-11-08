// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import Stripe from 'https://esm.sh/stripe@14.23.0?target=deno';

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
  // This is the outermost block. Any error here will be caught.
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. Log environment variables immediately
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('--- Function Start ---');
    console.log('STRIPE_SECRET_KEY available:', !!stripeSecretKey);
    console.log('SUPABASE_URL available:', !!supabaseUrl);
    console.log('SUPABASE_SERVICE_ROLE_KEY available:', !!supabaseServiceRoleKey);

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Server configuration error: One or more critical environment variables are missing.');
    }

    // 2. Try to parse the body
    let body;
    try {
      body = await req.json();
    } catch (e: any) {
      console.error('Failed to parse request body as JSON.', e);
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body.', details: e.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Main logic
    const { price_id, user_id, payment_method_id } = body;

    if (!price_id || !user_id || !payment_method_id) {
      throw new Error('Missing required fields: price_id, user_id, or payment_method_id.');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (userError || !user || !user.email) throw new Error('User not found');
    const userEmail = user.email;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user_id)
      .single();
    if (profileError && profileError.code !== 'PGRST116') throw profileError;

    let customerId = profile?.stripe_customer_id;
    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) customerId = null;
      } catch (e: any) {
        customerId = null;
      }
    }

    if (!customerId) {
      const newCustomer = await stripe.customers.create({
        email: userEmail,
        metadata: { user_id: user_id },
      });
      customerId = newCustomer.id;
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user_id);
    }

    await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method_id },
    });

    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price_id }],
      expand: ['latest_invoice.payment_intent'],
    });

    const { data: tierData, error: tierError } = await supabaseAdmin
      .from('subscription_tiers')
      .select('id')
      .eq('stripe_price_id', price_id)
      .single();
    if (tierError || !tierData) throw new Error('Subscription tier not found.');

    await supabaseAdmin.from('user_subscriptions').update({ status: 'inactive' }).eq('user_id', user_id).eq('status', 'active');

    await supabaseAdmin.from('user_subscriptions').insert({
        user_id: user_id,
        subscription_tier_id: tierData.id,
        start_date: new Date(subscription.current_period_start * 1000).toISOString(),
        end_date: new Date(subscription.current_period_end * 1000).toISOString(),
        status: 'active',
        stripe_subscription_id: subscription.id,
        stripe_customer_id: customerId,
        stripe_status: subscription.status,
    });

    await supabaseAdmin.from('profiles').update({ has_active_subscription: true }).eq('id', user_id);

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;

    return new Response(JSON.stringify({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent?.client_secret,
      status: subscription.status,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('--- CRITICAL ERROR in Edge Function ---', error);
    return new Response(JSON.stringify({ error: error.message || 'An unknown server error occurred.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});