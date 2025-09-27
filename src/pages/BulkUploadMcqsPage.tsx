"use client";

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { showLoading, dismissToast, showError, showSuccess } from '@/utils/toast'; // Corrected import for toast utilities
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2 } from 'lucide-react';

// Define the expected structure of an incoming MCQ object
interface IncomingMcq {
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  image_url?: string;
  category_id?: string;
  subcategory_id?: string;
  difficulty?: string;
  is_trial_mcq?: boolean;
}

const BulkUploadMcqsPage = () => {
  const [jsonData, setJsonData] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async () => {
    if (!jsonData.trim()) {
      showError("Please paste your MCQ JSON data.");
      return;
    }

    setIsUploading(true);
    let mcqsToUpload: IncomingMcq[] = [];

    try {
      mcqsToUpload = JSON.parse(jsonData);
      if (!Array.isArray(mcqsToUpload)) {
        mcqsToUpload = [mcqsToUpload]; // If a single object is pasted, wrap it in an array
      }
    } catch (parseError: any) {
      showError(`Invalid JSON format: ${parseError.message}`);
      setIsUploading(false);
      return;
    }

    if (mcqsToUpload.length === 0) {
      showError("No MCQs found in the provided JSON data.");
      setIsUploading(false);
      return;
    }

    const loadingToastId = showLoading(`Processing ${mcqsToUpload.length} MCQs. This may take a moment.`);

    try {
      const { data, error } = await supabase.functions.invoke('bulk-upload-mcqs', {
        body: { mcqs: mcqsToUpload },
      });

      if (error) {
        throw error;
      }

      dismissToast(loadingToastId);

      if (data.errorCount > 0) {
        showError(`Successfully uploaded ${data.successCount} MCQs. ${data.errorCount} failed. Check console for details.`);
        console.error("Bulk MCQ Upload Errors:", data.errors);
      } else {
        showSuccess(`Successfully uploaded ${data.successCount} MCQs.`);
      }
      setJsonData(''); // Clear textarea on success
    } catch (error: any) {
      dismissToast(loadingToastId);
      console.error("Error invoking bulk-upload-mcqs function:", error);
      showError(`Failed to upload MCQs: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">Bulk Upload MCQs</CardTitle>
          <CardDescription>Paste your MCQs in JSON format to upload them in bulk.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">JSON Format Example:</h3>
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md text-sm overflow-x-auto">
              {`[
  {
    "question": "Your question text here...",
    "options": {
      "A": "Option A text",
      "B": "Option B text",
      "C": "Option C text",
      "D": "Option D text"
    },
    "correct_answer": "A",
    "explanation": "Detailed explanation for the correct answer.",
    "image_url": "https://example.com/image.jpg", // Optional
    "category_id": "uuid-of-category", // Optional
    "subcategory_id": "uuid-of-subcategory", // Optional
    "difficulty": "Easy", // Optional: "Easy", "Medium", "Hard"
    "is_trial_mcq": true // Optional: defaults to false
  },
  // ... more MCQs
]`}
            </pre>
          </div>

          <div className="space-y-2">
            <Textarea
              placeholder="Paste your MCQ JSON array here..."
              rows={15}
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              className="font-mono"
              disabled={isUploading}
            />
          </div>

          <Button onClick={handleUpload} className="w-full" disabled={isUploading}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Upload MCQs"
            )}
          </Button>
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default BulkUploadMcqsPage;