// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { days } = await req.json();
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey || '');
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a professional medical education consultant for 'Study Prometric'. 
    Write a re-engagement email for a student who hasn't logged in for ${days} days.
    
    The tone should be encouraging and professional. Remind them that consistency is key to passing the DHA/SMLE/MOH exams. 
    Mention a new high-yield clinical pearl or feature they might have missed (like AI Clinical Cases or new Simulated Exams).
    
    Return ONLY a JSON object:
    {
      "subject": "A compelling email subject line",
      "body": "The HTML email body content. Use <br/> for breaks. Start with 'Hi [Name],'. Use professional formatting."
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

    return new Response(text, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});