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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let body;
  try {
    body = await req.json();
  } catch (e: any) {
    const rawBody = await req.text();
    console.error('Failed to parse request body as JSON.', e);
    console.error('Raw request body received:', rawBody);
    return new Response(JSON.stringify({ 
      error: 'Invalid request format. Expected JSON.',
      details: e.message,
      rawBody: rawBody,
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { price_id, user_id, payment_method_id } = body;

    console.log('--- create-stripe-subscription invoked ---');
    console.log('Received price_id:', price_id);
    console.log('Received user_id:', user_id);
    console.log('Received payment_method_id:', payment_method_id ? 'Exists' : 'MISSING');

    if (!price_id || !user_id || !payment_method_id) {
      console.error('Validation failed: Missing required fields in JSON body.');
      return new Response(JSON.stringify({ error: 'Missing required fields: price_id, user_id, or payment_method_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Server configuration error: Missing environment variables.');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // 1. Get user and profile data
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (userError || !user || !user.email) throw new Error('User not found');
    const userEmail = user.email;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user_id)
      .single();
    if (profileError && profileError.code !== 'PGRST116') throw profileError;

    // 2. Retrieve or create a valid Stripe customer
    let customerId = profile?.stripe_customer_id;
    if (customerId) {
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) {
          console.log(`Customer ${customerId} was deleted in Stripe, creating a new one.`);
          customerId = null; // Treat as non-existent
        }
      } catch (e: any) {
        console.warn(`Failed to retrieve Stripe customer ${customerId}, creating a new one. Error: ${e.message}`);
        customerId = null; // Could not be found, treat as non-existent
      }
    }

    if (!customerId) {
      const newCustomer = await stripe.customers.create({
        email: userEmail,
        metadata: { user_id: user_id },
      });
      customerId = newCustomer.id;
      const { error: updateProfileError } = await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user_id);
      if (updateProfileError) {
        console.error(`Failed to update profile with new Stripe customer ID: ${updateProfileError.message}`);
        // Do not throw, as the main flow can continue
      }
    }

    // 3. Attach payment method to customer and set as default
    await stripe.paymentMethods.attach(payment_method_id, { customer: customerId });
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: payment_method_id },
    });

    // 4. Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: price_id }],
      expand: ['latest_invoice.payment_intent'],
    });

    // 5. Update our database with the new subscription details
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

    // 6. Return the subscription status and client secret if further action is needed
    const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;

    return new Response(JSON.stringify({
      subscriptionId: subscription.id,
      clientSecret: paymentIntent?.client_secret,
      status: subscription.status,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error in create-stripe-subscription Edge Function:', error);
    
    if (error.type) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});