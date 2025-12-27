// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.14.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic } = await req.json();
    if (!topic) throw new Error('Topic is required');

    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not set.');

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a medical education specialist. Your task is to find a high-quality educational video on the topic: "${topic}".

    THINKING PROCESS:
    1. Identify a real video from: Osmosis, Ninja Nerd, Khan Academy Medicine, or Armando Hasudungan.
    2. Recall the exact 11-character YouTube ID (the part after v= in the URL).
    3. CRITICAL: Evaluate your confidence. If you are not 100% certain of the EXACT 11 characters, you MUST return an empty string "" for the ID.
    4. NEVER guess a single character. It is better to return NO ID than a WRONG ID.

    Return ONLY a valid JSON object:
    {
      "title": "Actual video title",
      "description": "2-3 sentence summary.",
      "youtube_video_id": "11_CHAR_ID_OR_EMPTY_STRING",
      "confidence_score": 0-100
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean potential markdown code blocks
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);

    console.log(`AI Result for "${topic}": ID=${data.youtube_video_id}, Confidence=${data.confidence_score}%`);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error in ai-find-video:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});