// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import OpenAI from 'https://esm.sh/openai@4.52.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { topic } = await req.json();
    if (!topic) throw new Error('Topic is required');

    // @ts-ignore
    const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

    const prompt = `You are a medical education curator. Find a high-quality educational YouTube video for the topic: "${topic}".
    
    Search for videos from: Osmosis, Ninja Nerd, Khan Academy Medicine, or Armando Hasudungan.
    
    Return a valid JSON object with:
    1. "title": A clear, educational title for this video.
    2. "description": A 2-3 sentence summary of what the video covers.
    3. "youtube_video_id": The 11-character YouTube video ID.
    
    Format: {"title": "...", "description": "...", "youtube_video_id": "..."}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});