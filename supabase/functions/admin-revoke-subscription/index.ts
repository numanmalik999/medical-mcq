// @ts-ignore
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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { subscription_id } = await req.json();

    if (!subscription_id) {
      throw new Error("Missing subscription_id in request.");
    }

    console.log(`[REVOKE] Processing ID: ${subscription_id}`);

    // 1. Get the user_id and Stripe subscription ID
    const { data: sub, error: fetchError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('user_id, stripe_subscription_id')
      .eq('id', subscription_id)
      .single();

    if (fetchError || !sub) {
      throw new Error(`Subscription not found. ${fetchError?.message || ''}`);
    }

    // 2. Cancel it in Stripe if a subscription ID exists
    if (sub.stripe_subscription_id && sub.stripe_subscription_id.startsWith('sub_')) {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (stripeKey) {
        const stripe = new Stripe(stripeKey, {
          apiVersion: '2024-06-20',
          httpClient: Stripe.createFetchHttpClient(),
        });
        try {
          await stripe.subscriptions.cancel(sub.stripe_subscription_id);
          console.log(`[REVOKE] Cancelled Stripe subscription: ${sub.stripe_subscription_id}`);
        } catch (stripeErr: any) {
          console.warn(`[REVOKE] Warning: Failed to cancel Stripe subscription. ${stripeErr.message}`);
        }
      }
    }

    // 3. Update the local subscription status using the valid 'expired' enum
    const { error: updateSubError } = await supabaseAdmin
      .from('user_subscriptions')
      .update({ 
        status: 'expired', // Safe database-approved status
        end_date: new Date().toISOString() 
      })
      .eq('id', subscription_id);

    if (updateSubError) {
      throw new Error(`Database update failed for subscription table: ${updateSubError.message}`);
    }

    // 4. Update the user's profile to remove premium access
    const { error: updateProfileError } = await supabaseAdmin
      .from('profiles')
      .update({ has_active_subscription: false })
      .eq('id', sub.user_id);

    if (updateProfileError) {
      throw new Error(`Database update failed for profile table: ${updateProfileError.message}`);
    }

    console.log(`[REVOKE] Successfully revoked access for user ${sub.user_id}`);

    return new Response(JSON.stringify({ message: "Revoked successfully." }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[REVOKE] Critical error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});