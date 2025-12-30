// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.14.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { topic, target_keywords } = await req.json();
    
    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a professional medical content writer and SEO expert. 
    Topic: "${topic}"
    Target Keywords: ${target_keywords || 'Prometric exam preparation, medical MCQs, nursing license'}

    Create a high-quality blog post.
    Guidelines:
    1. Educational and authoritative tone.
    2. Optimized for SEO (H1, H2 tags).
    3. Include a compelling title.
    4. Provide a meta description.
    5. Include a section on how 'Study Prometric' can help with this topic.

    Return ONLY a JSON object:
    {
      "title": "...",
      "slug": "url-friendly-slug",
      "content": "Full Markdown/HTML content",
      "meta_description": "...",
      "keywords": ["list", "of", "keywords"]
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

    return new Response(text, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});