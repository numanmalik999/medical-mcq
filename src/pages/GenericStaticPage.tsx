"use client";

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';
import { Loader2 } from 'lucide-react';

const GenericStaticPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [pageContent, setPageContent] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPageContent = async () => {
      if (!slug) {
        setError("No page specified.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const { data, error: dbError } = await supabase
        .from('static_pages')
        .select('title, content')
        .eq('slug', slug)
        .single();

      if (dbError || !data) {
        console.error(`Error fetching static page for slug "${slug}":`, dbError);
        setError(`The page you're looking for at "/${slug}" could not be found.`);
        if (dbError && dbError.code !== 'PGRST116') { // PGRST116 means no rows found, which is a valid "not found" case
          toast({ title: "Error", description: "Failed to load page content.", variant: "destructive" });
        }
      } else {
        setPageTitle(data.title);
        setPageContent(data.content);
      }
      setIsLoading(false);
    };

    fetchPageContent();
  }, [slug, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16 pb-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-gray-700 dark:text-gray-300 ml-3">Loading page...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16 pb-12">
        <Card className="w-full max-w-2xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Page Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Link to="/">
              <Button>Return to Home</Button>
            </Link>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16 pb-12">
      <Card className="w-full max-w-6xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">{pageTitle}</CardTitle>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:underline">
          <ReactMarkdown>{pageContent || ""}</ReactMarkdown>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default GenericStaticPage;