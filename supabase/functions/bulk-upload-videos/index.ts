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

  // @ts-ignore
  const supabaseAdmin = createClient(
    // @ts-ignore
    Deno.env.get('SUPABASE_URL') ?? '',
    // @ts-ignore
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const { videos } = await req.json();
    console.log(`[bulk-upload-videos] Received ${videos?.length || 0} videos for processing.`);

    if (!Array.isArray(videos) || videos.length === 0) {
      return new Response(JSON.stringify({ error: 'No videos provided or invalid input.' }), { 
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

    for (const video of (videos as IncomingVideo[])) {
      try {
        const videoIdStr = String(video.video_id).trim();
        const platform = 'vimeo';

        const parentName = video.parent_category.trim();
        let groupId = groupMap.get(parentName.toLowerCase());

        if (!groupId) {
          console.log(`[bulk-upload-videos] Creating new parent group: ${parentName}`);
          const { data: newGroup, error: gErr } = await supabaseAdmin
            .from('video_groups')
            .insert({ name: parentName, order: 0 })
            .select('id').single();
          
          if (gErr) throw new Error(`Failed to create group "${parentName}": ${gErr.message}`);
          groupId = newGroup.id;
          groupMap.set(parentName.toLowerCase(), groupId);
        }

        let subgroupId = null;
        if (video.sub_category?.trim()) {
          const subName = video.sub_category.trim();
          const subKey = `${groupId}_${subName.toLowerCase()}`;
          subgroupId = subgroupMap.get(subKey);

          if (!subgroupId) {
            console.log(`[bulk-upload-videos] Creating new sub-group: ${subName} under ${parentName}`);
            const { data: newSub, error: sErr } = await supabaseAdmin
              .from('video_subgroups')
              .insert({ 
                name: subName, 
                group_id: groupId, 
                order: parseInt(String(video.sub_category_order)) || 0 
              })
              .select('id').single();
            
            if (sErr) throw new Error(`Failed to create sub-group "${subName}": ${sErr.message}`);
            subgroupId = newSub.id;
            subgroupMap.set(subKey, subgroupId);
          }
        }

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

        if (vErr) {
            console.error(`[bulk-upload-videos] DB Error for "${video.video_title}":`, vErr);
            throw new Error(vErr.message);
        }

        successCount++;
      } catch (e: any) {
        console.error(`[bulk-upload-videos] Processing error:`, e.message);
        errorCount++;
        errors.push(`Failed "${video.video_title}": ${e.message}`);
      }
    }

    console.log(`[bulk-upload-videos] Finished. Success: ${successCount}, Errors: ${errorCount}`);

    return new Response(JSON.stringify({ successCount, errorCount, errors }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[bulk-upload-videos] Critical Function Error:`, (error as Error).message);
    return new Response(JSON.stringify({ error: (error as Error).message }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});