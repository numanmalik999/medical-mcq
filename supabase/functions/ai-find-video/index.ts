// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

    const prompt = `You are a medical education curator. Your task is to find the EXACT 11-character YouTube Video ID for a high-quality educational video on the topic: "${topic}".
    
    Search your internal database for videos from these specific channels ONLY:
    - Osmosis
    - Ninja Nerd
    - Khan Academy Medicine
    - Armando Hasudungan
    
    CRITICAL: Do NOT hallucinate or invent a "youtube_video_id". It MUST be a real, working 11-character ID. If you are unsure of the specific ID, try to recall the most popular video for this topic from the channels mentioned above.
    
    Return ONLY a valid JSON object:
    {
      "title": "The exact or highly accurate title of the video",
      "description": "A 2-3 sentence summary of the video content.",
      "youtube_video_id": "11_CHAR_ID"
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean potential markdown code blocks from response
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);

    console.log(`AI found video for "${topic}": ${data.youtube_video_id}`);

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