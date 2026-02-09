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
    const { videos } = await req.json();

    if (!Array.isArray(videos) || videos.length === 0) {
      return new Response(JSON.stringify({ error: 'No data provided.' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const { data: allGroups } = await supabaseAdmin.from('video_groups').select('id, name');
    const { data: allSubgroups } = await supabaseAdmin.from('video_subgroups').select('id, name, group_id');

    const groupMap = new Map(allGroups?.map((g: any) => [g.name.toLowerCase().trim(), g.id]) || []);
    const subgroupMap = new Map(allSubgroups?.map((sg: any) => [`${sg.group_id}_${sg.name.toLowerCase().trim()}`, sg.id]) || []);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const getVal = (obj: any, ...keys: string[]) => {
      for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) return obj[key];
      }
      return undefined;
    };

    for (const item of videos) {
      try {
        const parentName = String(getVal(item, 'Parent Category', 'parent_category') || '').trim();
        const subName = String(getVal(item, 'Sub-Category', 'sub_category') || '').trim();
        const videoTitle = String(getVal(item, 'Video Title', 'title') || '').trim();
        const videoIdStr = String(getVal(item, 'Vimeo ID', 'video_id', 'youtube_video_id') || '').trim();

        if (!parentName || !videoTitle || !videoIdStr) {
          throw new Error(`Missing required data for video: ${videoTitle || 'Unknown'}`);
        }

        let groupId = groupMap.get(parentName.toLowerCase());
        if (!groupId) {
          const { data: newGroup, error: gErr } = await supabaseAdmin
            .from('video_groups')
            .insert({ name: parentName, order: 0 })
            .select('id').single();
          if (gErr) throw gErr;
          groupId = newGroup.id;
          groupMap.set(parentName.toLowerCase(), groupId);
        }

        let subgroupId = null;
        if (subName) {
          const subKey = `${groupId}_${subName.toLowerCase()}`;
          subgroupId = subgroupMap.get(subKey);
          if (!subgroupId) {
            const { data: newSub, error: sErr } = await supabaseAdmin
              .from('video_subgroups')
              .insert({ name: subName, group_id: groupId, order: 0 })
              .select('id').single();
            if (sErr) throw sErr;
            subgroupId = newSub.id;
            subgroupMap.set(subKey, subgroupId);
          }
        }

        const videoPayload = {
          title: videoTitle,
          youtube_video_id: videoIdStr,
          platform: 'vimeo',
          group_id: groupId,
          subgroup_id: subgroupId,
          order: parseInt(String(getVal(item, 'Display Number (Order)', 'order') || '0')),
          updated_at: new Date().toISOString()
        };

        const { error: upsertErr } = await supabaseAdmin.from('videos').upsert(videoPayload, { onConflict: 'youtube_video_id' });
        if (upsertErr) throw upsertErr;

        successCount++;
      } catch (e: any) {
        errorCount++;
        errors.push(e.message);
      }
    }

    return new Response(JSON.stringify({ successCount, errorCount, errors }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});