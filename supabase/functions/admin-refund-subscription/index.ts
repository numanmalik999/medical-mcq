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

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "Stripe configuration missing." }), { status: 500, headers: corsHeaders });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: '2024-06-20',
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const { subscription_id } = await req.json();
    if (!subscription_id) throw new Error("Subscription ID required.");

    // 1. Fetch Subscription Details including email
    const { data: sub, error: fetchError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*, profiles(first_name, email), subscription_tiers(name)')
      .eq('id', subscription_id)
      .single();

    if (fetchError || !sub) throw new Error("Subscription not found.");

    let stripeMessage = "No Stripe record linked.";

    // 2. Handle Stripe Refund & Cancellation
    if (sub.stripe_subscription_id) {
      try {
        // A. Get the subscription to find the latest invoice
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        const latestInvoiceId = stripeSub.latest_invoice as string;

        if (latestInvoiceId) {
          const invoice = await stripe.invoices.retrieve(latestInvoiceId);
          if (invoice.payment_intent) {
             const paymentIntentId = invoice.payment_intent as string;
             // Refund the PaymentIntent (Charge)
             await stripe.refunds.create({
                payment_intent: paymentIntentId,
                reason: 'requested_by_customer'
             });
             stripeMessage = "Payment refunded in Stripe.";
          } else if (invoice.charge) {
             await stripe.refunds.create({
                charge: invoice.charge as string,
                reason: 'requested_by_customer'
             });
             stripeMessage = "Charge refunded in Stripe.";
          }
        }

        // B. Cancel the subscription immediately
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        stripeMessage += " Subscription cancelled in Stripe.";

      } catch (stripeError: any) {
        console.error("Stripe Error:", stripeError);
        stripeMessage = `Stripe Partial Error: ${stripeError.message}`;
      }
    }

    // 3. Revoke Access Locally
    await supabaseAdmin
      .from('user_subscriptions')
      .update({ status: 'refunded', end_date: new Date().toISOString() })
      .eq('id', subscription_id);

    await supabaseAdmin
      .from('profiles')
      .update({ has_active_subscription: false })
      .eq('id', sub.user_id);

    // 4. Send Email Notification
    // Get email from profile join, fallback to auth admin get user if needed, but profile should have it via sync
    let userEmail = sub.profiles?.email;
    
    // Fallback if profile email is missing (legacy data)
    if (!userEmail) {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(sub.user_id);
        userEmail = authUser?.user?.email;
    }

    if (userEmail) {
        const userName = sub.profiles?.first_name || 'Doctor';
        const planName = sub.subscription_tiers?.name || 'Subscription';
        const appUrl = Deno.env.get('APP_BASE_URL') || 'https://www.studyprometric.com';

        await supabaseAdmin.functions.invoke('send-email', {
            body: {
                to: userEmail,
                subject: 'Subscription Refund Processed',
                body: `
                    <div style="font-family: sans-serif; color: #333;">
                        <h2>Refund Confirmation</h2>
                        <p>Hi ${userName},</p>
                        <p>As requested, we have processed a refund for your <strong>${planName}</strong> subscription.</p>
                        <p>The funds should appear in your account within 5-10 business days, depending on your bank's processing time.</p>
                        <p>Your premium access has been cancelled immediately. You can still access your profile and free content.</p>
                        <p>If you decide to return, we'd love to help you with your exam preparation again!</p>
                        <br/>
                        <a href="${appUrl}/subscription" style="color: #1e3a8a; text-decoration: none; font-weight: bold;">View Available Plans</a>
                        <br/><br/>
                        <p>Best regards,<br/>The Study Prometric Team</p>
                    </div>
                `
            }
        });
    }

    // 5. Log Action
    await supabaseAdmin.from('user_email_logs').insert({
        user_id: sub.user_id,
        email_type: `admin_refund_${subscription_id}`
    });

    return new Response(JSON.stringify({ 
      message: "Refund processed and user notified.", 
      details: stripeMessage 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Refund Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});