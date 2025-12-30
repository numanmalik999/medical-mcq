// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.14.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // 1. Setup AI and Database Clients
    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    // @ts-ignore
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    // @ts-ignore
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. AI Brainstorming and Writing
    const prompt = `You are a world-class medical educator and SEO specialist for 'Study Prometric'. 
    Your goal is to write a blog post for medical professionals (doctors, nurses, pharmacists) preparing for licensing exams in the Gulf (DHA, MOH, HAAD, SMLE, OMSB, QCHP).

    TASK:
    1. Brainstorm a high-yield medical topic or exam strategy that is currently trending or essential for these candidates.
    2. Write a comprehensive, authoritative, and engaging article (approx. 1000 words).
    3. Include clear headings (H1, H2), structured advice, and clinical pearls.
    4. Mention how the 'Study Prometric' platform (with its AI clinical cases and question bank) is a vital resource for this specific topic.

    Return ONLY a JSON object:
    {
      "title": "Compelling SEO Title",
      "slug": "url-friendly-slug",
      "content": "Full article in Markdown/HTML format",
      "meta_description": "A 150-160 character meta description for Google",
      "keywords": ["list", "of", "5", "target", "keywords"]
    }`;

    console.log("Generating weekly blog content...");
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const blogData = JSON.parse(text);

    // 3. Insert into Database
    const { data, error } = await supabaseAdmin
      .from('blogs')
      .insert({
        title: blogData.title,
        slug: `${blogData.slug}-${Date.now().toString().slice(-4)}`, // Ensure uniqueness
        content: blogData.content,
        meta_description: blogData.meta_description,
        keywords: blogData.keywords,
        status: 'published',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Successfully published automated blog: ${blogData.title}`);

    return new Response(JSON.stringify({ message: "Blog published successfully", id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Auto-blog generation failed:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});