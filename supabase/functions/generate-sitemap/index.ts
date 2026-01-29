// @ts-ignore
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/xml; charset=utf-8',
};

interface SitemapData {
  slug: string;
  updated_at: string | null;
}

serve(async (_req: Request) => {
  // @ts-ignore
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  // @ts-ignore
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const siteUrl = "https://www.studyprometric.com";
  const now = new Date().toISOString();

  // 1. Fetch data for dynamic URLs
  const [blogsResult, pagesResult] = await Promise.all([
    supabase.from('blogs').select('slug, updated_at').eq('status', 'published'),
    supabase.from('static_pages').select('slug, updated_at')
  ]);

  const blogs = (blogsResult.data as SitemapData[]) || [];
  const staticPages = (pagesResult.data as SitemapData[]) || [];

  // 2. Define static core routes
  const coreRoutes = [
    { path: '/', priority: '1.0', changefreq: 'daily' },
    { path: '/quiz', priority: '0.9', changefreq: 'daily' },
    { path: '/quiz-of-the-day', priority: '0.9', changefreq: 'daily' },
    { path: '/blog', priority: '0.8', changefreq: 'weekly' },
    { path: '/subscription', priority: '0.8', changefreq: 'monthly' },
    { path: '/reviews', priority: '0.7', changefreq: 'weekly' },
    { path: '/contact', priority: '0.5', changefreq: 'monthly' },
    { path: '/faq', priority: '0.6', changefreq: 'monthly' },
  ];

  // 3. Build the XML string
  let xml = '<?xml version="1.0" encoding="UTF-8"?>';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';

  // Add Core Routes
  coreRoutes.forEach(route => {
    xml += `<url><loc>${siteUrl}${route.path}</loc><lastmod>${now}</lastmod><changefreq>${route.changefreq}</changefreq><priority>${route.priority}</priority></url>`;
  });

  // Add Static Pages
  staticPages.forEach((page: SitemapData) => {
    xml += `<url><loc>${siteUrl}/${page.slug}</loc><lastmod>${page.updated_at || now}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>`;
  });

  // Add Blog Posts
  blogs.forEach((blog: SitemapData) => {
    xml += `<url><loc>${siteUrl}/blog/${blog.slug}</loc><lastmod>${blog.updated_at || now}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`;
  });

  xml += '</urlset>';

  return new Response(xml, { headers: corsHeaders });
});