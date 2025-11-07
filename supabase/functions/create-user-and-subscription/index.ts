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

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

    if (!supabaseUrl || !serviceRoleKey || !stripeSecretKey) {
      throw new Error('Server configuration error: Missing environment variables.');
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { 
      email, 
      password, 
      first_name, 
      last_name, 
      phone_number, 
      whatsapp_number, 
      payment_method_id, 
      price_id,
      tier_id
    } = await req.json();

    if (!email || !password || !payment_method_id || !price_id || !tier_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields for signup and payment.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // --- 1. Create User in Supabase Auth ---
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name, phone_number, whatsapp_number },
    });

    if (authError) {
      throw new Error(`Failed to create user account: ${authError.message}`);
    }
    const newUserId = userData.user.id;

    // --- 1.5. Manually create the profile ---
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        id: newUserId,
        first_name: first_name || null,
        last_name: last_name || null,
        phone_number: phone_number || null,
        whatsapp_number: whatsapp_number || null,
        is_admin: false,
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    const userName = `${first_name || ''} ${last_name || ''}`.trim();

    // --- 2. Create Stripe Customer ---
    const customer = await stripe.customers.create({
      email: email,
      name: userName,
      payment_method: payment_method_id,
      invoice_settings: { default_payment_method: payment_method_id },
      metadata: { supabase_user_id: newUserId },
    });

    // --- 3. Create Stripe Subscription ---
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price_id }],
      expand: ['latest_invoice.payment_intent'],
    });

    const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;

    // --- 4. Handle Subscription Fulfillment ---
    let requiresAction = false;
    let clientSecret = null;
    let subscriptionStatus = subscription.status;

    if (paymentIntent && paymentIntent.status === 'requires_action') {
      requiresAction = true;
      clientSecret = paymentIntent.client_secret;
    } else if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
      const endDate = new Date(subscription.current_period_end * 1000).toISOString();
      const startDate = new Date(subscription.current_period_start * 1000).toISOString();

      await supabaseAdmin
        .from('user_subscriptions')
        .insert({
          user_id: newUserId,
          subscription_tier_id: tier_id,
          start_date: startDate,
          end_date: endDate,
          status: 'active',
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customer.id,
          stripe_status: subscriptionStatus,
        });

      await supabaseAdmin
        .from('profiles')
        .update({ has_active_subscription: true, paypal_customer_id: customer.id })
        .eq('id', newUserId);
    }

    return new Response(JSON.stringify({
      requires_action: requiresAction,
      client_secret: clientSecret,
      subscription_status: subscriptionStatus,
      user_id: newUserId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('--- FATAL ERROR in create-user-and-subscription ---');
    console.error(error); // Log the raw error to Supabase logs

    let responseError = {
      message: 'An internal server error occurred.',
      details: 'No specific details available.'
    };

    if (error && error.type) { // Check if it looks like a Stripe error
      responseError.message = error.message || 'A payment processing error occurred.';
      responseError.details = `Stripe Error Type: ${error.type}`;
    } else if (error instanceof Error) {
      responseError.message = error.message;
    } else {
      try {
        responseError.details = JSON.stringify(error);
      } catch {
        responseError.details = 'Could not serialize error object.';
      }
    }

    return new Response(JSON.stringify({ error: responseError.message, details: responseError.details }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});