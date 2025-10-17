"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
// Removed unused 'Mail', 'Phone', 'MapPin' imports
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const defaultContent = `
<p>
  Whether you have a question about our features, pricing, need technical assistance, or just want to provide feedback, our team is ready to help.
</p>
<div class="space-y-4">
  <div class="flex items-center gap-4">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mail h-6 w-6 text-primary"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
    <p>Email: <a href="mailto:support@example.com" class="text-blue-600 hover:underline dark:text-blue-400">support@example.com</a></p>
  </div>
  <div class="flex items-center gap-4">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-phone h-6 w-6 text-primary"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.65A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    <p>Phone: <a href="tel:+1234567890" class="text-blue-600 hover:underline dark:text-blue-400">+1 (234) 567-890</a></p>
  </div>
  <div class="flex items-center gap-4">
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin h-6 w-6 text-primary"><path d="M12 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M12 22s8-4 8-10V7c0-2.2-1.8-4-4-4H8c-2.2 0-4 1.8-4 4v5c0 6 8 10 8 10Z"/></svg>
    <p>Address: 123 Medical Prep Lane, Study City, ST 12345</p>
  </div>
</div>
<p>
  We strive to respond to all inquiries within 24-48 business hours.
</p>
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
          <div dangerouslySetInnerHTML={{ __html: pageContent }} />
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default ContactPage;