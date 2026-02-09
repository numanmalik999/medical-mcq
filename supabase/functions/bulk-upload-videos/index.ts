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

    // Pre-fetch groups and subgroups for mapping
    const { data: allGroups } = await supabaseAdmin.from('video_groups').select('id, name');
    const { data: allSubgroups } = await supabaseAdmin.from('video_subgroups').select('id, name, group_id');

    const groupMap = new Map(allGroups?.map((g: any) => [g.name.toLowerCase().trim(), g.id]) || []);
    const subgroupMap = new Map(allSubgroups?.map((sg: any) => [`${sg.group_id}_${sg.name.toLowerCase().trim()}`, sg.id]) || []);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    // Improved helper to find values regardless of capitalization or exact naming
    const getFlexibleVal = (obj: any, targetKeys: string[]) => {
      const entryKeys = Object.keys(obj);
      for (const target of targetKeys) {
        // Try exact match
        if (obj[target] !== undefined) return obj[target];
        
        // Try case-insensitive and space-normalized match
        const normalizedTarget = target.toLowerCase().replace(/\s/g, '');
        const foundKey = entryKeys.find(ek => ek.toLowerCase().replace(/\s/g, '') === normalizedTarget);
        if (foundKey) return obj[foundKey];
      }
      return undefined;
    };

    for (const item of videos) {
      try {
        const parentName = String(getFlexibleVal(item, ['Parent Category', 'parent_category', 'Category', 'Specialty']) || '').trim();
        const subName = String(getFlexibleVal(item, ['Sub-Category', 'sub_category', 'Topic', 'Subtopic']) || '').trim();
        const videoTitle = String(getFlexibleVal(item, ['Video Title', 'title', 'Name', 'Lesson Title']) || '').trim();
        const videoIdStr = String(getFlexibleVal(item, ['Vimeo ID', 'video_id', 'ID', 'vimeo_id', 'youtube_video_id']) || '').trim();
        const imageUrl = String(getFlexibleVal(item, ['Image URL', 'image_url', 'Thumbnail']) || '').trim();
        const orderVal = parseInt(String(getFlexibleVal(item, ['Display Number (Order)', 'order', 'Position', 'Order']) || '0'));

        if (!parentName || !videoTitle || !videoIdStr) {
          throw new Error(`Missing required columns for video: "${videoTitle || 'Unknown'}". Ensure Parent Category, Video Title, and Vimeo ID are present.`);
        }

        // 1. Resolve or Create Group
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

        // 2. Resolve or Create Subgroup
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

        // 3. Upsert Video
        const videoPayload = {
          title: videoTitle,
          youtube_video_id: videoIdStr,
          platform: 'vimeo',
          group_id: groupId,
          subgroup_id: subgroupId,
          image_url: imageUrl || null,
          order: orderVal,
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