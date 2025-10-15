"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import ReviewFeedbackDialog from '@/components/ReviewFeedbackDialog';
import { useSession } from '@/components/SessionContextProvider'; // Import useSession

export interface McqFeedback {
  id: string;
  user_id: string;
  mcq_id: string;
  feedback_text: string;
  status: 'pending' | 'reviewed';
  created_at: string;
  user_email?: string;
  mcq_question_text?: string;
}

const ManageMcqFeedbackPage = () => {
  const { toast } = useToast();
  const [feedbackItems, setFeedbackItems] = useState<McqFeedback[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true); // New combined loading state

  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedFeedbackForReview, setSelectedFeedbackForReview] = useState<McqFeedback | null>(null);

  const { hasCheckedInitialSession } = useSession(); // Get hasCheckedInitialSession

  useEffect(() => {
    if (hasCheckedInitialSession) { // Only fetch if initial session check is done
      fetchFeedbackItems();
    }
  }, [hasCheckedInitialSession]); // Dependency changed

  const fetchFeedbackItems = async () => {
    setIsPageLoading(true); // Set loading for this specific fetch
    const { data, error } = await supabase
      .from('mcq_feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching MCQ feedback:', error);
      toast({ title: "Error", description: "Failed to load MCQ feedback.", variant: "destructive" });
      setFeedbackItems([]);
    } else {
      const feedbackWithDetails = await Promise.all(data.map(async (feedback) => {
        // Fetch user email
        const { data: userData } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', feedback.user_id)
          .single();
        
        // Fetch MCQ question text
        const { data: mcqData } = await supabase
          .from('mcqs')
          .select('question_text')
          .eq('id', feedback.mcq_id)
          .single();

        return {
          ...feedback,
          user_email: userData?.email || 'N/A',
          mcq_question_text: mcqData?.question_text || 'N/A',
        };
      }));
      setFeedbackItems(feedbackWithDetails || []);
    }
    setIsPageLoading(false); // Clear loading for this specific fetch
  };

  const handleReviewClick = (feedback: McqFeedback) => {
    setSelectedFeedbackForReview(feedback);
    setIsReviewDialogOpen(true);
  };

  const columns: ColumnDef<McqFeedback>[] = [
    {
      accessorKey: 'mcq_question_text',
      header: 'Question',
      cell: ({ row }) => <div className="w-[200px] truncate">{row.original.mcq_question_text}</div>,
    },
    {
      accessorKey: 'user_email',
      header: 'Submitted By',
      cell: ({ row }) => row.original.user_email || 'N/A',
    },
    {
      accessorKey: 'feedback_text',
      header: 'Feedback',
      cell: ({ row }) => <div className="w-[250px] truncate">{row.original.feedback_text}</div>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
        if (status === 'reviewed') variant = "default";
        if (status === 'pending') variant = "outline";
        return <Badge variant={variant}>{status}</Badge>;
      },
    },
    {
      accessorKey: 'created_at',
      header: 'Submitted On',
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleReviewClick(row.original)}>View Feedback</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!hasCheckedInitialSession || isPageLoading) { // Use hasCheckedInitialSession for initial loading
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading MCQ feedback...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage MCQ Feedback</h1>

      <Card>
        <CardHeader>
          <CardTitle>User Feedback</CardTitle>
          <CardDescription>Review notes and feedback submitted by users on MCQs.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={feedbackItems} />
        </CardContent>
      </Card>

      <MadeWithDyad />

      {selectedFeedbackForReview && (
        <ReviewFeedbackDialog
          open={isReviewDialogOpen}
          onOpenChange={setIsReviewDialogOpen}
          feedback={selectedFeedbackForReview}
          onSave={fetchFeedbackItems} // Refresh the list after review
        />
      )}
    </div>
  );
};

export default ManageMcqFeedbackPage;