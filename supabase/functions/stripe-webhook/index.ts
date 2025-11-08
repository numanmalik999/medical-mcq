// @ts-ignore
// v6 - Adding explicit .select() validation to every DB operation
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeSecretKey || !stripeWebhookSecret) {
    console.error('❌ Stripe environment variables are not set.');
    return new Response('Stripe environment variables are not set.', { status: 500 });
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, signature!, stripeWebhookSecret);
  } catch (err: any) {
    console.error(`❌ Webhook signature verification failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (event.type === 'checkout.session.completed') {
      console.log('✅ checkout.session.completed event received.');
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== 'paid') {
        console.warn(`Webhook received checkout.session.completed but payment_status is '${session.payment_status}'. Ignoring.`);
        return new Response(JSON.stringify({ received: true, message: 'Ignored, payment not paid.' }), { status: 200 });
      }

      if (!session.metadata || !session.metadata.user_id || !session.metadata.price_id) {
        console.error('❌ Webhook Error: Missing metadata (user_id or price_id) in checkout session.');
        return new Response('Webhook Error: Missing metadata', { status: 400 });
      }
      const { user_id, price_id } = session.metadata;
      console.log(`Processing subscription for user: ${user_id}, price: ${price_id}`);

      const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

      // 1. Find subscription tier
      const { data: tierData, error: tierError } = await supabaseAdmin
        .from('subscription_tiers')
        .select('id, duration_in_months')
        .eq('stripe_price_id', price_id)
        .single();

      if (tierError || !tierData) {
        throw new Error(`Subscription tier not found for price_id: ${price_id}. Error: ${tierError?.message}`);
      }
      console.log(`Found tier: ${tierData.id}`);

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + tierData.duration_in_months);

      // 2. Deactivate old subscriptions (and log how many were affected)
      const { data: updatedOldSubs, error: updateOldSubsError } = await supabaseAdmin.from('user_subscriptions').update({ status: 'inactive' }).eq('user_id', user_id).eq('status', 'active').select('id');
      if (updateOldSubsError) {
        console.error(`⚠️ Webhook Warning: DB error when deactivating old subs for user ${user_id}:`, updateOldSubsError);
      } else {
        console.log(`Deactivated ${updatedOldSubs.length} old subscription(s).`);
      }

      // 3. Insert new subscription and verify it was created
      const { data: newSub, error: insertSubError } = await supabaseAdmin.from('user_subscriptions').insert({
        user_id: user_id,
        subscription_tier_id: tierData.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active',
        stripe_subscription_id: session.id,
        stripe_customer_id: session.customer as string,
        stripe_status: session.payment_status,
      }).select('id').single();

      if (insertSubError || !newSub) {
        throw new Error(`Failed to insert new subscription: ${insertSubError?.message}`);
      }
      console.log(`New subscription ${newSub.id} inserted successfully.`);

      // 4. Update profile and verify it was updated
      const { data: updatedProfile, error: updateProfileError } = await supabaseAdmin.from('profiles').update({ has_active_subscription: true }).eq('id', user_id).select('id').maybeSingle();

      if (updateProfileError || !updatedProfile) {
        throw new Error(`Failed to update profile for user ${user_id}: ${updateProfileError?.message}`);
      }
      console.log(`Profile for user ${updatedProfile.id} updated successfully.`);
      
      console.log(`✅ Successfully processed subscription for user ${user_id}.`);
    } else {
      console.log(`🤷‍♀️ Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('Error handling webhook event:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});