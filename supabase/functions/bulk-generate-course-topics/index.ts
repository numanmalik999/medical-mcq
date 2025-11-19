// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
// @ts-ignore
import OpenAI from 'https://esm.sh/openai@4.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateStructuredTopicContent(topicTitle: string) {
  // @ts-ignore
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) throw new Error('OpenAI API key is missing.');
  const openai = new OpenAI({ apiKey: openaiApiKey });

  const prompt = `You are an expert medical educator creating content for 'Study Prometric'. Generate a comprehensive guide for the topic: "${topicTitle}".

The content must be structured into sections using HTML tags (<h2>, <p>, <ul>, <li>).

1.  **Definition:** A clear definition.
2.  **Main Causes:** A list of etiologies.
3.  **Symptoms:** Key signs and symptoms.
4.  **Diagnostic Tests:** Relevant labs and imaging.
5.  **Diagnostic Criteria:** Established criteria.
6.  **Treatment/Management:** Overview of treatment strategy.
7.  **YouTube Video Embed:** Provide a full HTML <iframe> embed code for a relevant educational video from Osmosis, Khan Academy Medicine, Armando Hasudungan, or Ninja Nerd. Use the youtube.com/embed/ format.

The entire output MUST be a single, valid JSON object with keys: \`title\`, \`definition\`, \`main_causes\`, \`symptoms\`, \`diagnostic_tests\`, \`diagnostic_criteria\`, \`treatment_management\`, and \`youtube_embed_code\`. Do not add any text outside this JSON object.`;

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const responseContent = chatCompletion.choices[0].message.content;
  if (!responseContent) throw new Error('OpenAI did not return any content.');
  return JSON.parse(responseContent);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { course_id, topic_titles, user_id } = await req.json();
    if (!course_id || !Array.isArray(topic_titles) || topic_titles.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing required fields: course_id or topic_titles array.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // @ts-ignore
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    
    let successCount = 0;
    const errors: string[] = [];

    for (const title of topic_titles) {
      try {
        const contentJson = await generateStructuredTopicContent(title);
        const { error: insertError } = await supabaseAdmin.from('course_topics').insert({
          course_id,
          title: title,
          content: JSON.stringify(contentJson),
          order: 0, // Default order, can be changed later
          created_by: user_id || null,
        });
        if (insertError) throw insertError;
        successCount++;
      } catch (e: any) {
        errors.push(`Failed to generate topic "${title}": ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ successCount, errorCount: errors.length, errors }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});