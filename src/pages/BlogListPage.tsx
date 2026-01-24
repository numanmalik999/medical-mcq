"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Link } from 'react-router-dom';
import { Loader2, Calendar, ArrowRight, BookOpen } from 'lucide-react';
import { format } from 'date-fns';

interface Blog {
  id: string;
  title: string;
  slug: string;
  meta_description: string;
  created_at: string;
  image_url: string | null;
}

const BlogListPage = () => {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBlogs = async () => {
      const { data, error } = await supabase
        .from('blogs')
        .select('id, title, slug, meta_description, created_at, image_url')
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (!error) {
        setBlogs(data || []);
      }
      setIsLoading(false);
    };
    fetchBlogs();
  }, []);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pt-24 pb-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold mb-4 text-foreground">Medical Education Blog</h1>
          <p className="text-muted-foreground text-lg">Expert insights, study tips, and updates for your Prometric exam journey.</p>
        </div>

        {blogs.length === 0 ? (
          <Card className="text-center py-20">
            <CardContent>
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-xl font-medium">No articles published yet.</p>
              <p className="text-muted-foreground">Check back soon for new content!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-8">
            {blogs.map((blog) => (
              <Card key={blog.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row">
                  {blog.image_url && (
                    <div className="md:w-1/3 h-48 md:h-auto">
                      <img 
                        src={blog.image_url} 
                        alt={blog.title} 
                        className="w-full h-full object-cover" 
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="flex-1 p-6">
                    <CardHeader className="p-0 mb-4">
                      <div className="flex items-center text-sm text-muted-foreground mb-2 gap-2">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(blog.created_at), 'MMMM dd, yyyy')}
                      </div>
                      <CardTitle className="text-2xl hover:text-primary transition-colors">
                        <Link to={`/blog/\${blog.slug}`}>{blog.title}</Link>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 mb-6">
                      <p className="text-foreground line-clamp-3">{blog.meta_description}</p>
                    </CardContent>
                    <CardFooter className="p-0">
                      <Button asChild variant="link" className="p-0 h-auto font-semibold">
                        <Link to={`/blog/\${blog.slug}`} className="flex items-center gap-2">
                          Read Full Article <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    </CardFooter>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default BlogListPage;