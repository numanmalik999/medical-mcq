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
    return new Response(JSON.stringify({ error: 'Stripe secret key is not set.' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
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
    // Note: We rely on the 'handle_new_user' trigger to create the basic profile.
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Requires user to confirm email
      user_metadata: {
        first_name: first_name || null,
        last_name: last_name || null,
        phone_number: phone_number || null,
        whatsapp_number: whatsapp_number || null,
      },
    });

    if (authError) {
      console.error('Error creating user:', authError);
      throw new Error(`Failed to create user account: ${authError.message}`);
    }
    const newUserId = userData.user.id;
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

    // --- 4. Handle Subscription Fulfillment (Update Supabase DB) ---
    
    let requiresAction = false;
    let clientSecret = null;
    let subscriptionStatus = subscription.status;

    if (paymentIntent && paymentIntent.status === 'requires_action') {
      requiresAction = true;
      clientSecret = paymentIntent.client_secret;
    } else if (subscriptionStatus === 'active' || subscriptionStatus === 'trialing') {
      // Payment was successful immediately (or trial started)
      
      // Calculate end date based on Stripe's current_period_end (timestamp in seconds)
      const currentPeriodEnd = subscription.current_period_end;
      const endDate = new Date(currentPeriodEnd * 1000).toISOString();
      const startDate = new Date(subscription.current_period_start * 1000).toISOString();

      // Deactivate any existing active subscriptions for the user in our DB
      const { error: deactivateError } = await supabaseAdmin
        .from('user_subscriptions')
        .update({ status: 'inactive' })
        .eq('user_id', newUserId)
        .eq('status', 'active');

      if (deactivateError) {
        console.warn('Failed to deactivate previous user subscriptions:', deactivateError);
      }

      // Insert new subscription into user_subscriptions table
      const { error: insertError } = await supabaseAdmin
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

      if (insertError) {
        console.error('Error inserting new user subscription:', insertError);
        // Note: We don't throw here, as the Stripe subscription is active. We log the DB error.
      }

      // Update user's profile to mark as active and store customer ID
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({ has_active_subscription: true, paypal_customer_id: customer.id })
        .eq('id', newUserId);

      if (profileUpdateError) {
        console.error('Error updating user profile for active subscription:', profileUpdateError);
      }
    }

    // Return response to client
    return new Response(JSON.stringify({
      requires_action: requiresAction,
      client_secret: clientSecret,
      subscription_status: subscriptionStatus,
      user_id: newUserId,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-user-and-subscription Edge Function:', error);
    // If user creation failed, we might need to clean up Stripe resources, but for simplicity, we rely on Stripe's idempotency and logging.
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});