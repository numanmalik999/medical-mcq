"use client";

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Calendar, Tag, Facebook, Twitter, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Blog {
  title: string;
  content: string;
  created_at: string;
  image_url: string | null;
  keywords: string[] | null;
  meta_description: string | null;
}

const BlogDetailsPage = () => {
  const { slug } = useParams();
  const { toast } = useToast();
  const [blog, setBlog] = useState<Blog | null>(null);
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
      <article className="container mx-auto px-4 max-w-4xl">
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

        <div className="mt-16 p-8 bg-muted rounded-2xl text-center border border-border">
          <h3 className="text-2xl font-bold mb-4">Ready to test your knowledge?</h3>
          <p className="mb-6 text-muted-foreground">Join thousands of medical professionals preparing for their licensing exams with our AI-enhanced question bank.</p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button asChild size="lg"><Link to="/signup">Start Free Trial</Link></Button>
            <Button asChild variant="outline" size="lg"><Link to="/quiz">Try a Quiz</Link></Button>
          </div>
        </div>
      </article>
      <MadeWithDyad />
    </div>
  );
};

export default BlogDetailsPage;