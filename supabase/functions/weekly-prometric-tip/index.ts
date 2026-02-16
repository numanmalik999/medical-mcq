// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.14.0";

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

async function generatePrometricTip(model: any) {
  const prompt = `You are an expert medical educator for 'Study Prometric'. 
  Generate a single "High-Yield Prometric Tip of the Week" for medical professionals (doctors/nurses) preparing for Gulf exams (DHA, SMLE, MOH).
  
  The tip should focus on a high-probability clinical topic, a common exam "trap", or a memory mnemonic.
  
  Return ONLY a JSON object:
  {
    "title": "Short catchy title",
    "content": "A 2-3 paragraph explanation in Markdown with clinical pearls",
    "subject": "Email subject line"
  }`;

  const result = await model.generateContent(prompt);
  const response = await result.response;
  let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(text);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    console.log("[weekly-tip] Generating AI content...");
    const tipData = await generatePrometricTip(model);

    // 2. Fetch all unique emails
    const { data: subscribers } = await supabaseAdmin.from('marketing_subscriptions').select('email');
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) throw authError;

    const emailSet = new Set<string>();
    subscribers?.forEach((s: { email: string }) => emailSet.add(s.email.toLowerCase()));
    authUsers?.users?.forEach((u: { email?: string }) => {
      if (u.email) emailSet.add(u.email.toLowerCase());
    });

    const recipientList = Array.from(emailSet);
    console.log(`[weekly-tip] Found ${recipientList.length} unique recipients.`);

    if (recipientList.length === 0) {
      return new Response(JSON.stringify({ message: "No recipients found." }), { status: 200 });
    }

    // 3. Prepare Email Body
    const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://www.studyprometric.com';
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <div style="background-color: #1e3a8a; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">Weekly High-Yield Tip</h1>
          <p style="opacity: 0.8; margin-top: 5px;">Master your Prometric Exams with AI Insights</p>
        </div>
        <div style="padding: 30px; border: 1px solid #eee; border-top: none; border-radius: 0 0 10px 10px;">
          <h2 style="color: #1e3a8a;">${tipData.title}</h2>
          <div style="line-height: 1.6; font-size: 16px;">
            ${tipData.content.replace(/\n/g, '<br/>')}
          </div>
          <div style="margin-top: 30px; text-align: center;">
            <a href="${appBaseUrl}/quiz" style="background-color: #1e3a8a; color: white; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 5px; display: inline-block;">
              Practice Now
            </a>
          </div>
          <p style="margin-top: 30px; font-size: 12px; color: #888; text-align: center;">
            You are receiving this because you are a member of Study Prometric.<br/>
            Pass your DHA, SMLE, and MOH exams on the first attempt.
          </p>
        </div>
      </div>
    `;

    // 4. Send in batches (to avoid timeouts/limits)
    const BATCH_SIZE = 50;
    for (let i = 0; i < recipientList.length; i += BATCH_SIZE) {
      const batch = recipientList.slice(i, i + BATCH_SIZE);
      await supabaseAdmin.functions.invoke('send-email', {
        body: {
          to: batch,
          subject: `🧠 Study Prometric: ${tipData.subject}`,
          body: emailHtml,
        },
      });
      console.log(`[weekly-tip] Sent batch of ${batch.length} emails.`);
    }

    return new Response(JSON.stringify({ message: "Weekly tips sent successfully", count: recipientList.length }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[weekly-tip] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});