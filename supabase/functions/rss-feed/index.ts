// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/xml; charset=utf-8',
};

interface BlogItem {
  title: string;
  slug: string;
  meta_description: string;
  created_at: string;
}

// @ts-ignore
serve(async (_req: Request) => {
  // @ts-ignore
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  // @ts-ignore
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: blogs, error } = await supabase
    .from('blogs')
    .select('title, slug, meta_description, created_at')
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return new Response('Error fetching blogs', { status: 500 });
  }

  const siteUrl = "https://www.studyprometric.com";
  
  const rssItems = (blogs as BlogItem[] | null)?.map((blog: BlogItem) => `
    <item>
      <title><![CDATA[${blog.title}]]></title>
      <link>${siteUrl}/blog/${blog.slug}</link>
      <guid>${siteUrl}/blog/${blog.slug}</guid>
      <pubDate>${new Date(blog.created_at).toUTCString()}</pubDate>
      <description><![CDATA[${blog.meta_description}]]></description>
    </item>
  `).join('') || '';

  // Ensure the XML declaration starts at the very first character of the string
  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Study Prometric Medical Blog</title>
    <link>${siteUrl}/blog</link>
    <description>Expert insights, study tips, and updates for your Prometric exam journey.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/functions/v1/rss-feed" rel="self" type="application/rss+xml" />
    ${rssItems}
  </channel>
</rss>`.trim();

  return new Response(rssFeed, { headers: corsHeaders });
});