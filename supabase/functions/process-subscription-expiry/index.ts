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
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');

  if (!phoneNumberId || !accessToken) {
    console.error("[expiry-sync] WhatsApp credentials missing.");
    return { success: false };
  }

  const cleanNumber = phoneNumber.replace(/\D/g, '');
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: cleanNumber,
      type: 'text',
      text: { body: message },
    }),
  });

  return { success: response.ok };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log("[expiry-sync] Checking for newly expired subscriptions...");

    // 1. Find active subscriptions that have passed their end date
    const now = new Date().toISOString();
    const { data: expiredSubs, error: fetchError } = await supabaseAdmin
      .from('user_subscriptions')
      .select(`
        id,
        user_id,
        end_date,
        subscription_tiers (name),
        profiles (first_name, whatsapp_number)
      `)
      .eq('status', 'active')
      .lt('end_date', now);

    if (fetchError) throw fetchError;

    let processedCount = 0;
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://www.studyprometric.com';

    for (const sub of (expiredSubs || [])) {
      const userId = sub.user_id;
      const profile = (sub.profiles as any);
      const tierName = (sub.subscription_tiers as any)?.name || 'Premium';
      const name = profile?.first_name || 'Doctor';
      const whatsapp = profile?.whatsapp_number;

      // 2. Double check if we already notified for THIS specific subscription ID
      const { data: alreadyNotified } = await supabaseAdmin
        .from('user_email_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('email_type', `expiry_notice_${sub.id}`)
        .maybeSingle();

      if (alreadyNotified) continue;

      // 3. Update Database Status
      await supabaseAdmin.from('user_subscriptions').update({ status: 'expired' }).eq('id', sub.id);
      await supabaseAdmin.from('profiles').update({ has_active_subscription: false }).eq('id', userId);

      // 4. Fetch User Email (Auth Data)
      const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
      const email = authUser?.user?.email;

      // 5. Send Email
      if (email) {
        await supabaseAdmin.functions.invoke('send-email', {
          body: {
            to: email,
            subject: "Your Study Prometric Access has Expired",
            body: `
              <h3>Hello ${name},</h3>
              <p>Your <strong>${tierName}</strong> subscription has expired. Your clinical progress and bookmarks are saved, but premium features are now locked.</p>
              <p>Don't let your exam preparation stall! Renew your access today to continue mastering high-yield MCQs and AI Clinical Cases.</p>
              <p><a href="${appBaseUrl}/subscription" style="background:#1e3a8a; color:white; padding:10px 20px; text-decoration:none; border-radius:5px;">Renew My Subscription</a></p>
              <br/>
              <p>Good luck with your studies!</p>
            `
          }
        });
      }

      // 6. Send WhatsApp
      if (whatsapp) {
        const wsMsg = `Hi ${name}! 👋 Your ${tierName} access on Study Prometric has expired. Keep your momentum going and pass your exam on the first attempt! Renew here: ${appBaseUrl}/subscription`;
        await sendWhatsAppMessage(whatsapp, wsMsg);
      }

      // 7. Log Notification
      await supabaseAdmin.from('user_email_logs').insert({
        user_id: userId,
        email_type: `expiry_notice_${sub.id}`
      });

      processedCount++;
    }

    return new Response(JSON.stringify({ message: "Sync complete", processed: processedCount }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[expiry-sync] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});