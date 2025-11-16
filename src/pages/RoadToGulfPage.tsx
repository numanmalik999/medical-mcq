"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ReactMarkdown from 'react-markdown';

const defaultContent = `
# Your Road to Practicing in the Gulf

Navigating the requirements for medical practice in the Gulf countries can be complex. This guide provides a clear overview of the DataFlow verification process and the specific licensing exams for each major Gulf country.

---

## 1. Primary Source Verification (PSV) by DataFlow Group

Primary Source Verification (PSV) is a mandatory process for all healthcare professionals seeking to practice in the Gulf region. The DataFlow Group is the designated body that verifies your credentials directly from the issuing source (e.g., your university, previous employers).

**What is verified?**
- **Educational Qualifications:** Degrees, Diplomas.
- **Work Experience:** Certificates of employment.
- **Professional Licenses:** Your home country's medical license.
- **Good Standing Certificate:** A certificate from your home medical council.

**The Process:**
1.  **Create an Account:** Register on the DataFlow portal for the specific country's health authority.
2.  **Submit Documents:** Upload clear scans of all required documents.
3.  **Payment:** Pay the verification fees online.
4.  **Verification:** DataFlow contacts the issuing authorities to verify your documents. This can take several weeks to months.
5.  **Report:** Once completed, a PSV report is generated and sent to you and the relevant health authority.

**Tip:** Start your DataFlow application as early as possible, as it is often the most time-consuming part of the licensing process.

---

## 2. Country-Specific Licensing Exams

After or during your PSV, you must pass the country-specific licensing exam.
`;

const RoadToGulfPage = () => {
  const { toast } = useToast();
  const [pageContent, setPageContent] = useState(defaultContent);
  const [pageTitle, setPageTitle] = useState("Road to Gulf");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPageContent = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('static_pages')
        .select('title, content')
        .eq('slug', 'road-to-gulf')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching Road to Gulf page content:', error);
        toast({ title: "Error", description: "Failed to load page content.", variant: "destructive" });
      } else if (data) {
        setPageTitle(data.title);
        setPageContent(data.content || defaultContent);
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
      <Card className="w-full max-w-6xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">{pageTitle}</CardTitle>
          <CardDescription className="text-center mt-2">
            A guide to DataFlow verification and licensing exams for Gulf countries.
          </CardDescription>
        </CardHeader>
        <CardContent className="prose dark:prose-invert max-w-none prose-headings:text-foreground prose-p:text-foreground prose-li:text-foreground prose-strong:text-foreground prose-a:text-primary hover:prose-a:underline">
          <ReactMarkdown>{pageContent}</ReactMarkdown>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default RoadToGulfPage;