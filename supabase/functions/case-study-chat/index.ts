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
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, case_context } = await req.json();
    
    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY is not set');
    }

    const genAI = new GoogleGenerativeAI(geminiKey);

    const systemPrompt = `You are a medical consultant for a student investigating a clinical case. 
    You have the FULL patient details below, but the student only has a brief summary.
    Your goal is to answer their specific questions about the patient's history, physical findings, or lab results.
    
    CRITICAL: Only reveal what is asked for. If they ask for 'labs', give the specific labs from the context. Do not reveal the diagnosis or answer the questions directly. 
    
    CASE CONTEXT:
    ${case_context}

    Respond professionally and concisely.`;

    // Using gemini-2.0-flash for high-speed clinical analysis
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      systemInstruction: systemPrompt 
    });

    const chat = model.startChat({
      history: [
        { role: 'user', parts: [{ text: "I am ready to investigate this case." }] },
        { role: 'model', parts: [{ text: "Proceed. What aspect of the patient's presentation would you like to explore first?" }] },
        ...messages.map((m: any) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }))
      ],
    });

    const userMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage(userMessage);
    const response = await result.response;

    return new Response(JSON.stringify({ text: response.text() }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("[case-study-chat] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});