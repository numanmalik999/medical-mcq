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

    const prompt = `You are a medical education search specialist. Your goal is to identify the best educational video for the topic: "${topic}".

    CHANNELS TO SEARCH: Osmosis, Ninja Nerd, Khan Academy Medicine, Armando Hasudungan.

    INSTRUCTIONS:
    1. Provide the most accurate Title and Description for a video on this topic.
    2. Provide the EXACT 11-character YouTube ID ONLY if you are absolutely certain (100% confidence).
    3. If you have any doubt about the ID (even one character), leave "youtube_video_id" as an empty string "".
    4. Provide a "search_query" that the user can use to find this exact video on YouTube if the ID is missing.

    Return ONLY a valid JSON object:
    {
      "title": "Exact Video Title",
      "description": "2-3 sentence summary.",
      "youtube_video_id": "11_CHAR_ID_OR_EMPTY",
      "search_query": "The exact search term to find this video (e.g. 'Ninja Nerd Myocardial Infarction')",
      "confidence": 0-100
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);

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