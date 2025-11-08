// @ts-ignore
// v3 - Using Deno-compatible Stripe SDK import
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
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) throw new Error('STRIPE_SECRET_KEY is not set.');

    const { price_id, user_id } = await req.json();
    if (!price_id || !user_id) throw new Error('Missing price_id or user_id.');

    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20', httpClient: Stripe.createFetchHttpClient() });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (userError || !user) throw new Error('User not found');

    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('stripe_customer_id').eq('id', user_id).single();
    if (profileError && profileError.code !== 'PGRST116') throw profileError;

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const newCustomer = await stripe.customers.create({ email: user.email!, metadata: { user_id } });
      customerId = newCustomer.id;
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user_id);
    }

    const origin = req.headers.get('origin')!;
    const success_url = new URL('/user/subscriptions?status=success', origin).toString();
    const cancel_url = new URL('/user/subscriptions?status=cancelled', origin).toString();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer: customerId,
      line_items: [{ price: price_id, quantity: 1 }],
      success_url,
      cancel_url,
      metadata: { user_id, price_id },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in create-checkout-session:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});