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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { email, password, full_name, phone_number, whatsapp_number, is_admin } = await req.json();

    if (!email || !password || !full_name || !phone_number || !whatsapp_number) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, password, full_name, phone_number, and whatsapp_number are mandatory.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const nameParts = full_name.trim().split(' ');
    const firstName = nameParts[0];
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

    // 1. Create user in auth.users
    const { data: userData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
        phone_number: phone_number,
        whatsapp_number: whatsapp_number,
      },
    });

    if (authError) {
      console.error('Error creating user:', authError);
      throw new Error(`Failed to create user: ${authError.message}`);
    }

    const newUserId = userData.user.id;

    // 2. Manually upsert profile data
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: newUserId,
        first_name: firstName,
        last_name: lastName,
        phone_number: phone_number,
        whatsapp_number: whatsapp_number,
        is_admin: is_admin || false,
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Error upserting profile after user creation:', profileError);
    }

    return new Response(JSON.stringify({ message: 'User created successfully.', userId: newUserId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-create-user Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});