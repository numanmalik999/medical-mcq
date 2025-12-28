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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Trash2, Wand2, Loader2 } from 'lucide-react'; 
import { useSession } from '@/components/SessionContextProvider'; 
import { RowSelectionState } from '@tanstack/react-table';
import LoadingBar from '@/components/LoadingBar';

interface Category {
  id: string;
  name: string;
  mcq_count?: number; 
}

interface DbMcqCategoryLink {
  mcq_id: string;
  category_id: string;
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
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');
    if (categoriesError) {
      console.error('[ManageMcqsPage] Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories for filter.", variant: "destructive" });
    } else {
      let allLinkedMcqIdsData: { mcq_id: string }[] = [];
      let offsetLinkedIds = 0;
      const limitLinkedIds = 1000;
      let hasMoreLinkedIds = true;

      while (hasMoreLinkedIds) {
        const { data: chunkData, error: linkedMcqIdsError } = await supabase
          .from('mcq_category_links')
          .select('mcq_id')
          .range(offsetLinkedIds, offsetLinkedIds + limitLinkedIds - 1);

        if (linkedMcqIdsError) {
          console.error('[ManageMcqsPage] Error fetching all linked MCQ IDs:', linkedMcqIdsError);
          break; 
        }

        if (chunkData && chunkData.length > 0) {
          allLinkedMcqIdsData = allLinkedMcqIdsData.concat(chunkData);
          offsetLinkedIds += chunkData.length;
          hasMoreLinkedIds = chunkData.length === limitLinkedIds;
        } else {
          hasMoreLinkedIds = false;
        }
      }
      const allLinkedMcqIds = allLinkedMcqIdsData.map(link => link.mcq_id);
      const uniqueLinkedMcqIds = new Set(allLinkedMcqIds);

      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count: mcqCount, error: mcqCountError } = await supabase
            .from('mcq_category_links')
            .select('mcq_id', { count: 'exact', head: true })
            .eq('category_id', category.id);

          if (mcqCountError) {
            console.error(`[ManageMcqsPage] Error fetching count for ${category.name}:`, mcqCountError);
          }
          return { ...category, mcq_count: mcqCount || 0 };
        })
      );

      const { count: totalMcqCount } = await supabase
        .from('mcqs')
        .select('id', { count: 'exact', head: true });

      const uncategorizedMcqCount = (totalMcqCount || 0) - uniqueLinkedMcqIds.size;

      setCategories([...categoriesWithCounts, { id: UNCATEGORIZED_ID, name: 'Uncategorized', mcq_count: Math.max(0, uncategorizedMcqCount) }]);
    }
  };

  const fetchMcqs = async () => {
    setIsPageLoading(true);

    let allMcqs: any[] = [];
    let allMcqCategoryLinks: DbMcqCategoryLink[] = [];
    const limit = 1000; 

    let offsetMcqs = 0;
    let hasMoreMcqs = true;
    while (hasMoreMcqs) {
      let mcqsQuery = supabase
        .from('mcqs')
        .select(`
          id,
          question_text,
          option_a,
          option_b,
          option_c,
          option_d,
          correct_answer,
          explanation_id,
          difficulty,
          is_trial_mcq
        `)
        .range(offsetMcqs, offsetMcqs + limit - 1);

      if (searchTerm) {
        mcqsQuery = mcqsQuery.ilike('question_text', `%${searchTerm}%`);
      }
      mcqsQuery = mcqsQuery.order('created_at', { ascending: true });

      const { data: mcqsData, error: mcqsError } = await mcqsQuery;

      if (mcqsError) {
        console.error('[ManageMcqsPage] Error fetching MCQs:', mcqsError.message);
        toast({ title: "Error", description: "Failed to load MCQs.", variant: "destructive" });
        setRawMcqs([]);
        setIsPageLoading(false);
        return;
      }

      if (mcqsData && mcqsData.length > 0) {
        allMcqs = allMcqs.concat(mcqsData);
        offsetMcqs += mcqsData.length;
        hasMoreMcqs = mcqsData.length === limit;
      } else {
        hasMoreMcqs = false;
      }
    }

    let offsetLinks = 0;
    let hasMoreLinks = true;
    while (hasMoreLinks) {
      const { data: mcqCategoryLinksData, error: mcqCategoryLinksError } = await supabase
        .from('mcq_category_links')
        .select('mcq_id, category_id')
        .range(offsetLinks, offsetLinks + limit - 1);

      if (mcqCategoryLinksError) {
        console.error('[ManageMcqsPage] Error fetching links:', mcqCategoryLinksError);
        toast({ title: "Error", description: "Failed to load links.", variant: "destructive" });
        setRawMcqs([]);
        setIsPageLoading(false);
        return;
      }

      if (mcqCategoryLinksData && mcqCategoryLinksData.length > 0) {
        allMcqCategoryLinks = allMcqCategoryLinks.concat(mcqCategoryLinksData);
        offsetLinks += mcqCategoryLinksData.length;
        hasMoreLinks = mcqCategoryLinksData.length === limit;
      } else {
        hasMoreLinks = false;
      }
    }

    const categoryNameMap = new Map(categories.map(cat => [cat.id, cat.name]));
    const mcqLinksMap = new Map<string, DbMcqCategoryLink[]>();
    allMcqCategoryLinks.forEach(link => { 
      if (!mcqLinksMap.has(link.mcq_id)) {
        mcqLinksMap.set(link.mcq_id, []);
      }
      mcqLinksMap.get(link.mcq_id)?.push(link);
    });

    const displayMcqs: DisplayMCQ[] = (allMcqs || []).map((mcq: any) => { 
      const linksForMcq = mcqLinksMap.get(mcq.id) || [];
      const hydratedLinks = linksForMcq.map(link => ({
        category_id: link.category_id,
        category_name: categoryNameMap.get(link.category_id) || null,
      }));
      return {
        ...mcq,
        category_links: hydratedLinks,
      };
    });
    setRawMcqs(displayMcqs || []);
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
      fetchCategories();
    }
  }, [hasCheckedInitialSession]);

  useEffect(() => {
    if (hasCheckedInitialSession && (categories.length > 0 || (categories.length === 0 && !isPageLoading))) {
      fetchMcqs();
    }
  }, [searchTerm, hasCheckedInitialSession, categories]); 

  const filteredMcqs = useMemo(() => {
    if (!selectedFilterCategory || selectedFilterCategory === "all") {
      return rawMcqs;
    }

    if (selectedFilterCategory === UNCATEGORIZED_ID) {
      return rawMcqs.filter(mcq => mcq.category_links.length === 0);
    }

    return rawMcqs.filter(mcq =>
      mcq.category_links.some(link => link.category_id === selectedFilterCategory)
    );
  }, [rawMcqs, selectedFilterCategory]);

  const handleBulkEnhance = async () => {
    const selectedIndices = Object.keys(rowSelection);
    const selectedMcqIds = selectedIndices.map(index => filteredMcqs[parseInt(index)].id);

    if (selectedMcqIds.length === 0) {
      toast({ title: "No MCQs Selected", description: "Please select one or more MCQs to enhance.", variant: "destructive" });
      return;
    }

    if (!window.confirm(`You are about to enhance ${selectedMcqIds.length} MCQs with AI. Continue?`)) {
      return;
    }

    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-enhance-mcqs', {
        body: { mcq_ids: selectedMcqIds },
      });

      if (error) throw error;

      if (data.errorCount > 0) {
        toast({
          title: "Partial Success",
          description: `Enhanced ${data.successCount} MCQs. ${data.errorCount} failed.`,
          variant: "default",
        });
      } else {
        toast({ title: "Success!", description: `Successfully enhanced ${data.successCount} MCQs.` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed to enhance MCQs: ${error.message || 'Unknown error'}`, variant: "destructive" });
    } finally {
      setIsEnhancing(false);
      setRowSelection({});
      refreshAllData();
    }
  };

  const handleDeleteMcq = async (mcqId: string, explanationId: string | null) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await supabase.from('mcq_category_links').delete().eq('mcq_id', mcqId);
      const { error: mcqError } = await supabase.from('mcqs').delete().eq('id', mcqId);
      if (mcqError) throw mcqError;
      if (explanationId) {
        await supabase.from('mcq_explanations').delete().eq('id', explanationId);
      }
      toast({ title: "Success!", description: "MCQ deleted." });
      refreshAllData(); 
    } catch (error: any) {
      toast({ title: "Error", description: `Failed: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteAllMcqsInCategory = async () => {
    if (!selectedFilterCategory) return;
    const categoryName = categories.find(cat => cat.id === selectedFilterCategory)?.name || 'Selected Category';
    if (!window.confirm(`Delete ALL MCQs in "${categoryName}"?`)) return;

    setIsPageLoading(true);
    try {
      let mcqIdsToDelete: string[] = [];
      if (selectedFilterCategory === UNCATEGORIZED_ID) {
        const { data: links } = await supabase.from('mcq_category_links').select('mcq_id');
        const categorized = Array.from(new Set(links?.map(l => l.mcq_id) || []));
        const { data: uncategorized } = await supabase.from('mcqs').select('id').not('id', 'in', `(${categorized.join(',')})`);
        mcqIdsToDelete = uncategorized?.map(mcq => mcq.id) || [];
      } else {
        const { data: links } = await supabase.from('mcq_category_links').select('mcq_id').eq('category_id', selectedFilterCategory);
        mcqIdsToDelete = Array.from(new Set(links?.map(l => l.mcq_id) || []));
      }

      if (mcqIdsToDelete.length > 0) {
        const { data: mcqs } = await supabase.from('mcqs').select('id, explanation_id').in('id', mcqIdsToDelete);
        const exps = mcqs?.map(m => m.explanation_id).filter((id): id is string => !!id) || [];
        if (selectedFilterCategory !== UNCATEGORIZED_ID) {
          await supabase.from('mcq_category_links').delete().in('mcq_id', mcqIdsToDelete).eq('category_id', selectedFilterCategory);
        }
        if (exps.length > 0) await supabase.from('mcq_explanations').delete().in('id', exps);
        await supabase.from('mcqs').delete().in('id', mcqIdsToDelete);
        toast({ title: "Success!", description: `Deleted ${mcqIdsToDelete.length} MCQs.` });
        refreshAllData();
        setSelectedFilterCategory(null);
      }
    } catch (error: any) {
      toast({ title: "Error", description: `Failed: ${error.message}`, variant: "destructive" });
    } finally {
      setIsPageLoading(false);
    }
  };

  const handleEditClick = (mcq: MCQ) => {
    setSelectedMcqForEdit(mcq);
    setIsEditDialogOpen(true);
  };

  const columns = createMcqColumns({ onDelete: handleDeleteMcq, onEdit: handleEditClick });

  if (!hasCheckedInitialSession) {
    return <LoadingBar />;
  }

  const numSelected = Object.keys(rowSelection).length;

  return (
    <div className="space-y-6">
      {isPageLoading && <LoadingBar />}
      <h1 className="text-3xl font-bold">Manage MCQs</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filter MCQs</CardTitle>
          <CardDescription>Filter by category or search by text.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex-1">
            <Label htmlFor="search-term">Search Question</Label>
            <Input id="search-term" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="filterCategory">Category</Label>
              <Select onValueChange={(value) => setSelectedFilterCategory(value === "all" ? null : value)} value={selectedFilterCategory || "all"}>
                <SelectTrigger id="filterCategory">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name} ({cat.mcq_count || 0})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button onClick={() => { setSelectedFilterCategory(null); setSearchTerm(''); }} variant="outline">Clear Filters</Button>
            <Button onClick={handleDeleteAllMcqsInCategory} variant="destructive" disabled={!selectedFilterCategory || isPageLoading} className="flex items-center gap-1">
              <Trash2 className="h-4 w-4" /> Delete All in Category
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Actions</CardTitle>
          <CardDescription>Perform actions on multiple selected MCQs.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={handleBulkEnhance} disabled={isEnhancing || numSelected === 0}>
              {isEnhancing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Bulk Enhance with AI ({numSelected})
            </Button>
            <p className="text-sm text-muted-foreground">
              {numSelected > 0 ? `${numSelected} MCQ(s) selected.` : "Select MCQs in the table below."}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Multiple Choice Questions</CardTitle>
          <CardDescription>View, edit, and delete MCQs from your database.</CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filteredMcqs} rowSelection={rowSelection} setRowSelection={setRowSelection} />
          {!isPageLoading && filteredMcqs.length === 0 && (
            <div className="mt-4 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-2">No MCQs found.</p>
              <Button onClick={refreshAllData}>Refresh List</Button>
            </div>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />

      {selectedMcqForEdit && (
        <EditMcqDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} mcq={selectedMcqForEdit} onSave={refreshAllData} />
      )}
    </div>
  );
};

export default ManageMcqsPage;