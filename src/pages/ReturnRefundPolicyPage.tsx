"use client";

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
// Removed unused ReactMarkdown import

const defaultContent = `
# Return and Refund Policy

Thank you for subscribing to Study Prometric MCQs. We want to ensure you have a clear understanding of our return and refund policy.

## Subscription Cancellation and Refunds

1.  **Monthly Subscriptions:** Monthly subscriptions can be cancelled at any time. Cancellation will take effect at the end of your current billing cycle. We do not offer refunds for partial months of service.
2.  **Annual Subscriptions:** Annual subscriptions can be cancelled at any time. If cancelled within the first 30 days of purchase, you are eligible for a full refund. After 30 days, we do not offer prorated refunds.
3.  **Free Trial:** If you are on a free trial, you can cancel at any time without charge.

## Contact Us

If you have any questions about our Return and Refund Policy, please contact us at: [support@example.com](mailto:support@example.com)
`;

const ReturnRefundPolicyPage = () => {
  const { toast } = useToast();
  const [pageContent, setPageContent] = useState(defaultContent);
  const [pageTitle, setPageTitle] = useState("Return & Refund Policy");
  const [pageDescription, setPageDescription] = useState("Details regarding subscription cancellation and refunds.");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPageContent = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('static_pages')
        .select('title, content')
        .eq('slug', 'refund')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching Refund Policy page content:', error);
        // Use default content if fetch fails
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
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle className="text-3xl text-center">{pageTitle}</CardTitle>
          <CardDescription className="text-center mt-2">
            {pageDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-base text-gray-700 dark:text-gray-300 prose dark:prose-invert max-w-none">
          <div dangerouslySetInnerHTML={{ __html: pageContent }} />
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default ReturnRefundPolicyPage;