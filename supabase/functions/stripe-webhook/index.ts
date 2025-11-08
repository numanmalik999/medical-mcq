// @ts-ignore
// v4 - Adding robust checks and logging
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

const corsHeaders = { 'Access-Control-Allow-Origin': '*' };

serve(async (req: Request) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!stripeSecretKey || !stripeWebhookSecret) {
      throw new Error('Stripe environment variables are not set.');
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });
    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature!, stripeWebhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed.', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      console.log('✅ checkout.session.completed event received.');
      const session = event.data.object as Stripe.Checkout.Session;

      // Defensive check: Only proceed if payment was successful.
      if (session.payment_status !== 'paid') {
        console.warn(`Webhook received checkout.session.completed but payment_status is '${session.payment_status}'. Ignoring.`);
        return new Response(JSON.stringify({ received: true, message: 'Ignored, payment not paid.' }), { status: 200 });
      }

      // Defensive check: Ensure metadata exists.
      if (!session.metadata || !session.metadata.user_id || !session.metadata.price_id) {
        console.error('❌ Webhook Error: Missing metadata (user_id or price_id) in checkout session.');
        return new Response('Webhook Error: Missing metadata', { status: 400 });
      }
      const { user_id, price_id } = session.metadata;
      console.log(`Processing subscription for user: ${user_id}, price: ${price_id}`);

      const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

      // 1. Find subscription tier
      console.log(`Fetching subscription tier for price_id: ${price_id}`);
      const { data: tierData, error: tierError } = await supabaseAdmin
        .from('subscription_tiers')
        .select('id, duration_in_months')
        .eq('stripe_price_id', price_id)
        .single();

      if (tierError || !tierData) {
        console.error(`❌ Webhook Error: Subscription tier not found for price_id: ${price_id}. Error:`, tierError);
        throw new Error(`Subscription tier not found for price_id: ${price_id}`);
      }
      console.log(`Found tier: ${tierData.id} with duration: ${tierData.duration_in_months} months.`);

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + tierData.duration_in_months);

      // 2. Deactivate old subscriptions
      console.log(`Deactivating old subscriptions for user: ${user_id}`);
      const { error: updateOldSubsError } = await supabaseAdmin.from('user_subscriptions').update({ status: 'inactive' }).eq('user_id', user_id).eq('status', 'active');
      if (updateOldSubsError) {
        console.error(`⚠️ Webhook Warning: Failed to deactivate old subscriptions for user ${user_id}:`, updateOldSubsError);
      }

      // 3. Insert new subscription
      console.log(`Inserting new subscription for user: ${user_id}`);
      const { error: insertSubError } = await supabaseAdmin.from('user_subscriptions').insert({
        user_id: user_id,
        subscription_tier_id: tierData.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active',
        stripe_subscription_id: session.id,
        stripe_customer_id: session.customer as string,
        stripe_status: session.payment_status,
      });
      if (insertSubError) {
        console.error(`❌ Webhook Error: Failed to insert new subscription for user ${user_id}:`, insertSubError);
        throw new Error(`Failed to insert new subscription: ${insertSubError.message}`);
      }
      console.log(`New subscription inserted successfully.`);

      // 4. Update profile
      console.log(`Updating profile for user: ${user_id}`);
      const { error: updateProfileError } = await supabaseAdmin.from('profiles').update({ has_active_subscription: true }).eq('id', user_id);
      if (updateProfileError) {
        console.error(`❌ Webhook Error: Failed to update profile for user ${user_id}:`, updateProfileError);
        throw new Error(`Failed to update profile: ${updateProfileError.message}`);
      }
      console.log(`Profile updated successfully.`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error in Stripe webhook handler:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});