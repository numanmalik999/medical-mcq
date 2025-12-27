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
    if (!geminiKey) throw new Error('GEMINI_API_KEY is not configured in Supabase secrets.');

    const genAI = new GoogleGenerativeAI(geminiKey);
    // Using gemini-2.0-flash as it's the current state-of-the-art for this task
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a medical education expert. Find the best YouTube video from 'Ninja Nerd', 'Osmosis', or 'Khan Academy Medicine' for this topic: "${topic}".

    Your goal is to provide the exact YouTube Video ID (the 11 characters after v=). 

    Return ONLY a valid JSON object:
    {
      "title": "Exact Title of the Video",
      "description": "Short 2-sentence summary.",
      "youtube_video_id": "11_character_id",
      "search_query": "The best search query to find this exact video on YouTube"
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().trim();
    
    // Clean up markdown markers if the AI includes them
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return new Response(text, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('AI Find Video Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});