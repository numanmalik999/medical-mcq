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

    const prompt = `You are a medical education specialist. Identify the best educational video from Ninja Nerd, Osmosis, or Khan Academy for: "${topic}".

    CRITICAL INSTRUCTIONS FOR YOUTUBE ID:
    - 99% of the time, you should leave "youtube_video_id" as an empty string "".
    - ONLY provide an 11-character ID if you are 100% certain it is the current, active ID for that video. 
    - DO NOT reconstruct, guess, or assume an ID based on keywords. 
    - Providing a fake or incorrect ID is a critical failure. If you have any doubt, use "".

    Return ONLY a valid JSON object:
    {
      "title": "Exact Video Title",
      "description": "2-3 sentence summary.",
      "youtube_video_id": "", 
      "search_query": "e.g. 'Ninja Nerd Myocardial Infarction Pharmacology'",
      "confidence_in_id": 0
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