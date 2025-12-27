// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.14.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { topic_title } = await req.json();
    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are an expert medical educator for 'Study Prometric'. Generate a comprehensive guide for: "${topic_title}".
    Use HTML tags (<ul>, <li>, <p>) for formatting.
    
    You must also include a "youtube_video_id". 
    CRITICAL: This MUST be a real, working 11-character YouTube ID from Osmosis, Ninja Nerd, or Khan Academy Medicine. DO NOT MAKE ONE UP. If you don't know a specific working ID for this topic, leave the "youtube_video_id" field empty.

    Return ONLY a JSON object with these keys: 
    title, definition, main_causes, symptoms, diagnostic_tests, diagnostic_criteria, treatment_management, youtube_video_id`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return new Response(JSON.stringify({ content: text }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});