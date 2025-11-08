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
    const { price_id, user_id } = await req.json();

    if (!price_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: price_id or user_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey || !supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Stripe secret key, Supabase URL, or Supabase service role key is not set in environment variables.');
    }

    // Initialize Supabase admin client to fetch user email
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Fetch the user's email from their ID
    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);

    if (userError || !user || !user.email) {
      throw new Error(`Could not retrieve user email: ${userError?.message || 'User not found or has no email'}`);
    }
    const userEmail = user.email;

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-06-20',
      httpClient: Stripe.createFetchHttpClient(),
    });

    // Determine success URL based on environment
    const successUrl = `${supabaseUrl}/functions/v1/fulfill-stripe-subscription?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${supabaseUrl}/functions/v1/cancel-stripe-subscription`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{
        price: price_id,
        quantity: 1,
      }],
      customer_email: userEmail, // Pass the user's email to Stripe
      metadata: {
        user_id: user_id,
        price_id: price_id,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
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