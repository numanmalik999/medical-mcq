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
  platform?: 'vimeo';
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
      return new Response(JSON.stringify({ error: 'Invalid input: Expected an array of videos.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    const groupCache = new Map<string, string>();
    const subgroupCache = new Map<string, string>();

    for (const video of (videos as IncomingVideo[])) {
      try {
        const videoIdStr = String(video.video_id).trim();
        const videoTitle = video.video_title.trim();

        // 1. Resolve Parent Group
        const parentName = video.parent_category.trim();
        const parentKey = parentName.toLowerCase();
        let groupId = groupCache.get(parentKey);

        if (!groupId) {
          const { data: groups } = await supabaseAdmin
            .from('video_groups')
            .select('id')
            .ilike('name', parentName)
            .limit(1);

          if (groups && groups.length > 0) {
            groupId = groups[0].id;
          } else {
            const { data: newGroup, error: groupErr } = await supabaseAdmin
              .from('video_groups')
              .insert({ name: parentName, order: 0 })
              .select('id')
              .single();
            if (groupErr) throw new Error(`Failed to create group: ${groupErr.message}`);
            groupId = newGroup.id;
          }
          groupCache.set(parentKey, groupId!);
        }

        // 2. Resolve Sub-category (Topic)
        let subgroupId = null;
        if (video.sub_category && video.sub_category.trim()) {
          const subName = video.sub_category.trim();
          const subOrder = parseInt(String(video.sub_category_order)) || 0;
          
          const subKey = `${groupId}_${subName.toLowerCase()}`;
          const subOrderKey = `${groupId}_order_${subOrder}`;
          
          subgroupId = subgroupCache.get(subKey) || subgroupCache.get(subOrderKey);

          if (!subgroupId) {
            const { data: nameMatch } = await supabaseAdmin
              .from('video_subgroups')
              .select('id')
              .eq('group_id', groupId)
              .ilike('name', subName)
              .limit(1);

            if (nameMatch && nameMatch.length > 0) {
              subgroupId = nameMatch[0].id;
            } else if (subOrder > 0) {
              const { data: orderMatch } = await supabaseAdmin
                .from('video_subgroups')
                .select('id')
                .eq('group_id', groupId)
                .eq('order', subOrder)
                .limit(1);

              if (orderMatch && orderMatch.length > 0) {
                subgroupId = orderMatch[0].id;
                await supabaseAdmin.from('video_subgroups').update({ name: subName }).eq('id', subgroupId);
              }
            }

            if (!subgroupId) {
              const { data: newSub, error: subErr } = await supabaseAdmin
                .from('video_subgroups')
                .insert({ name: subName, group_id: groupId, order: subOrder })
                .select('id')
                .single();
              if (subErr) throw new Error(`Failed to create sub-category: ${subErr.message}`);
              subgroupId = newSub.id;
            }
            
            subgroupCache.set(subKey, subgroupId!);
            subgroupCache.set(subOrderKey, subgroupId!);
          }
        }

        // 3. Handle Video Insertion/Update
        const { data: existingVideos } = await supabaseAdmin
          .from('videos')
          .select('id')
          .eq('youtube_video_id', videoIdStr)
          .limit(1);

        const videoPayload = {
          title: videoTitle,
          youtube_video_id: videoIdStr,
          platform: 'vimeo',
          group_id: groupId,
          subgroup_id: subgroupId,
          order: parseInt(String(video.order)) || 0,
          updated_at: new Date().toISOString()
        };

        if (existingVideos && existingVideos.length > 0) {
          const { error: updateErr } = await supabaseAdmin
            .from('videos')
            .update(videoPayload)
            .eq('id', existingVideos[0].id);
          if (updateErr) throw updateErr;
        } else {
          const { error: insertErr } = await supabaseAdmin
            .from('videos')
            .insert(videoPayload);
          if (insertErr) throw insertErr;
        }

        successCount++;
      } catch (e: any) {
        errorCount++;
        errors.push(`Row failure ("${video.video_title}"): ${e.message}`);
      }
    }

    return new Response(JSON.stringify({ message: 'Batch complete.', successCount, errorCount, errors }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});