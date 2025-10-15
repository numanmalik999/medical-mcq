// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to get PayPal access token
async function getPayPalAccessToken() {
  // @ts-ignore
  const PAYPAL_CLIENT_ID = Deno.env.get('PAYPAL_CLIENT_ID');
  // @ts-ignore
  const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET');
  // @ts-ignore
  const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE') || 'https://api-m.sandbox.paypal.com'; // Use sandbox for dev

  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error('PayPal client ID or secret is not set in environment variables.');
  }

  const auth = btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('PayPal Access Token Error:', errorData);
    throw new Error(`Failed to get PayPal access token: ${errorData.error_description || response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { paypal_plan_id, user_id } = await req.json();

    if (!paypal_plan_id || !user_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields: paypal_plan_id or user_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getPayPalAccessToken();
    // @ts-ignore
    const PAYPAL_API_BASE = Deno.env.get('PAYPAL_API_BASE') || 'https://api-m.sandbox.paypal.com';

    const response = await fetch(`${PAYPAL_API_BASE}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        plan_id: paypal_plan_id,
        subscriber: {
          // You can pass user details here if needed, e.g., email, name
          // For now, we'll rely on the user_id passed from the frontend
          // and link it in our database after capture.
        },
        application_context: {
          // @ts-ignore
          return_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/capture-paypal-subscription`, // This is a placeholder, actual return will be handled by frontend
          // @ts-ignore
          cancel_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/cancel-paypal-subscription`, // Placeholder
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('PayPal Create Subscription Error:', errorData);
      throw new Error(`Failed to create PayPal subscription: ${errorData.message || response.statusText}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in create-paypal-subscription-order Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});