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
    console.log("[reengagement] Starting inactivity check...");

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    let processedCount = 0;
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://www.studyprometric.com';

    for (const user of (users || [])) {
      const lastSignIn = user.last_sign_in_at ? new Date(user.last_sign_in_at) : new Date(user.created_at);
      
      if (lastSignIn < thirtyDaysAgo) {
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

        const { data: alreadySent } = await supabaseAdmin
          .from('user_email_logs')
          .select('id')
          .eq('user_id', user.id)
          .eq('email_type', 'reengagement_30d')
          .gt('sent_at', sixtyDaysAgo.toISOString())
          .maybeSingle();

        if (alreadySent) continue;

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('first_name')
          .eq('id', user.id)
          .single();

        const name = profile?.first_name || 'Doctor';

        const emailHtml = `
          <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; color: #334155; line-height: 1.6;">
            <div style="background-color: #1e3a8a; padding: 40px 20px; text-align: center; border-radius: 20px 20px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.025em;">Study Prometric</h1>
              <p style="color: #93c5fd; margin-top: 8px; font-weight: 600; text-transform: uppercase; font-size: 12px; letter-spacing: 0.1em;">Clinical Excellence Awaits</p>
            </div>
            
            <div style="padding: 40px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 20px 20px; background-color: white;">
              <h2 style="color: #1e293b; font-size: 22px; font-weight: 700; margin-bottom: 20px;">Hi ${name}, your medical career doesn't wait.</h2>
              <p>We noticed you haven't visited Study Prometric in a while. Since your last session, we've updated our clinical bank to ensure you have the most relevant tools for your DHA, SMLE, or MOH exam.</p>
              
              <div style="margin: 30px 0; padding: 25px; background-color: #f8fafc; border-radius: 16px; border: 1px solid #f1f5f9;">
                <h3 style="color: #1e3a8a; margin-top: 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">What's New in the App:</h3>
                <ul style="padding-left: 20px; margin-bottom: 0;">
                  <li style="margin-bottom: 10px;"><strong>AI Clinical Cases:</strong> Interactive simulations that test your diagnostic logic in real-time.</li>
                  <li style="margin-bottom: 10px;"><strong>Predictive Pass Score:</strong> See your probability of passing based on your accuracy trends.</li>
                  <li style="margin-bottom: 10px;"><strong>Simulated Mock Exams:</strong> New timed sessions mirroring the 2024 Prometric interface.</li>
                  <li><strong>Memory Master:</strong> SRS flashcards to lock in high-yield clinical pearls forever.</li>
                </ul>
              </div>

              <div style="text-align: center; margin-top: 35px;">
                <a href="${appBaseUrl}/login" style="background-color: #1e3a8a; color: white; padding: 16px 35px; text-decoration: none; font-weight: 800; border-radius: 12px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(30, 58, 138, 0.3);">
                  RESUME MY PREPARATION
                </a>
              </div>
            </div>
          </div>
        `;

        await supabaseAdmin.functions.invoke('send-email', {
          body: {
            to: user.email,
            subject: "🧠 Master the Prometric: Your clinical dashboard is ready",
            body: emailHtml
          }
        });

        await supabaseAdmin.from('user_email_logs').insert({
          user_id: user.id,
          email_type: 'reengagement_30d'
        });

        processedCount++;
      }
    }

    return new Response(JSON.stringify({ message: "Process complete", sent: processedCount }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[reengagement] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});