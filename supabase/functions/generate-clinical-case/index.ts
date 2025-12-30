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
    const { category_name, topic } = await req.json();
    
    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are an expert medical examiner creating a clinical case study for 'Study Prometric'. 
    
    Target Category: ${category_name}
    ${topic ? `Specific Topic: ${topic}` : ''}

    Task:
    1. Create a detailed clinical vignette (Scenario). Include patient demographics, presenting symptoms, past medical history, physical examination findings, and initial lab results.
    2. Generate 3 to 4 sequential multiple-choice questions based on this case.
    3. Each question must follow the logic:
       - Question 1: Usually about the most likely diagnosis or the next best step in management.
       - Question 2: Usually about the definitive diagnostic test or underlying pathophysiology.
       - Question 3: Usually about long-term management, complications, or prognosis.
    
    Return ONLY a valid JSON object with the following structure:
    {
      "case_title": "Title of the Case",
      "vignette": "Full detailed clinical scenario text (use HTML <p> or <br/> for formatting)",
      "questions": [
        {
          "question_text": "...",
          "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
          "correct_answer": "A/B/C/D",
          "explanation": "Detailed clinical reasoning for the correct answer and why others are wrong."
        }
      ]
    }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();

    return new Response(text, {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error("AI Case Gen Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});