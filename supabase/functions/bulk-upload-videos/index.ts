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

interface IncomingVideo {
  parent_category: string;
  sub_category?: string;
  sub_category_order?: number;
  video_title: string;
  order: number;
  video_id: string;
  platform?: string;
}

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

    if (!Array.isArray(videos)) {
      return new Response(JSON.stringify({ error: 'Invalid input.' }), { status: 400, headers: corsHeaders });
    }

    // 1. Load all existing structural data once to avoid per-row queries
    const { data: allGroups } = await supabaseAdmin.from('video_groups').select('id, name');
    const { data: allSubgroups } = await supabaseAdmin.from('video_subgroups').select('id, name, group_id, order');

    const groupMap = new Map(allGroups?.map((g: any) => [g.name.toLowerCase(), g.id]) || []);
    const subgroupMap = new Map(allSubgroups?.map((sg: any) => [`${sg.group_id}_${sg.name.toLowerCase()}`, sg.id]) || []);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const video of (videos as IncomingVideo[])) {
      try {
        const videoIdStr = String(video.video_id).trim();
        const platform = (video.platform || 'vimeo').toLowerCase();

        // Resolve or Create Parent Group
        const parentName = video.parent_category.trim();
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

        // Resolve or Create Sub-category
        let subgroupId = null;
        if (video.sub_category?.trim()) {
          const subName = video.sub_category.trim();
          const subKey = `${groupId}_${subName.toLowerCase()}`;
          subgroupId = subgroupMap.get(subKey);

          if (!subgroupId) {
            const { data: newSub, error: sErr } = await supabaseAdmin
              .from('video_subgroups')
              .insert({ 
                name: subName, 
                group_id: groupId, 
                order: parseInt(String(video.sub_category_order)) || 0 
              })
              .select('id').single();
            if (sErr) throw sErr;
            subgroupId = newSub.id;
            subgroupMap.set(subKey, subgroupId);
          }
        }

        // Upsert Video based on video_id
        const { error: vErr } = await supabaseAdmin
          .from('videos')
          .upsert({
            title: video.video_title.trim(),
            youtube_video_id: videoIdStr,
            platform: platform,
            group_id: groupId,
            subgroup_id: subgroupId,
            order: parseInt(String(video.order)) || 0,
            updated_at: new Date().toISOString()
          }, { onConflict: 'youtube_video_id' });

        if (vErr) throw vErr;
        successCount++;
      } catch (e: any) {
        errorCount++;
        errors.push(`Failed "${video.video_title}": ${e.message}`);
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