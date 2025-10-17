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
import ReviewSubmittedMcqDialog from '@/components/ReviewSubmittedMcqDialog';
import { useSession } from '@/components/SessionContextProvider'; // Import useSession

export interface UserSubmittedMcq {
  id: string;
  user_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation_text: string;
  image_url: string | null;
  suggested_category_name: string | null;
  suggested_difficulty: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes: string | null;
  created_at: string;
  user_email?: string; // To be populated from profiles/auth.users
}

const ManageSubmittedMcqsPage = () => {
  const { toast } = useToast();
  const [submittedMcqs, setSubmittedMcqs] = useState<UserSubmittedMcq[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true); // New combined loading state

  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedMcqForReview, setSelectedMcqForReview] = useState<UserSubmittedMcq | null>(null);

  const { hasCheckedInitialSession } = useSession(); // Get hasCheckedInitialSession

  useEffect(() => {
    if (hasCheckedInitialSession) { // Only fetch if initial session check is done
      fetchSubmittedMcqs();
    }
  }, [hasCheckedInitialSession]); // Dependency changed

  const fetchSubmittedMcqs = async () => {
    setIsPageLoading(true); // Set loading for this specific fetch
    const { data, error } = await supabase
      .from('user_submitted_mcqs')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching submitted MCQs:', error);
      toast({ title: "Error", description: "Failed to load submitted MCQs.", variant: "destructive" });
      setSubmittedMcqs([]);
    } else {
      const mcqsWithEmails = await Promise.all(data.map(async (mcq) => {
        const { data: userData } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', mcq.user_id)
          .single();
        
        return {
          ...mcq,
          user_email: userData?.email || 'N/A',
        };
      }));
      setSubmittedMcqs(mcqsWithEmails || []);
    }
    setIsPageLoading(false); // Clear loading for this specific fetch
  };

  const handleReviewClick = (mcq: UserSubmittedMcq) => {
    setSelectedMcqForReview(mcq);
    setIsReviewDialogOpen(true);
  };

  const columns: ColumnDef<UserSubmittedMcq>[] = [
    {
      accessorKey: 'question_text',
      header: 'Question',
      cell: ({ row }) => <div className="w-[200px] truncate">{row.original.question_text}</div>,
    },
    {
      accessorKey: 'user_email',
      header: 'Submitted By',
      cell: ({ row }) => row.original.user_email || 'N/A',
    },
    {
      accessorKey: 'suggested_category_name',
      header: 'Suggested Category',
      cell: ({ row }) => row.original.suggested_category_name || 'N/A',
    },
    {
      accessorKey: 'suggested_difficulty',
      header: 'Suggested Difficulty',
      cell: ({ row }) => row.original.suggested_difficulty || 'N/A',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        let variant: "default" | "secondary" | "destructive" | "outline" = "secondary";
        if (status === 'approved') variant = "default";
        if (status === 'rejected') variant = "destructive";
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
            <DropdownMenuItem onClick={() => handleReviewClick(row.original)}>Review Submission</DropdownMenuItem>
            {/* Future: Direct delete option for admins */}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!hasCheckedInitialSession || isPageLoading) { // Use hasCheckedInitialSession for initial loading
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading submitted MCQs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage Submitted MCQs</h1>

      <Card>
        <CardHeader>
          <CardTitle>User Submissions</CardTitle>
          <CardDescription>Review and process MCQs submitted by users.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={submittedMcqs} />
        </CardContent>
      </Card>

      <MadeWithDyad />

      {selectedMcqForReview && (
        <ReviewSubmittedMcqDialog
          open={isReviewDialogOpen}
          onOpenChange={setIsReviewDialogOpen}
          submittedMcq={selectedMcqForReview}
          onSave={fetchSubmittedMcqs} // Refresh the list after review
        />
      )}
    </div>
  );
};

export default ManageSubmittedMcqsPage;