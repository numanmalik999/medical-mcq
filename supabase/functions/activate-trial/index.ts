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
    const { user_id } = await req.json();
    console.log("[activate-trial] Starting activation for user:", user_id);

    if (!user_id) throw new Error('User ID is required');

    // 1. Fetch the current user's profile to get their identifiers
    const { data: currentUser, error: userFetchError } = await supabaseAdmin
      .from('profiles')
      .select('phone_number, whatsapp_number, first_name, last_name')
      .eq('id', user_id)
      .single();

    if (userFetchError) throw userFetchError;

    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id);
    const userEmail = authUser?.user?.email || 'Unknown';

    // 2. FRAUD CHECK: Check if these phone numbers have been used for a trial before
    if (currentUser.phone_number || currentUser.whatsapp_number) {
        const { data: duplicateTrials, error: dupError } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('trial_taken', true)
            .neq('id', user_id) // Don't check the current record
            .or(`phone_number.eq.${currentUser.phone_number},whatsapp_number.eq.${currentUser.whatsapp_number}`);

        if (dupError) console.error("[activate-trial] Duplicate check error:", dupError);

        if (duplicateTrials && duplicateTrials.length > 0) {
            console.warn(`[activate-trial] Fraud detected! User ${userEmail} tried to claim trial with duplicate numbers.`);
            
            // Notify Admin
            await supabaseAdmin.functions.invoke('send-email', {
                body: {
                    to: 'ADMIN_EMAIL',
                    subject: '⚠️ Suspicious Trial Attempt Detected',
                    body: `
                        <h3>Fraud Alert: Duplicate Trial Request</h3>
                        <p>A user attempted to activate a 3-day trial on a new account, but their phone numbers are already linked to an existing trial.</p>
                        <ul>
                            <li><strong>New Email:</strong> ${userEmail}</li>
                            <li><strong>Name:</strong> ${currentUser.first_name} ${currentUser.last_name}</li>
                            <li><strong>Phone:</strong> ${currentUser.phone_number}</li>
                            <li><strong>WhatsApp:</strong> ${currentUser.whatsapp_number}</li>
                        </ul>
                        <p>The system has automatically blocked this request.</p>
                    `
                }
            });

            return new Response(JSON.stringify({ 
                error: "Activation blocked. Our records show that a free trial has already been utilized with these contact details. Please subscribe to continue." 
            }), { 
                status: 403, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
        }
    }

    // 3. Get the '3-Day Trial' tier ID
    const { data: tier, error: tierError } = await supabaseAdmin
      .from('subscription_tiers')
      .select('id, duration_in_months')
      .eq('name', '3-Day Trial')
      .maybeSingle();

    if (!tier || tierError) {
      throw new Error("Subscription tier '3-Day Trial' not configured.");
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 3);

    // 4. Create the subscription record
    const { error: subError } = await supabaseAdmin
      .from('user_subscriptions')
      .insert({
        user_id,
        subscription_tier_id: tier.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        status: 'active'
      });

    if (subError) throw subError;

    // 5. Update the profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        has_active_subscription: true,
        trial_taken: true 
      })
      .eq('id', user_id);

    if (profileError) throw profileError;

    return new Response(JSON.stringify({ message: "Trial activated successfully" }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("[activate-trial] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});