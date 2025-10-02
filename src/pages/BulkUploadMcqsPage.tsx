"use client";

import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { showLoading, dismissToast, showError, showSuccess } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2, Upload } from 'lucide-react';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx'; // Import xlsx library
import { Separator } from '@/components/ui/separator'; // Import Separator

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
  category_name?: string;
  subcategory_name?: string;
  difficulty?: string;
  is_trial_mcq?: boolean;
}

const BulkUploadMcqsPage = () => {
  const [jsonData, setJsonData] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    } else {
      setSelectedFile(null);
    }
  };

  const parseSpreadsheet = (file: File): Promise<IncomingMcq[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(worksheet);

          const mcqs: IncomingMcq[] = json.map((row) => {
            // Basic validation and mapping
            const question = row['Question'];
            const option_a = row['Option A'];
            const option_b = row['Option B'];
            const option_c = row['Option C'];
            const option_d = row['Option D'];
            const correct_answer = row['Correct Answer']?.toUpperCase();
            const explanation = row['Explanation'];

            if (!question || !option_a || !option_b || !option_c || !option_d || !correct_answer || !explanation) {
              throw new Error(`Missing required fields in row: ${JSON.stringify(row)}`);
            }

            if (!['A', 'B', 'C', 'D'].includes(correct_answer)) {
              throw new Error(`Invalid correct answer in row: ${JSON.stringify(row)}. Must be A, B, C, or D.`);
            }

            return {
              question: String(question),
              options: {
                A: String(option_a),
                B: String(option_b),
                C: String(option_c),
                D: String(option_d),
              },
              correct_answer: correct_answer as 'A' | 'B' | 'C' | 'D',
              explanation: String(explanation),
              image_url: row['Image URL'] ? String(row['Image URL']) : undefined,
              category_name: row['Category Name'] ? String(row['Category Name']) : undefined,
              subcategory_name: row['Subcategory Name'] ? String(row['Subcategory Name']) : undefined,
              difficulty: row['Difficulty'] ? String(row['Difficulty']) : undefined,
              is_trial_mcq: typeof row['Is Trial MCQ'] === 'string' ? row['Is Trial MCQ'].toUpperCase() === 'TRUE' : undefined,
            };
          });
          resolve(mcqs);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsBinaryString(file);
    });
  };

  const handleUpload = async () => {
    setIsUploading(true);
    let mcqsToUpload: IncomingMcq[] = [];
    let loadingToastId: string | number | undefined;

    try {
      if (selectedFile) {
        loadingToastId = showLoading(`Parsing spreadsheet "${selectedFile.name}"...`);
        mcqsToUpload = await parseSpreadsheet(selectedFile);
        dismissToast(loadingToastId);
        loadingToastId = showLoading(`Uploading ${mcqsToUpload.length} MCQs from spreadsheet. This may take a moment.`);
      } else if (jsonData.trim()) {
        loadingToastId = showLoading(`Processing JSON data...`);
        mcqsToUpload = JSON.parse(jsonData);
        if (!Array.isArray(mcqsToUpload)) {
          mcqsToUpload = [mcqsToUpload];
        }
        dismissToast(loadingToastId);
        loadingToastId = showLoading(`Uploading ${mcqsToUpload.length} MCQs from JSON. This may take a moment.`);
      } else {
        showError("Please provide either a spreadsheet file or JSON data.");
        setIsUploading(false);
        return;
      }
    } catch (parseError: any) {
      if (loadingToastId) dismissToast(loadingToastId);
      showError(`Error parsing data: ${parseError.message}`);
      setIsUploading(false);
      return;
    }

    if (mcqsToUpload.length === 0) {
      if (loadingToastId) dismissToast(loadingToastId);
      showError("No MCQs found in the provided data.");
      setIsUploading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('bulk-upload-mcqs', {
        body: { mcqs: mcqsToUpload },
      });

      if (error) {
        throw error;
      }

      if (loadingToastId) dismissToast(loadingToastId);

      if (data.errorCount > 0) {
        showError(`Successfully uploaded ${data.successCount} MCQs. ${data.errorCount} failed. Check console for details.`);
        console.error("Bulk MCQ Upload Errors:", data.errors);
      } else {
        showSuccess(`Successfully uploaded ${data.successCount} MCQs.`);
      }
      setJsonData(''); // Clear textarea on success
      setSelectedFile(null); // Clear selected file
    } catch (error: any) {
      if (loadingToastId) dismissToast(loadingToastId);
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
          <CardDescription>Upload multiple choice questions using either a JSON array or a spreadsheet file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Spreadsheet Upload Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Upload className="h-5 w-5" /> Upload from Spreadsheet (.xlsx, .csv)
            </h3>
            <p className="text-sm text-muted-foreground">
              Your spreadsheet should have the following column headers: `Question`, `Option A`, `Option B`, `Option C`, `Option D`, `Correct Answer` (A, B, C, or D), `Explanation`. Optional columns: `Image URL`, `Category Name`, `Subcategory Name`, `Difficulty` (Easy, Medium, Hard), `Is Trial MCQ` (TRUE or FALSE).
            </p>
            <Input
              id="spreadsheet-upload"
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">Selected file: {selectedFile.name}</p>
            )}
          </div>

          <Separator />

          {/* JSON Upload Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Or, Paste JSON Data:</h3>
            <div className="space-y-2">
              <h4 className="text-md font-medium">JSON Format Example:</h4>
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
    "category_name": "Biology", // Optional
    "subcategory_name": "Cell Biology", // Optional
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
                disabled={isUploading || !!selectedFile} // Disable if file is selected
              />
            </div>
          </div>

          <Button onClick={handleUpload} className="w-full" disabled={isUploading || (!jsonData.trim() && !selectedFile)}>
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