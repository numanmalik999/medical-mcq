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
    // Using 2.0 Flash for better reasoning and retrieval
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a medical education specialist. Your task is to provide the EXACT 11-character YouTube Video ID for the most relevant, high-quality educational video on the topic: "${topic}".

    RULES:
    1. Only use videos from these trusted channels: Osmosis, Ninja Nerd, Khan Academy Medicine, or Armando Hasudungan.
    2. THE ID MUST BE REAL. Do not guess, do not create a random string, and do not use an ID you are not 100% certain of. 
    3. If you are even slightly unsure of the exact 11-character ID, do not provide one. Instead, return an empty string for "youtube_video_id".
    4. Verify the ID against your internal knowledge of the specific video's content and duration.

    Return ONLY a valid JSON object:
    {
      "title": "Clear educational title",
      "description": "2-3 sentence summary of the video content.",
      "youtube_video_id": "11_CHAR_ID_OR_EMPTY",
      "verification_note": "A brief internal thought on why this ID is correct (e.g., 'Matches the Osmosis video on X')"
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean potential markdown code blocks from response
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const data = JSON.parse(text);

    console.log(`AI Result for "${topic}": ID=${data.youtube_video_id}, Note=${data.verification_note}`);

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