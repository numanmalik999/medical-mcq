"use client";

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { BookOpen, GraduationCap, Info, FileText } from 'lucide-react';

interface SitemapItem {
  title: string;
  path: string;
}

const SitemapPage = () => {
  const [categories, setCategories] = useState<SitemapItem[]>([]);
  const [blogs, setBlogs] = useState<SitemapItem[]>([]);
  const [staticPages, setStaticPages] = useState<SitemapItem[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      // 1. Fetch Categories
      const { data: cats } = await supabase.from('categories').select('id, name');
      if (cats) setCategories(cats.map(c => ({ title: c.name, path: `/quiz` }))); 

      // 2. Fetch Published Blogs
      const { data: b } = await supabase.from('blogs').select('title, slug').eq('status', 'published');
      if (b) setBlogs(b.map(item => ({ title: item.title, path: `/blog/${item.slug}` })));

      // 3. Fetch Static Pages
      const { data: sp } = await supabase.from('static_pages').select('title, slug');
      if (sp) setStaticPages(sp.map(item => ({ title: item.title, path: `/${item.slug}` })));
    };

    fetchData();
  }, []);

  const mainLinks = [
    { title: "Home", path: "/" },
    { title: "Quiz Dashboard", path: "/quiz" },
    { title: "Question of the Day", path: "/quiz-of-the-day" },
    { title: "Subscription Plans", path: "/subscription" },
    { title: "Reviews", path: "/reviews" },
    { title: "Contact Us", path: "/contact" },
    { title: "About Us", path: "/about" },
    { title: "FAQ", path: "/faq" },
  ];

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold mb-4">HTML Sitemap</h1>
          <p className="text-muted-foreground text-lg">A comprehensive overview of all content available on Study Prometric.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <CardTitle>Main Pages</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {mainLinks.map((link, i) => (
                  <li key={i}><Link to={link.path} className="hover:text-primary transition-colors">{link.title}</Link></li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <CardTitle>Specialty Topics</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {categories.map((link, i) => (
                  <li key={i}><Link to={link.path} className="hover:text-primary transition-colors">{link.title}</Link></li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <CardTitle>Medical Blog</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {blogs.map((link, i) => (
                  <li key={i}><Link to={link.path} className="hover:text-primary transition-colors line-clamp-1">{link.title}</Link></li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Legal & Information</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {staticPages.map((link, i) => (
                  <li key={i}><Link to={link.path} className="hover:text-primary transition-colors">{link.title}</Link></li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default SitemapPage;