// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IncomingVideo {
  parent_category: string;
  sub_category?: string;
  video_title: string;
  order: number;
  video_id: string;
  platform?: 'youtube' | 'vimeo' | 'dailymotion';
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // @ts-ignore
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

    // Cache for IDs to avoid redundant DB calls
    const groupCache = new Map<string, string>();
    const subgroupCache = new Map<string, string>();

    for (const video of videos) {
      try {
        // 1. Resolve Parent Category (Group)
        const parentName = video.parent_category.trim();
        let groupId = groupCache.get(parentName);

        if (!groupId) {
          const { data: existingGroup } = await supabaseAdmin
            .from('video_groups')
            .select('id')
            .eq('name', parentName)
            .maybeSingle();

          if (existingGroup) {
            groupId = existingGroup.id;
          } else {
            const { data: newGroup, error: groupErr } = await supabaseAdmin
              .from('video_groups')
              .insert({ name: parentName, order: 0 })
              .select('id')
              .single();
            if (groupErr) throw groupErr;
            groupId = newGroup.id;
          }
          groupCache.set(parentName, groupId!);
        }

        // 2. Resolve Sub-category (Subgroup) if provided
        let subgroupId = null;
        if (video.sub_category && video.sub_category.trim()) {
          const subName = video.sub_category.trim();
          const cacheKey = `\${groupId}_\${subName}`;
          subgroupId = subgroupCache.get(cacheKey);

          if (!subgroupId) {
            const { data: existingSub } = await supabaseAdmin
              .from('video_subgroups')
              .select('id')
              .eq('group_id', groupId)
              .eq('name', subName)
              .maybeSingle();

            if (existingSub) {
              subgroupId = existingSub.id;
            } else {
              const { data: newSub, error: subErr } = await supabaseAdmin
                .from('video_subgroups')
                .insert({ name: subName, group_id: groupId, order: 0 })
                .select('id')
                .single();
              if (subErr) throw subErr;
              subgroupId = newSub.id;
            }
            subgroupCache.set(cacheKey, subgroupId!);
          }
        }

        // 3. Insert/Update Video
        const videoData = {
          title: video.video_title,
          youtube_video_id: video.video_id,
          platform: video.platform || 'vimeo', // Default to vimeo as requested
          group_id: groupId,
          subgroup_id: subgroupId,
          order: video.order || 0
        };

        const { error: videoErr } = await supabaseAdmin
          .from('videos')
          .upsert(videoData, { onConflict: 'youtube_video_id' }); // Assuming unique IDs

        if (videoErr) throw videoErr;
        successCount++;

      } catch (e: any) {
        errorCount++;
        errors.push(`Failed to process "\${video.video_title}": \${e.message}`);
      }
    }

    return new Response(JSON.stringify({
      message: 'Bulk upload completed.',
      successCount,
      errorCount,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});