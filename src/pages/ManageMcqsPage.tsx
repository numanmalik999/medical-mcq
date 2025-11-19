"use client";

import { useEffect, useState, useMemo } from 'react';
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
  const [rawMcqs, setRawMcqs] = useState<DisplayMCQ[]>([]);
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

  const fetchCategories = async () => {
    const { data: categoriesData, error: categoriesError } = await supabase.from('categories').select('*');
    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
    } else {
      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count } = await supabase.from('mcq_category_links').select('mcq_id', { count: 'exact', head: true }).eq('category_id', category.id);
          return { ...category, mcq_count: count || 0 };
        })
      );
      setCategories([...categoriesWithCounts, { id: UNCATEGORIZED_ID, name: 'Uncategorized', mcq_count: 0 }]); // Placeholder count
    }
  };

  const fetchMcqs = async () => {
    setIsPageLoading(true);
    let mcqsQuery = supabase.from('mcqs').select(`
      *,
      mcq_category_links (category_id, categories (name)),
      mcq_topic_links (topic_id, course_topics (title))
    `);

    if (searchTerm) {
      mcqsQuery = mcqsQuery.ilike('question_text', `%${searchTerm}%`);
    }
    
    const { data: mcqsData, error: mcqsError } = await mcqsQuery.limit(5000);

    if (mcqsError) {
      console.error('Error fetching MCQs:', mcqsError);
      toast({ title: "Error", description: "Failed to load MCQs.", variant: "destructive" });
      setRawMcqs([]);
    } else {
      const displayMcqs: DisplayMCQ[] = (mcqsData || []).map((mcq: any) => ({
        ...mcq,
        category_links: mcq.mcq_category_links.map((link: any) => ({
          category_id: link.category_id,
          category_name: link.categories?.name || null,
        })),
        topic_links: mcq.mcq_topic_links.map((link: any) => ({
          topic_id: link.topic_id,
          topic_title: link.course_topics?.title || null,
        })),
      }));
      setRawMcqs(displayMcqs);
    }
    setIsPageLoading(false);
  };

  const refreshAllData = async () => {
    setIsPageLoading(true);
    await fetchCategories();
    await fetchMcqs();
    setIsPageLoading(false);
  };

  useEffect(() => {
    if (hasCheckedInitialSession) {
      refreshAllData();
    }
  }, [hasCheckedInitialSession]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (hasCheckedInitialSession) {
        fetchMcqs();
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [searchTerm, hasCheckedInitialSession]);

  const filteredMcqs = useMemo(() => {
    if (!selectedFilterCategory || selectedFilterCategory === "all") return rawMcqs;
    if (selectedFilterCategory === UNCATEGORIZED_ID) return rawMcqs.filter(mcq => mcq.category_links.length === 0);
    return rawMcqs.filter(mcq => mcq.category_links.some(link => link.category_id === selectedFilterCategory));
  }, [rawMcqs, selectedFilterCategory]);

  const handleBulkAction = async (
    action: 'enhance',
    functionName: 'bulk-enhance-mcqs',
    confirmMessage: string,
    successMessage: string
  ) => {
    const selectedIndices = Object.keys(rowSelection);
    const selectedMcqIds = selectedIndices.map(index => filteredMcqs[parseInt(index)].id);

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
      refreshAllData();
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
      refreshAllData();
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
          {isPageLoading ? <p>Loading MCQs...</p> : <DataTable columns={columns} data={filteredMcqs} rowSelection={rowSelection} setRowSelection={setRowSelection} />}
        </CardContent>
      </Card>
      <MadeWithDyad />
      {selectedMcqForEdit && <EditMcqDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} mcq={selectedMcqForEdit} onSave={refreshAllData} />}
    </div>
  );
};

export default ManageMcqsPage;