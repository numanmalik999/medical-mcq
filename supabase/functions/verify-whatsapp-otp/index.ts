// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

declare global {
  namespace Deno {
    namespace env {
      function get(key: string): string | undefined;
    }
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { user_id, code } = await req.json();

    // 1. Validate the code
    const { data: record, error: fetchError } = await supabaseAdmin
      .from('user_verification_codes')
      .select('id, phone_number')
      .eq('user_id', user_id)
      .eq('code', code)
      .gte('expires_at', new Date().toISOString())
      .single();

    if (fetchError || !record) throw new Error("Invalid or expired verification code.");

    // 2. Clear used codes
    await supabaseAdmin.from('user_verification_codes').delete().eq('user_id', user_id);

    // 3. Update profile with the verified phone number
    await supabaseAdmin.from('profiles').update({ 
        phone_number: record.phone_number,
        whatsapp_number: record.phone_number 
    }).eq('id', user_id);

    // 4. Trigger existing trial activation logic
    const { data: trialRes, error: trialError } = await supabaseAdmin.functions.invoke('activate-trial', {
        body: { user_id }
    });

    if (trialError || trialRes?.error) throw new Error(trialRes?.error || "Verification success, but trial activation failed.");

    return new Response(JSON.stringify({ message: "Identity verified. Trial activated!" }), { status: 200, headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});