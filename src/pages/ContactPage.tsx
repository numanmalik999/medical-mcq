"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown

const defaultContent = `
# Contact Us

Whether you have a question about our features, pricing, need technical assistance, or just want to provide feedback, our team is ready to help.

## Get in Touch

*   **Email:** [support@example.com](mailto:support@example.com)
*   **Phone:** [+1 (234) 567-890](tel:+1234567890)
*   **Address:** 123 Medical Prep Lane, Study City, ST 12345

We strive to respond to all inquiries within 24-48 business hours.
`;

const ContactPage = () => {
  const { toast } = useToast();
  const [pageContent, setPageContent] = useState(defaultContent);
  const [pageTitle, setPageTitle] = useState("Contact Us");
  const [pageDescription, setPageDescription] = useState("We'd love to hear from you! Reach out with any questions or feedback.");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPageContent = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('static_pages')
        .select('title, content')
        .eq('slug', 'contact')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error fetching Contact Us page content:', error);
        toast({ title: "Error", description: "Failed to load Contact Us content.", variant: "destructive" });
      } else if (data) {
        setPageTitle(data.title);
        setPageContent(data.content || defaultContent);
        setPageDescription("We'd love to hear from you! Reach out with any questions or feedback."); // Description is static for now
      }
      setIsLoading(false);
    };

    fetchPageContent();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16 pb-12">
        <p className="text-gray-700 dark:text-gray-300">Loading content...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16 pb-12">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">{pageTitle}</CardTitle>
          <CardDescription className="text-center mt-2">
            {pageDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-lg text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none">
          <ReactMarkdown>{pageContent}</ReactMarkdown>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default ContactPage;