// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import OpenAI from 'https://esm.sh/openai@4.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateTopicContent(topicTitle: string) {
  // @ts-ignore
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    console.error('OPENAI_API_KEY is not set in environment variables.');
    throw new Error('OpenAI API key is missing. Please configure it in Supabase secrets.');
  }

  const openai = new OpenAI({
    apiKey: openaiApiKey,
  });

  const prompt = `Generate a detailed and comprehensive educational content for the following medical topic. The content should be structured with clear headings, bullet points, and paragraphs, suitable for a learning platform. Include key concepts, clinical relevance, and important facts. Aim for a length equivalent to 300-500 words.

Topic: ${topicTitle}

Please provide the output in a JSON format with one field: "content" (string, containing the structured educational content).
IMPORTANT: Only return the JSON object, no other text or markdown.`;

  console.log('OpenAI Prompt for Course Topic:', prompt);

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const responseContent = chatCompletion.choices[0].message.content;
    console.log('OpenAI Raw Response Content for Course Topic:', responseContent);

    if (!responseContent) {
      throw new Error('OpenAI AI did not return any content for the topic.');
    }

    const parsedContent = JSON.parse(responseContent);
    return {
      content: parsedContent.content,
    };
  } catch (error) {
    console.error('Failed to generate course topic content with OpenAI AI:', error);
    throw new Error(`OpenAI AI generation failed for topic: ${(error as Error).message}`);
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const requestBody = await req.json();
    console.log('Incoming Request Body for Course Topic:', requestBody);

    const { topic_title } = requestBody;

    if (!topic_title) {
      return new Response(JSON.stringify({ error: 'Missing required field: topic_title.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await generateTopicContent(topic_title);

    return new Response(JSON.stringify(aiResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-course-topic-content Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});