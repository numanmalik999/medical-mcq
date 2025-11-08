// @ts-ignore
// v5 - Refactoring for full Deno compatibility with target=deno and robust error handling
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import Stripe from 'https://esm.sh/stripe@14.23.0?target=deno';

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
    switch (event.type) {
      case 'checkout.session.completed': {
        console.log('✅ checkout.session.completed event received.');
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.payment_status !== 'paid') {
          console.warn(`Webhook received checkout.session.completed but payment_status is '${session.payment_status}'. Ignoring.`);
          break;
        }

        if (!session.metadata || !session.metadata.user_id || !session.metadata.price_id) {
          console.error('❌ Webhook Error: Missing metadata (user_id or price_id) in checkout session.');
          break;
        }

        const { user_id, price_id } = session.metadata;
        console.log(`Processing subscription for user: ${user_id}, price: ${price_id}`);

        const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

        const { data: tierData, error: tierError } = await supabaseAdmin
          .from('subscription_tiers')
          .select('id, duration_in_months')
          .eq('stripe_price_id', price_id)
          .single();

        if (tierError || !tierData) {
          console.error(`❌ Webhook Error: Subscription tier not found for price_id: ${price_id}.`, tierError);
          break;
        }

        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + tierData.duration_in_months);

        await supabaseAdmin.from('user_subscriptions').update({ status: 'inactive' }).eq('user_id', user_id).eq('status', 'active');

        await supabaseAdmin.from('user_subscriptions').insert({
          user_id: user_id,
          subscription_tier_id: tierData.id,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
          stripe_subscription_id: session.id,
          stripe_customer_id: session.customer as string,
          stripe_status: session.payment_status,
        });

        await supabaseAdmin.from('profiles').update({ has_active_subscription: true }).eq('id', user_id);
        console.log(`✅ Successfully processed subscription for user ${user_id}.`);
        break;
      }
      default:
        console.log(`🤷‍♀️ Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err: any) {
    console.error('Error handling webhook event:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
});