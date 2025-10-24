"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown'; // Import ReactMarkdown

const defaultContent = `
# About Study Prometric MCQs

At Study Prometric MCQs, we are passionate about empowering medical students and professionals to achieve their academic and career goals. We understand the challenges of preparing for rigorous medical exams, and our platform is designed to simplify and enhance your study process.

Our mission is to provide a comprehensive, interactive, and intelligent learning environment. We leverage cutting-edge technology, including AI-powered explanations, to offer a personalized and effective study experience. Our extensive question bank, curated by experts, ensures you have access to high-quality, relevant content.

We believe in continuous improvement and community contribution. That's why we enable users to submit their own MCQs and provide feedback, helping us grow and refine our resources for everyone. Join us on your journey to medical excellence!
`;

const AboutUsPage = () => {
  const { toast } = useToast();
  const [pageContent, setPageContent] = useState(defaultContent);
  const [pageTitle, setPageTitle] = useState("About Study Prometric MCQs");
  const [pageDescription, setPageDescription] = useState("Your dedicated partner in medical education.");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPageContent = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('static_pages')
        .select('title, content')
        .eq('slug', 'about')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        console.error('Error fetching About Us page content:', error);
        toast({ title: "Error", description: "Failed to load About Us content.", variant: "destructive" });
      } else if (data) {
        setPageTitle(data.title);
        setPageContent(data.content || defaultContent);
        setPageDescription("Your dedicated partner in medical education."); // Description is static for now
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

export default AboutUsPage;