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

    const prompt = `You are an expert medical examiner for Gulf Prometric exams (DHA, SMLE, MOH). 
    Generate a HARD/EXPERT level clinical case study. 
    
    Target Category: ${category_name}
    ${topic ? `Specific Topic: ${topic}` : ''}

    Task:
    1. Create a "Brief Presentation" (Initial 1-2 sentences of the patient's complaint).
    2. Create a "Full Vignette" (The complete history, physical, and initial labs).
    3. Generate 3 to 4 sequential HARD multiple-choice questions. 
       - Focus on "Next Best Step", "Most Likely Diagnosis" (with complex distractors), and "Long Term Complications".
    
    Return ONLY a valid JSON object:
    {
      "case_title": "...",
      "brief_presentation": "The initial chief complaint (1-2 sentences)",
      "full_vignette": "The comprehensive clinical details (History, Exam, Labs) in Markdown",
      "questions": [
        {
          "question_text": "...",
          "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
          "correct_answer": "A/B/C/D",
          "explanation": "Detailed clinical reasoning."
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