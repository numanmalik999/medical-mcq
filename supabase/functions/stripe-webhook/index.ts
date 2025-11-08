// @ts-ignore
// v3 - Using constructEventAsync for Deno runtime
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
      // Correctly use the asynchronous method for Deno runtime
      event = await stripe.webhooks.constructEventAsync(body, signature!, stripeWebhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed.', err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const { user_id, price_id } = session.metadata!;

      const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

      const { data: tierData, error: tierError } = await supabaseAdmin
        .from('subscription_tiers')
        .select('id, duration_in_months')
        .eq('stripe_price_id', price_id)
        .single();

      if (tierError || !tierData) {
        throw new Error(`Subscription tier not found for price_id: ${price_id}`);
      }

      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + tierData.duration_in_months);

      // Deactivate any old subscriptions
      await supabaseAdmin.from('user_subscriptions').update({ status: 'inactive' }).eq('user_id', user_id).eq('status', 'active');

      // Insert new subscription
      await supabaseAdmin.from('user_subscriptions').insert({
        user_id: user_id,
        subscription_tier_id: tierData.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active',
        stripe_subscription_id: session.id, // Use checkout session id as a reference
        stripe_customer_id: session.customer as string,
        stripe_status: session.payment_status,
      });

      // Update profile
      await supabaseAdmin.from('profiles').update({ has_active_subscription: true }).eq('id', user_id);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('Error in Stripe webhook handler:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});