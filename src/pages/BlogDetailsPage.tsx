"use client";

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Calendar, Tag, Facebook, Twitter, Link as LinkIcon, User, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';

interface Blog {
  id: string;
  title: string;
  content: string;
  created_at: string;
  image_url: string | null;
  keywords: string[] | null;
  meta_description: string | null;
}

interface RelatedBlog {
  title: string;
  slug: string;
  created_at: string;
}

const BlogDetailsPage = () => {
  const { slug } = useParams();
  const { toast } = useToast();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [relatedBlogs, setRelatedBlogs] = useState<RelatedBlog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  useEffect(() => {
    const fetchBlog = async () => {
      const { data, error } = await supabase
        .from('blogs')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .single();

      if (!error && data) {
        setBlog(data);
        document.title = data.title;
        
        // Fetch related blogs
        const { data: related } = await supabase
          .from('blogs')
          .select('title, slug, created_at')
          .eq('status', 'published')
          .neq('slug', slug)
          .limit(5);
        if (related) setRelatedBlogs(related);
      }
      setIsLoading(false);
    };
    fetchBlog();
  }, [slug]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    toast({ title: "Link Copied!", description: "The article link has been copied to your clipboard." });
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  if (!blog) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
        <Button asChild><Link to="/blog">Back to Blog</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
          
          {/* Main Content */}
          <article className="lg:col-span-3">
            <Button asChild variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-primary">
              <Link to="/blog" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Articles
              </Link>
            </Button>

            <header className="mb-10">
              <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6 text-foreground">{blog.title}</h1>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-y border-border py-6 mb-8">
                <div className="flex flex-wrap items-center gap-6 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(blog.created_at), 'MMMM dd, yyyy')}
                  </div>
                  {blog.keywords && blog.keywords.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag className="h-4 w-4" />
                      {blog.keywords.map((kw, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px] uppercase tracking-wider">{kw}</Badge>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="rounded-full" onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`, '_blank')}>
                    <Facebook className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="rounded-full" onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl)}`, '_blank')}>
                    <Twitter className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="outline" className="rounded-full" onClick={handleCopyLink}>
                    <LinkIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </header>

            {blog.image_url && (
              <div className="mb-10 rounded-xl overflow-hidden shadow-lg border border-border">
                <img src={blog.image_url} alt={blog.title} className="w-full h-auto object-cover max-h-[500px]" />
              </div>
            )}

            <div className="prose dark:prose-invert max-w-none prose-lg">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {blog.content}
              </ReactMarkdown>
            </div>

            {/* Author Section */}
            <section className="mt-12 p-8 bg-muted/50 rounded-2xl border border-border flex flex-col sm:flex-row gap-6 items-center sm:items-start text-center sm:text-left">
              <Avatar className="h-20 w-20">
                <AvatarFallback className="bg-primary text-primary-foreground"><User className="h-10 w-10" /></AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">Study Prometric Clinical Board</h3>
                <p className="text-muted-foreground">This article was curated and reviewed by our clinical board to ensure adherence to current international medical guidelines and exam blueprints.</p>
                <Link to="/about" className="text-primary font-semibold inline-flex items-center gap-1 hover:underline">
                  Learn about our review process <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </section>

            <section className="mt-16 p-8 bg-primary/5 rounded-2xl text-center border border-primary/20">
              <h3 className="text-2xl font-bold mb-4">Ready to test your knowledge?</h3>
              <p className="mb-6 text-muted-foreground max-w-xl mx-auto">Join thousands of medical professionals preparing for their licensing exams with our AI-enhanced question bank.</p>
              <div className="flex justify-center gap-4 flex-wrap">
                <Button asChild size="lg"><Link to="/signup">Start Free Trial</Link></Button>
                <Button asChild variant="outline" size="lg"><Link to="/quiz">Try a Quiz</Link></Button>
              </div>
            </section>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-1 space-y-8">
             <section className="space-y-4">
                <h4 className="font-bold text-lg border-b pb-2">Recent Guides</h4>
                <div className="space-y-6">
                  {relatedBlogs.map((item) => (
                    <div key={item.slug} className="group">
                      <p className="text-xs text-muted-foreground mb-1">{format(new Date(item.created_at), 'MMM dd, yyyy')}</p>
                      <Link to={`/blog/${item.slug}`} className="font-semibold text-sm group-hover:text-primary transition-colors line-clamp-2">
                        {item.title}
                      </Link>
                    </div>
                  ))}
                </div>
             </section>

             <Card className="bg-primary text-primary-foreground">
                <CardHeader>
                  <CardTitle className="text-lg">Need Help?</CardTitle>
                  <CardDescription className="text-primary-foreground/80">Connect with our support team on WhatsApp.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full font-bold" asChild>
                    <a href="https://wa.me/923174636479" target="_blank" rel="noopener noreferrer">Message Us</a>
                  </Button>
                </CardContent>
             </Card>
          </aside>

        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default BlogDetailsPage;