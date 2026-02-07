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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    console.log("[engagement-drip-emails] Starting drip campaign check...");

    const now = new Date();
    
    const day2Date = new Date();
    day2Date.setDate(now.getDate() - 2);
    
    const day5Date = new Date();
    day5Date.setDate(now.getDate() - 5);

    const { data: day2Users } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name')
      .is('has_active_subscription', true)
      .gte('updated_at', day2Date.toISOString().split('T')[0] + 'T00:00:00')
      .lte('updated_at', day2Date.toISOString().split('T')[0] + 'T23:59:59');

    const { data: day5Users } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name')
      .is('has_active_subscription', false)
      .gte('updated_at', day5Date.toISOString().split('T')[0] + 'T00:00:00')
      .lte('updated_at', day5Date.toISOString().split('T')[0] + 'T23:59:59');

    const sendEmail = async (userId: string, firstName: string, type: string) => {
      const { data: alreadySent } = await supabaseAdmin
        .from('user_email_logs')
        .select('id')
        .eq('user_id', userId)
        .eq('email_type', type)
        .maybeSingle();

      if (alreadySent) return;

      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
      const email = userData?.user?.email;
      if (!email) return;

      let subject = "";
      let body = "";

      if (type === 'trial_reminder') {
        subject = "🚀 Halfway there! Master the DHA/SMLE with AI";
        body = `Hi ${firstName || 'Doctor'},<br/><br/>
                Your 3-day premium trial is in full swing! Have you tried our <strong>AI Clinical Cases</strong> yet? 
                They are the best way to simulate real-world diagnostic logic required for the Prometric exams.<br/><br/>
                Don't let your progress stop when the trial ends. <a href="${Deno.env.get('APP_BASE_URL')}/subscription">Lock in your premium access today</a>.<br/><br/>
                Keep studying hard!`;
      } else if (type === 'trial_expired') {
        subject = "⏳ Your Trial Expired - Ready to Continue?";
        body = `Hi ${firstName || 'Doctor'},<br/><br/>
                Your trial access has ended, but your journey to practicing in the Gulf shouldn't!<br/><br/>
                We've added new high-yield MCQs to the bank this week. Pick up right where you left off and ensure you pass your exam on the first attempt.<br/><br/>
                <a href="${Deno.env.get('APP_BASE_URL')}/subscription">View our affordable study plans here.</a><br/><br/>
                See you back in the app!`;
      }

      await supabaseAdmin.functions.invoke('send-email', {
        body: { to: email, subject, body }
      });

      await supabaseAdmin.from('user_email_logs').insert({ user_id: userId, email_type: type });
    };

    if (day2Users) {
      for (const u of day2Users) await sendEmail(u.id, u.first_name, 'trial_reminder');
    }

    if (day5Users) {
      for (const u of day5Users) await sendEmail(u.id, u.first_name, 'trial_expired');
    }

    return new Response(JSON.stringify({ message: "Drip check completed" }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[engagement-drip-emails] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});