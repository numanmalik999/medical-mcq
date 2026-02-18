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
    const { user_id, phone_number } = await req.json();
    if (!user_id || !phone_number) throw new Error("User ID and Phone Number are required.");

    // 1. Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 2. Save to database
    const { error: dbError } = await supabaseAdmin
      .from('user_verification_codes')
      .insert({ user_id, phone_number, code });

    if (dbError) throw dbError;

    // 3. Call Meta API
    const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');
    const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
    const cleanNumber = phone_number.replace(/\D/g, '');

    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: cleanNumber,
        type: 'template',
        template: {
          name: 'auth_verification_code', // MAKE SURE THIS MATCHES YOUR META TEMPLATE NAME
          language: { code: 'en_US' },
          components: [{
            type: 'body',
            parameters: [{ type: 'text', text: code }]
          }, {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: code }]
          }]
        }
      }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(`Meta API Error: ${JSON.stringify(error)}`);
    }

    return new Response(JSON.stringify({ message: "OTP Sent Successfully" }), { status: 200, headers: corsHeaders });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});