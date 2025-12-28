"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { showLoading, dismissToast, showError, showSuccess } from '@/utils/toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2, Upload, Download } from 'lucide-react';
import { Input } from '@/components/ui/input';
import * as XLSX from 'xlsx';
import { Separator } from '@/components/ui/separator';
import { useSession } from '@/components/SessionContextProvider';

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
  difficulty?: string;
  is_trial_mcq?: boolean;
}

const BulkUploadMcqsPage = () => {
  const [jsonData, setJsonData] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const { hasCheckedInitialSession } = useSession();

  useEffect(() => {
    if (hasCheckedInitialSession) {
      setIsPageLoading(false);
    }
  }, [hasCheckedInitialSession]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      setJsonData('');
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

          if (json.length === 0) {
            throw new Error("The spreadsheet is empty or contains no data rows.");
          }

          const mcqs: IncomingMcq[] = json.map((row, index) => {
            const rowIndex = index + 2;

            const question = row['Question'];
            const option_a = row['Option A'];
            const option_b = row['Option B'];
            const option_c = row['Option C'];
            const option_d = row['Option D'];
            const correct_answer_raw = row['Correct Answer'];
            const explanation = row['Explanation'];

            if (!question) throw new Error(`Row ${rowIndex}: 'Question' is missing.`);
            if (!option_a) throw new Error(`Row ${rowIndex}: 'Option A' is missing.`);
            if (!option_b) throw new Error(`Row ${rowIndex}: 'Option B' is missing.`);
            if (!option_c) throw new Error(`Row ${rowIndex}: 'Option C' is missing.`);
            if (!option_d) throw new Error(`Row ${rowIndex}: 'Option D' is missing.`);
            if (!correct_answer_raw) throw new Error(`Row ${rowIndex}: 'Correct Answer' is missing.`);
            
            const correct_answer = String(correct_answer_raw).toUpperCase();
            if (!['A', 'B', 'C', 'D'].includes(correct_answer)) {
              throw new Error(`Row ${rowIndex}: 'Correct Answer' must be A, B, C, or D. Found: "${correct_answer_raw}".`);
            }

            let isTrialMcq: boolean | undefined = undefined;
            const rawIsTrialMcq = row['Is Trial MCQ'];
            if (typeof rawIsTrialMcq === 'boolean') {
              isTrialMcq = rawIsTrialMcq;
            } else if (typeof rawIsTrialMcq === 'string') {
              const upperCaseValue = rawIsTrialMcq.toUpperCase();
              if (upperCaseValue === 'TRUE') {
                isTrialMcq = true;
              } else if (upperCaseValue === 'FALSE') {
                isTrialMcq = false;
              }
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
              explanation: explanation ? String(explanation) : 'No explanation provided.',
              image_url: row['Image URL'] ? String(row['Image URL']) : undefined,
              category_name: row['Category Name'] ? String(row['Category Name']) : undefined,
              difficulty: row['Difficulty'] ? String(row['Difficulty']) : undefined,
              is_trial_mcq: isTrialMcq,
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
        loadingToastId = showLoading(`Uploading ${mcqsToUpload.length} MCQs. This may take a moment.`);
      } else if (jsonData.trim()) {
        loadingToastId = showLoading(`Processing JSON data...`);
        const parsedJson = JSON.parse(jsonData);
        mcqsToUpload = Array.isArray(parsedJson) ? parsedJson : [parsedJson];
        dismissToast(loadingToastId);
        loadingToastId = showLoading(`Uploading ${mcqsToUpload.length} MCQs. This may take a moment.`);
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

      if (error) throw error;

      if (loadingToastId) dismissToast(loadingToastId);

      if (data.errorCount > 0) {
        showError(`Uploaded ${data.successCount} MCQs. ${data.errorCount} failed. Check console for details.`);
        console.error("Bulk MCQ Upload Errors:", data.errors);
      } else {
        showSuccess(`Successfully uploaded ${data.successCount} MCQs.`);
      }
      setJsonData('');
      setSelectedFile(null);
    } catch (error: any) {
      if (loadingToastId) dismissToast(loadingToastId);
      console.error("Error invoking bulk-upload-mcqs function:", error);
      showError(`Failed to upload MCQs: ${error.message || 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading bulk upload page...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="text-2xl">Bulk Upload MCQs</CardTitle>
          <CardDescription>Upload multiple choice questions using either a JSON array or a spreadsheet file.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Upload className="h-5 w-5" /> Upload from Spreadsheet (.xlsx, .csv)
            </h3>
            <div className="text-sm text-muted-foreground bg-muted p-4 rounded-md border">
              <p className="font-medium mb-1">Spreadsheet Formatting:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Required Headers: `Question`, `Option A`, `Option B`, `Option C`, `Option D`, `Correct Answer`.</li>
                <li><strong>Multiple Categories:</strong> You can link an MCQ to multiple categories by separating them with commas in the `Category Name` column (e.g., <code className="bg-gray-200 px-1 rounded">Anatomy, Cardiology, Surgery</code>).</li>
                <li>Optional columns: `Explanation`, `Image URL`, `Difficulty` (Easy, Medium, Hard), `Is Trial MCQ` (TRUE or FALSE).</li>
              </ul>
            </div>
            <a href="/example_mcqs.xlsx" download="example_mcqs.xlsx" className="inline-flex items-center text-primary hover:underline text-sm">
              <Download className="h-4 w-4 mr-1" /> Download Example Spreadsheet
            </a>
            <Input
              id="spreadsheet-upload"
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              disabled={isUploading}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground font-medium">Selected file: {selectedFile.name}</p>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Or, Paste JSON Data:</h3>
            <Textarea
              placeholder='[ { "question": "...", "category_name": "Cat1, Cat2", ... } ]'
              rows={10}
              value={jsonData}
              onChange={(e) => setJsonData(e.target.value)}
              className="font-mono"
              disabled={isUploading || !!selectedFile}
            />
          </div>

          <Button onClick={handleUpload} className="w-full" disabled={isUploading || (!jsonData.trim() && !selectedFile)}>
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading Questions...
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