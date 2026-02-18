// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  // @ts-ignore
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  // @ts-ignore
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

  if (!phoneNumberId || !accessToken) {
    throw new Error('WhatsApp credentials missing in secrets.');
  }

  // Sanitize number (remove +, spaces, etc)
  const cleanNumber = phoneNumber.replace(/\D/g, '');

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to: cleanNumber,
    type: 'text',
    text: { body: message },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("[whatsapp-trial-expiry] Meta API Error:", JSON.stringify(error));
    return { success: false, error };
  }

  return { success: true };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log("[whatsapp-trial-expiry] Checking for expired trials...");

    // 1. Identify the 3-Day Trial Tier
    const { data: tier } = await supabaseAdmin
        .from('subscription_tiers')
        .select('id')
        .eq('name', '3-Day Trial')
        .single();

    if (!tier) throw new Error("3-Day Trial tier configuration not found.");

    // 2. Find subscriptions that expired in the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const today = new Date();

    const { data: expiredSubs, error: subError } = await supabaseAdmin
        .from('user_subscriptions')
        .select(`
            user_id,
            profiles (whatsapp_number, first_name)
        `)
        .eq('subscription_tier_id', tier.id)
        .gte('end_date', yesterday.toISOString())
        .lte('end_date', today.toISOString());

    if (subError) throw subError;

    let sentCount = 0;
    const baseUrl = Deno.env.get('APP_BASE_URL') || 'https://www.studyprometric.com';

    for (const sub of (expiredSubs || [])) {
        const userId = sub.user_id;
        const profile = (sub.profiles as any);
        const whatsapp = profile?.whatsapp_number;
        const name = profile?.first_name || 'Doctor';

        if (!whatsapp) continue;

        // 3. Check if we already sent the feedback request
        const { data: alreadySent } = await supabaseAdmin
            .from('user_email_logs')
            .select('id')
            .eq('user_id', userId)
            .eq('email_type', 'whatsapp_feedback_request')
            .maybeSingle();

        if (alreadySent) continue;

        // 4. Send the message
        const message = `Hi ${name}! 👋 Your 3-day premium access on Study Prometric has expired. 

We'd love to hear about your experience! How did you find the AI clinical cases? Your feedback helps us make the platform even better for medical professionals.

Simply reply here or visit us to share your thoughts. If you're ready to continue your journey, view our plans here: ${baseUrl}/subscription`;

        const result = await sendWhatsAppMessage(whatsapp, message);

        if (result.success) {
            // 5. Log it to prevent duplicates
            await supabaseAdmin.from('user_email_logs').insert({
                user_id: userId,
                email_type: 'whatsapp_feedback_request'
            });
            sentCount++;
        }
    }

    return new Response(JSON.stringify({ message: "Process completed", messagesSent: sentCount }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[whatsapp-trial-expiry] Unhandled Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});