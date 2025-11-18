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
import ReviewSuggestionDialog, { UserSuggestion } from '@/components/ReviewSuggestionDialog';
import { useSession } from '@/components/SessionContextProvider';

const ManageSuggestionsPage = () => {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<UserSuggestion | null>(null);

  const { hasCheckedInitialSession } = useSession();

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchSuggestions();
    }
  }, [hasCheckedInitialSession]);

  const fetchSuggestions = async () => {
    setIsPageLoading(true);
    const { data, error } = await supabase
      .from('user_suggestions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching suggestions:', error);
      toast({ title: "Error", description: "Failed to load suggestions.", variant: "destructive" });
      setSuggestions([]);
    } else {
      const suggestionsWithDetails = await Promise.all(data.map(async (suggestion) => {
        let userEmail = 'N/A';
        if (suggestion.user_id) {
          const { data: emailData, error: emailError } = await supabase.functions.invoke('get-user-email-by-id', {
            body: { user_id: suggestion.user_id },
          });
          if (emailError) {
            console.error(`Error fetching email for user ${suggestion.user_id}:`, emailError);
          } else if (emailData?.email) {
            userEmail = emailData.email;
          }
        }
        return { ...suggestion, user_email: userEmail };
      }));
      setSuggestions(suggestionsWithDetails);
    }
    setIsPageLoading(false);
  };

  const handleReviewClick = (suggestion: UserSuggestion) => {
    setSelectedSuggestion(suggestion);
    setIsReviewDialogOpen(true);
  };

  const columns: ColumnDef<UserSuggestion>[] = [
    {
      accessorKey: 'suggestion_text',
      header: 'Suggestion',
      cell: ({ row }) => <div className="w-[300px] truncate">{row.original.suggestion_text}</div>,
    },
    {
      accessorKey: 'user_email',
      header: 'Submitted By',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.original.status;
        let variant: "default" | "secondary" | "destructive" | "outline" = "outline";
        if (status === 'reviewed') variant = "secondary";
        if (status === 'implemented') variant = "default";
        if (status === 'rejected') variant = "destructive";
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
            <DropdownMenuItem onClick={() => handleReviewClick(row.original)}>Review / Update Status</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading suggestions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage User Suggestions</h1>
      <Card>
        <CardHeader>
          <CardTitle>All Suggestions</CardTitle>
          <CardDescription>Review and manage feedback and suggestions submitted by users.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={suggestions} />
        </CardContent>
      </Card>
      <MadeWithDyad />
      {selectedSuggestion && (
        <ReviewSuggestionDialog
          open={isReviewDialogOpen}
          onOpenChange={setIsReviewDialogOpen}
          suggestion={selectedSuggestion}
          onSave={fetchSuggestions}
        />
      )}
    </div>
  );
};

export default ManageSuggestionsPage;