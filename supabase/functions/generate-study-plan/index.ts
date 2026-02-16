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

interface Category {
  id: string;
  name: string;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { user_id, exam_date, exam_name } = await req.json();
    
    // @ts-ignore
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // @ts-ignore
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 1. Fetch available specialties to build the plan
    const { data: categories } = await supabaseAdmin.from('categories').select('id, name');
    const categoryNames = (categories as Category[] | null)?.map((c: Category) => c.name).join(', ') || 'General Medicine';

    const daysUntilExam = Math.ceil((new Date(exam_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExam <= 0) throw new Error('Exam date must be in the future.');

    // 2. Ask AI to distribute these categories over the available days
    const prompt = `You are a medical study consultant. A student is preparing for the ${exam_name} exam on ${exam_date} (${daysUntilExam} days from now).
    
    Available study categories: ${categoryNames}.

    Create a high-level daily study plan. Group categories into logical "Phases" (e.g., Foundation, Clinical, Review).
    
    Return ONLY a JSON array of objects representing daily tasks for the next ${Math.min(daysUntilExam, 60)} days (limit to 60 for now):
    [
      { "date": "YYYY-MM-DD", "task_title": "Category Name: Specific Focus", "category_name": "Match one from list" }
    ]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text().replace(/```json/g, '').replace(/```/g, '').trim();
    const planItems = JSON.parse(text);

    // 3. Save the plan to the database
    const { data: plan, error: planErr } = await supabaseAdmin
      .from('study_plans')
      .insert({ user_id, exam_date, exam_name })
      .select('id')
      .single();

    if (planErr) throw planErr;

    const itemsToInsert = planItems.map((item: any) => {
      const cat = (categories as Category[] | null)?.find((c: Category) => c.name.toLowerCase().includes(item.category_name.toLowerCase()));
      return {
        study_plan_id: plan.id,
        planned_date: item.date,
        task_title: item.task_title,
        category_id: cat?.id || null
      };
    });

    await supabaseAdmin.from('study_plan_items').insert(itemsToInsert);

    return new Response(JSON.stringify({ message: "Plan generated successfully", plan_id: plan.id }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});