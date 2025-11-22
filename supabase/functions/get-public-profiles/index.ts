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

interface ProfileData {
    id: string;
    first_name: string | null;
    last_name: string | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client with service role key
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { user_ids } = await req.json();

    if (!Array.isArray(user_ids) || user_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid user_ids array.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch public profile data using the service role key (bypasses RLS)
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', user_ids);

    if (profilesError) {
      console.error('Error fetching public profiles:', profilesError);
      return new Response(JSON.stringify({ error: profilesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // 2. Fetch auth data (emails) for the same users
    // Note: This involves multiple calls but is necessary to get emails using the admin client.
    const usersWithEmail = await Promise.all(user_ids.map(async (id: string) => {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(id);
        return { id, email: userData?.user?.email || null };
    }));
    
    const emailMap = new Map(usersWithEmail.map(u => [u.id, u.email]));

    // 3. Combine profile data with email
    const combinedData = (profiles as ProfileData[]).map(profile => ({
        ...profile,
        email: emailMap.get(profile.id) || null,
    }));

    return new Response(JSON.stringify(combinedData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Unhandled error in get-public-profiles Edge Function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});