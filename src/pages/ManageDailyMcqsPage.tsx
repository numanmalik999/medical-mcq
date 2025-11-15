"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Eye } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import EditDailyMcqDialog from '@/components/EditDailyMcqDialog';
import DailyMcqSubmissionsDialog from '@/components/DailyMcqSubmissionsDialog';
import { useSession } from '@/components/SessionContextProvider';
import { format } from 'date-fns';

interface DailyMcqEntry {
  id: string;
  date: string; // YYYY-MM-DD
  mcq_id: string;
  mcq_question_text: string; // From joined mcqs table
  created_at: string;
}

const ManageDailyMcqsPage = () => {
  const { toast } = useToast();
  const [dailyMcqs, setDailyMcqs] = useState<DailyMcqEntry[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedDailyMcqForEdit, setSelectedDailyMcqForEdit] = useState<DailyMcqEntry | null>(null);

  // New state for submissions dialog
  const [isSubmissionsDialogOpen, setIsSubmissionsDialogOpen] = useState(false);
  const [selectedDailyMcqForSubmissions, setSelectedDailyMcqForSubmissions] = useState<DailyMcqEntry | null>(null);

  const { hasCheckedInitialSession } = useSession();

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchDailyMcqs();
    }
  }, [hasCheckedInitialSession]);

  const fetchDailyMcqs = async () => {
    setIsPageLoading(true);
    const { data, error } = await supabase
      .from('daily_mcqs')
      .select(`
        id,
        date,
        mcq_id,
        created_at,
        mcqs (question_text)
      `)
      .order('date', { ascending: false });

    if (error) {
      console.error('Error fetching daily MCQs:', error);
      toast({ title: "Error", description: "Failed to load daily MCQs.", variant: "destructive" });
      setDailyMcqs([]);
    } else {
      const formattedData: DailyMcqEntry[] = data.map((entry: any) => ({
        id: entry.id,
        date: entry.date,
        mcq_id: entry.mcq_id,
        mcq_question_text: entry.mcqs?.question_text || 'N/A',
        created_at: entry.created_at,
      }));
      setDailyMcqs(formattedData || []);
    }
    setIsPageLoading(false);
  };

  const handleDeleteDailyMcq = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this Daily MCQ entry? This will remove the assigned question for that day.")) {
      return;
    }
    try {
      const { error } = await supabase
        .from('daily_mcqs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Daily MCQ entry deleted successfully." });
      fetchDailyMcqs();
    } catch (error: any) {
      console.error("Error deleting daily MCQ entry:", error);
      toast({ title: "Error", description: `Failed to delete entry: ${error.message}`, variant: "destructive" });
    }
  };

  const openEditDialog = (entry?: DailyMcqEntry) => {
    setSelectedDailyMcqForEdit(entry || null);
    setIsEditDialogOpen(true);
  };

  // New function to open submissions dialog
  const openSubmissionsDialog = (entry: DailyMcqEntry) => {
    setSelectedDailyMcqForSubmissions(entry);
    setIsSubmissionsDialogOpen(true);
  };

  const columns: ColumnDef<DailyMcqEntry>[] = [
    {
      accessorKey: 'date',
      header: 'Date',
      cell: ({ row }) => format(new Date(row.original.date), 'PPP'),
    },
    {
      accessorKey: 'mcq_question_text',
      header: 'Question',
      cell: ({ row }) => <div className="w-[300px] truncate">{row.original.mcq_question_text}</div>,
    },
    {
      accessorKey: 'created_at',
      header: 'Assigned On',
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
            <DropdownMenuItem onClick={() => openSubmissionsDialog(row.original)}>
              <Eye className="mr-2 h-4 w-4" /> View Submissions
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openEditDialog(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteDailyMcq(row.original.id)} className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading daily MCQs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage Daily MCQs</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">Question of the Day Entries</CardTitle>
          <Button onClick={() => openEditDialog()}>Add New Daily MCQ</Button>
        </CardHeader>
        <CardDescription>Manually assign or review the Question of the Day for specific dates.</CardDescription>
        <CardContent>
          <DataTable columns={columns} data={dailyMcqs} />
        </CardContent>
      </Card>

      <MadeWithDyad />

      <EditDailyMcqDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        dailyMcqEntry={selectedDailyMcqForEdit}
        onSave={fetchDailyMcqs}
      />

      {/* Render the new submissions dialog */}
      <DailyMcqSubmissionsDialog
        open={isSubmissionsDialogOpen}
        onOpenChange={setIsSubmissionsDialogOpen}
        dailyMcqEntry={selectedDailyMcqForSubmissions}
      />
    </div>
  );
};

export default ManageDailyMcqsPage;