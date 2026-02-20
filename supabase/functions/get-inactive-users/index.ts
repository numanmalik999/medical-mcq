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
    const { days } = await req.json();
    if (!days) throw new Error("Days threshold is required.");

    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - days);
    
    const inactiveUsers = (users || []).filter((user: any) => {
      const lastSeen = user.last_sign_in_at ? new Date(user.last_sign_in_at) : new Date(user.created_at);
      return lastSeen <= thresholdDate;
    });

    const userIds = inactiveUsers.map((u: any) => u.id);
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIds);

    const profileMap = new Map(profiles?.map((p: any) => [p.id, p]) || []);

    const result = inactiveUsers.map((u: any) => ({
      id: u.id,
      email: u.email,
      name: (profileMap.get(u.id) as any)?.first_name || 'Doctor',
      last_sign_in: u.last_sign_in_at || u.created_at
    }));

    return new Response(JSON.stringify({ users: result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});