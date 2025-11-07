// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { price_id, user_id } = await req.json();

    if (!price_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: price_id or user_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!stripeSecretKey || !supabaseUrl) {
      throw new Error('Stripe secret key or Supabase URL is not set in environment variables.');
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Determine success URL based on environment
    const successUrl = `${supabaseUrl}/functions/v1/fulfill-stripe-subscription?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${supabaseUrl}/functions/v1/cancel-stripe-subscription`; // Placeholder

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price: price_id,
        quantity: 1,
      }],
      customer_email: undefined, // Let Stripe handle customer creation/lookup based on user_id metadata
      metadata: {
        user_id: user_id,
        price_id: price_id,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Optional: If you have a Stripe Customer ID stored in profiles, you can use it here:
      // customer: stripeCustomerId, 
    });

    return new Response(JSON.stringify({ sessionId: session.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-stripe-checkout-session Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});