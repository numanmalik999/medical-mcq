// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import OpenAI from 'https://esm.sh/openai@4.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function generateStructuredTopicContent(topicTitle: string) {
  // @ts-ignore
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OpenAI API key is missing.');
  }

  const openai = new OpenAI({ apiKey: openaiApiKey });

  const prompt = `You are an expert medical educator creating high-yield, exam-style content for a platform called 'Study Prometric'. Your task is to generate a comprehensive guide for the medical topic provided below.

The content must be structured into the following sections. For each section, provide detailed, clinically relevant information suitable for a student preparing for a medical licensing exam. Use HTML tags like <h2>, <p>, and <ul><li>...</li></ul> for formatting within each content string.

1.  **Definition:** A clear, concise definition of the condition.
2.  **Main Causes:** A list of the most common etiologies and risk factors.
3.  **Symptoms:** The classic clinical presentation, including key signs and symptoms.
4.  **Diagnostic Tests:** Key laboratory findings, imaging studies, and other relevant tests.
5.  **Diagnostic Criteria:** The established criteria for diagnosis.
6.  **Treatment/Management:** A comprehensive overview of the treatment strategy. Break this down into "Initial Management (Supportive Care)" and "Specific/Definitive Treatment" where applicable.
7.  **YouTube Video Embed:** Find a relevant, high-quality educational video **on YouTube** from one of the following reputable channels: **Osmosis, Khan Academy Medicine, Armando Hasudungan, or Ninja Nerd**. Provide the full HTML \`<iframe>\` embed code for this video. The \`src\` attribute must use the \`https://www.youtube.com/embed/VIDEO_ID\` format. The iframe should be responsive (\`width="100%"\`).

**Topic:** ${topicTitle}

The entire output MUST be a single, valid JSON object with the following keys: \`title\`, \`definition\`, \`main_causes\`, \`symptoms\`, \`diagnostic_tests\`, \`diagnostic_criteria\`, \`treatment_management\`, and \`youtube_embed_code\`.

Do not include any introductory text, markdown code blocks (like \`\`\`json), or any other text outside of this JSON object.`;

  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const responseContent = chatCompletion.choices[0].message.content;
  if (!responseContent) {
    throw new Error('OpenAI did not return any content.');
  }

  return JSON.parse(responseContent);
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic_title } = await req.json();
    if (!topic_title) {
      return new Response(JSON.stringify({ error: 'Missing required field: topic_title.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiResponse = await generateStructuredTopicContent(topic_title);

    // The AI response is the structured JSON. We stringify it to store in a single text field.
    const combinedContent = JSON.stringify(aiResponse);

    return new Response(JSON.stringify({ content: combinedContent }), {
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