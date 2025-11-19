"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { createMcqColumns, MCQ } from '@/components/mcq-columns';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import EditMcqDialog from '@/components/EditMcqDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Wand2, Loader2 } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { RowSelectionState } from '@tanstack/react-table';

interface Category {
  id: string;
  name: string;
  mcq_count?: number;
}

type DisplayMCQ = MCQ;

const UNCATEGORIZED_ID = 'uncategorized-mcqs-virtual-id';

const ManageMcqsPage = () => {
  const [mcqs, setMcqs] = useState<DisplayMCQ[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMcqForEdit, setSelectedMcqForEdit] = useState<MCQ | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isEnhancing, setIsEnhancing] = useState(false);

  const { hasCheckedInitialSession } = useSession();

  const fetchData = useCallback(async () => {
    setIsPageLoading(true);
    try {
      // Step 1: Fetch all categories
      const { data: categoriesData, error: categoriesError } = await supabase.from('categories').select('*');
      if (categoriesError) throw categoriesError;

      // Step 2: Fetch counts for each category
      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count } = await supabase.from('mcq_category_links').select('mcq_id', { count: 'exact', head: true }).eq('category_id', category.id);
          return { ...category, mcq_count: count || 0 };
        })
      );

      // Step 3: Get the count of uncategorized MCQs using a left join and null check
      const { count: uncategorizedCount, error: uncategorizedError } = await supabase
        .from('mcqs')
        .select('id, mcq_category_links!left(mcq_id)', { count: 'exact', head: true })
        .is('mcq_category_links.mcq_id', null);
      if (uncategorizedError) throw uncategorizedError;
      
      // Step 4: Combine data for the categories state
      setCategories([
        ...categoriesWithCounts,
        { id: UNCATEGORIZED_ID, name: 'Uncategorized', mcq_count: uncategorizedCount }
      ]);

      // Step 5: Build and execute the main MCQs query with filters
      let mcqsQuery = supabase.from('mcqs').select(`*, mcq_category_links!left(category_id, categories(name))`);

      if (searchTerm) {
        mcqsQuery = mcqsQuery.ilike('question_text', `%${searchTerm}%`);
      }

      if (selectedFilterCategory && selectedFilterCategory !== 'all') {
        if (selectedFilterCategory === UNCATEGORIZED_ID) {
          mcqsQuery = mcqsQuery.is('mcq_category_links.category_id', null);
        } else {
          // To filter by a category on a left-joined table, it's safer to get the MCQ IDs first
          const { data: linkData, error: linkError } = await supabase.from('mcq_category_links').select('mcq_id').eq('category_id', selectedFilterCategory);
          if (linkError) throw linkError;
          const mcqIdsForCategory = linkData.map(link => link.mcq_id);
          
          if (mcqIdsForCategory.length === 0) {
            setMcqs([]);
            setIsPageLoading(false);
            return;
          }
          mcqsQuery = mcqsQuery.in('id', mcqIdsForCategory);
        }
      }

      const { data: mcqsData, error: mcqsError } = await mcqsQuery.limit(5000);
      if (mcqsError) throw mcqsError;

      const displayMcqs: DisplayMCQ[] = (mcqsData || []).map((mcq: any) => ({
        ...mcq,
        category_links: mcq.mcq_category_links?.map((link: any) => ({
          category_id: link.category_id,
          category_name: link.categories?.name || null,
        })) || [],
      }));
      setMcqs(displayMcqs);

    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({ title: "Error", description: `Failed to load data: ${error.message}`, variant: "destructive" });
    } finally {
      setIsPageLoading(false);
    }
  }, [toast, searchTerm, selectedFilterCategory]);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      const handler = setTimeout(() => {
        fetchData();
      }, 300); // Debounce requests
      return () => clearTimeout(handler);
    }
  }, [hasCheckedInitialSession, fetchData]);

  const handleBulkAction = async (
    action: 'enhance',
    functionName: 'bulk-enhance-mcqs',
    confirmMessage: string,
    successMessage: string
  ) => {
    const selectedIndices = Object.keys(rowSelection);
    const selectedMcqIds = selectedIndices.map(index => mcqs[parseInt(index)].id);

    if (selectedMcqIds.length === 0) {
      toast({ title: "No MCQs Selected", description: "Please select one or more MCQs.", variant: "destructive" });
      return;
    }
    if (!window.confirm(confirmMessage.replace('{count}', String(selectedMcqIds.length)))) return;

    if (action === 'enhance') setIsEnhancing(true);

    try {
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: { mcq_ids: selectedMcqIds },
      });
      if (error) throw error;
      if (data.errorCount > 0) {
        toast({ title: "Partial Success", description: `${successMessage} ${data.successCount} MCQs. ${data.errorCount} failed.`, variant: "default" });
        console.error(`Bulk ${action} Errors:`, data.errors);
      } else {
        toast({ title: "Success!", description: `${successMessage} ${data.successCount} MCQs.` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to ${action} MCQs: ${error.message || 'Unknown error'}`, variant: "destructive" });
    } finally {
      if (action === 'enhance') setIsEnhancing(false);
      setRowSelection({});
      fetchData();
    }
  };

  const handleDeleteMcq = async (mcqId: string, explanationId: string | null) => {
    if (!window.confirm("Are you sure you want to delete this MCQ?")) return;
    try {
      await supabase.from('mcq_category_links').delete().eq('mcq_id', mcqId);
      await supabase.from('mcqs').delete().eq('id', mcqId);
      if (explanationId) {
        await supabase.from('mcq_explanations').delete().eq('id', explanationId);
      }
      toast({ title: "Success!", description: "MCQ deleted successfully." });
      fetchData();
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to delete MCQ: ${error.message}`, variant: "destructive" });
    }
  };

  const handleEditClick = (mcq: MCQ) => {
    setSelectedMcqForEdit(mcq);
    setIsEditDialogOpen(true);
  };

  const columns = createMcqColumns({ onDelete: handleDeleteMcq, onEdit: handleEditClick });
  const numSelected = Object.keys(rowSelection).length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage MCQs</h1>
      <Card>
        <CardHeader><CardTitle>Filter MCQs</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input placeholder="Search by question text..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          <Select onValueChange={(value) => setSelectedFilterCategory(value === "all" ? null : value)} value={selectedFilterCategory || "all"}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => <SelectItem key={cat.id} value={cat.id}>{cat.name} ({cat.mcq_count || 0})</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => { setSelectedFilterCategory(null); setSearchTerm(''); }} variant="outline">Clear Filters</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Actions</CardTitle>
          <CardDescription>Perform actions on multiple selected MCQs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button onClick={() => handleBulkAction('enhance', 'bulk-enhance-mcqs', 'Enhance {count} MCQs with AI? This will overwrite existing data.', 'Enhanced')} disabled={isEnhancing || numSelected === 0}>
              {isEnhancing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Bulk Enhance with AI ({numSelected})
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {numSelected > 0 ? `${numSelected} MCQ(s) selected.` : "Select MCQs in the table below to perform bulk actions."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Multiple Choice Questions</CardTitle></CardHeader>
        <CardContent>
          {isPageLoading ? <p>Loading MCQs...</p> : <DataTable columns={columns} data={mcqs} rowSelection={rowSelection} setRowSelection={setRowSelection} />}
        </CardContent>
      </Card>
      <MadeWithDyad />
      {selectedMcqForEdit && <EditMcqDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} mcq={selectedMcqForEdit} onSave={fetchData} />}
    </div>
  );
};

export default ManageMcqsPage;