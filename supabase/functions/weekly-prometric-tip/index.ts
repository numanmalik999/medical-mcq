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
  
  Return ONLY a valid JSON object:
  {
    "title": "Short catchy title",
    "content": "A 2-3 paragraph explanation in Markdown with clinical pearls. End with a one-sentence teaser on how clinical reasoning is key for our AI Cases.",
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
    const { preview = false } = await req.json();
    
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    console.log("[weekly-tip] Generating AI content...");
    const tipData = await generatePrometricTip(model);

    if (preview) {
      return new Response(JSON.stringify({ 
        message: "Preview generated successfully", 
        tip: tipData 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; background-color: #f9fafb; padding: 20px;">
        <div style="background-color: #1e3a8a; color: white; padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em;">Study Prometric</h1>
          <p style="opacity: 0.9; margin-top: 8px; font-weight: 500;">High-Yield Clinical Insights</p>
        </div>
        
        <div style="background-color: white; padding: 35px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #1e3a8a; font-size: 22px; font-weight: 700; margin-bottom: 20px;">${tipData.title}</h2>
          
          <div style="line-height: 1.7; font-size: 16px; color: #4b5563;">
            ${tipData.content.replace(/\n/g, '<br/>')}
          </div>

          <div style="margin: 35px 0; padding: 25px; background-color: #eff6ff; border-radius: 12px; border: 1px solid #bfdbfe;">
            <h3 style="color: #1e40af; margin-top: 0; font-size: 18px;">🚀 Unlock Your Full Potential</h3>
            <p style="font-size: 14px; color: #1e3a8a; margin-bottom: 15px;">Pass your DHA, SMLE, or MOH exam on the first attempt with our Premium tools:</p>
            <ul style="font-size: 14px; color: #374151; padding-left: 20px; margin-bottom: 0;">
              <li style="margin-bottom: 8px;"><strong>5,000+</strong> Updated High-Yield MCQs</li>
              <li style="margin-bottom: 8px;"><strong>AI Clinical Cases:</strong> Interactive Diagnostic Simulations</li>
              <li style="margin-bottom: 8px;"><strong>Simulated Exams:</strong> Realistic Timed Practice Sessions</li>
              <li><strong>Expert Video Library:</strong> Master Complex Topics Fast</li>
            </ul>
          </div>

          <div style="text-align: center;">
            <a href="${appBaseUrl}/subscription" style="background-color: #1e3a8a; color: white; padding: 16px 32px; text-decoration: none; font-weight: 800; border-radius: 99px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(30, 58, 138, 0.3);">
              Upgrade to Premium Access
            </a>
            <p style="margin-top: 15px; font-size: 13px; color: #6b7280;">No credit card required for trial users.</p>
          </div>

          <hr style="margin: 40px 0 20px; border: 0; border-top: 1px solid #f3f4f6;" />
          
          <p style="font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.5;">
            You are receiving this clinical insight as a member of the Study Prometric community.<br/>
            &copy; ${new Date().getFullYear()} Study Prometric. All rights reserved.
          </p>
        </div>
      </div>
    `;

    // 4. Send in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < recipientList.length; i += BATCH_SIZE) {
      const batch = recipientList.slice(i, i + BATCH_SIZE);
      await supabaseAdmin.functions.invoke('send-email', {
        body: {
          to: batch,
          subject: `🧠 ${tipData.subject}`,
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