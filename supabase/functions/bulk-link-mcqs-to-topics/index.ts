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

async function findBestTopicMatch(question: string, topics: { id: string; title: string }[]) {
  // @ts-ignore
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) throw new Error('OpenAI API key is missing.');
  const openai = new OpenAI({ apiKey: openaiApiKey });

  const topicList = topics.map(t => `- ${t.title}`).join('\n');

  const prompt = `Given the following medical question, which of the listed topics is the single most relevant? Respond with ONLY the exact topic title from the list. If no topic is a good match, respond with 'None'.

Question: "${question}"

Topics:
${topicList}`;

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  const matchedTitle = chatCompletion.choices[0].message.content?.trim();
  if (!matchedTitle || matchedTitle === 'None') return null;

  return topics.find(t => t.title === matchedTitle) || null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mcq_ids } = await req.json();
    if (!Array.isArray(mcq_ids) || mcq_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'mcq_ids must be a non-empty array.' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // @ts-ignore
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const { data: topics, error: topicsError } = await supabaseAdmin.from('course_topics').select('id, title');
    if (topicsError) throw topicsError;
    if (!topics || topics.length === 0) throw new Error("No course topics found to link to.");

    const { data: mcqs, error: mcqError } = await supabaseAdmin.from('mcqs').select('id, question_text').in('id', mcq_ids);
    if (mcqError) throw mcqError;

    let successCount = 0;
    const errors: string[] = [];

    for (const mcq of mcqs) {
      try {
        const matchedTopic = await findBestTopicMatch(mcq.question_text, topics);
        if (matchedTopic) {
          // Delete old links and insert the new one
          await supabaseAdmin.from('mcq_topic_links').delete().eq('mcq_id', mcq.id);
          const { error: linkError } = await supabaseAdmin.from('mcq_topic_links').insert({ mcq_id: mcq.id, topic_id: matchedTopic.id });
          if (linkError) throw linkError;
          successCount++;
        }
      } catch (e: any) {
        errors.push(`MCQ ${mcq.id}: ${e.message}`);
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