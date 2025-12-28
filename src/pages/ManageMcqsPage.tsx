"use client";

import { useEffect, useState, useMemo, useCallback } from 'react'; 
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { createMcqColumns, MCQ } from '@/components/mcq-columns';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import EditMcqDialog from '@/components/EditMcqDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Wand2, Loader2 } from 'lucide-react'; 
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

const UNCATEGORIZED_ID = 'uncategorized-mcqs-virtual-id'; 

const ManageMcqsPage = () => {
  const [rawMcqs, setRawMcqs] = useState<MCQ[]>([]); 
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

  // Helper to fetch categories with their MCQ counts
  const fetchCategoriesData = async (): Promise<Category[]> => {
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name');
      
    if (categoriesError) throw categoriesError;

    // Fetch all links to count uncategorized MCQs efficiently
    const { data: allLinks, error: linksError } = await supabase
      .from('mcq_category_links')
      .select('mcq_id, category_id');
    
    if (linksError) throw linksError;

    const linkCountMap = new Map<string, number>();
    const uniqueLinkedMcqIds = new Set<string>();

    allLinks.forEach(link => {
      uniqueLinkedMcqIds.add(link.mcq_id);
      linkCountMap.set(link.category_id, (linkCountMap.get(link.category_id) || 0) + 1);
    });

    const { count: totalMcqCount } = await supabase
      .from('mcqs')
      .select('id', { count: 'exact', head: true });

    const categoriesWithStats = (categoriesData || []).map(cat => ({
      ...cat,
      mcq_count: linkCountMap.get(cat.id) || 0
    }));

    const uncategorizedCount = Math.max(0, (totalMcqCount || 0) - uniqueLinkedMcqIds.size);
    
    return [
      ...categoriesWithStats,
      { id: UNCATEGORIZED_ID, name: 'Uncategorized', mcq_count: uncategorizedCount }
    ];
  };

  // Helper to fetch all MCQs and their links
  const fetchMcqsData = async (currentCategories: Category[]): Promise<MCQ[]> => {
    let allMcqs: any[] = [];
    let allLinks: DbMcqCategoryLink[] = [];
    const limit = 1000;

    // 1. Fetch MCQs (filtered by search term if active)
    let offsetMcqs = 0;
    let hasMoreMcqs = true;
    while (hasMoreMcqs) {
      let query = supabase
        .from('mcqs')
        .select('id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation_id, difficulty, is_trial_mcq')
        .range(offsetMcqs, offsetMcqs + limit - 1)
        .order('created_at', { ascending: true });

      if (searchTerm) query = query.ilike('question_text', `%${searchTerm}%`);

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        allMcqs = allMcqs.concat(data);
        offsetMcqs += data.length;
        hasMoreMcqs = data.length === limit;
      } else {
        hasMoreMcqs = false;
      }
    }

    // 2. Fetch Category Links
    let offsetLinks = 0;
    let hasMoreLinks = true;
    while (hasMoreLinks) {
      const { data, error } = await supabase
        .from('mcq_category_links')
        .select('mcq_id, category_id')
        .range(offsetLinks, offsetLinks + limit - 1);

      if (error) throw error;

      if (data && data.length > 0) {
        allLinks = allLinks.concat(data);
        offsetLinks += data.length;
        hasMoreLinks = data.length === limit;
      } else {
        hasMoreLinks = false;
      }
    }

    // 3. Combine using Maps for O(1) lookups
    const catMap = new Map(currentCategories.map(c => [c.id, c.name]));
    const linksByMcq = new Map<string, { category_id: string; category_name: string }[]>();

    allLinks.forEach(link => {
      if (!linksByMcq.has(link.mcq_id)) linksByMcq.set(link.mcq_id, []);
      linksByMcq.get(link.mcq_id)?.push({
        category_id: link.category_id,
        category_name: catMap.get(link.category_id) || 'Unknown'
      });
    });

    return allMcqs.map(mcq => ({
      ...mcq,
      category_links: linksByMcq.get(mcq.id) || []
    }));
  };

  const loadData = useCallback(async () => {
    setIsPageLoading(true);
    try {
      // Parallelize category and MCQ fetching
      const categoriesData = await fetchCategoriesData();
      setCategories(categoriesData);
      
      const mcqsData = await fetchMcqsData(categoriesData);
      setRawMcqs(mcqsData);
    } catch (error: any) {
      console.error('[ManageMcqsPage] Load error:', error);
      toast({ title: "Error", description: "Failed to load management data.", variant: "destructive" });
    } finally {
      setIsPageLoading(false);
    }
  }, [searchTerm, toast]);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      loadData();
    }
  }, [hasCheckedInitialSession, loadData]);

  const filteredMcqs = useMemo(() => {
    if (!selectedFilterCategory || selectedFilterCategory === "all") return rawMcqs;
    if (selectedFilterCategory === UNCATEGORIZED_ID) return rawMcqs.filter(m => m.category_links.length === 0);
    return rawMcqs.filter(m => m.category_links.some(l => l.category_id === selectedFilterCategory));
  }, [rawMcqs, selectedFilterCategory]);

  const handleDeleteMcq = async (mcqId: string, explanationId: string | null) => {
    if (!window.confirm("Are you sure?")) return;
    try {
      await supabase.from('mcq_category_links').delete().eq('mcq_id', mcqId);
      const { error: mcqError } = await supabase.from('mcqs').delete().eq('id', mcqId);
      if (mcqError) throw mcqError;
      if (explanationId) await supabase.from('mcq_explanations').delete().eq('id', explanationId);
      toast({ title: "Success!", description: "MCQ deleted." });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: `Failed: ${error.message}`, variant: "destructive" });
    }
  };

  const handleBulkEnhance = async () => {
    const selectedIndices = Object.keys(rowSelection);
    const selectedMcqIds = selectedIndices.map(index => filteredMcqs[parseInt(index)].id);

    if (selectedMcqIds.length === 0) {
      toast({ title: "No MCQs Selected", description: "Please select MCQs to enhance.", variant: "destructive" });
      return;
    }

    if (!window.confirm(`Enhance ${selectedMcqIds.length} MCQs with AI?`)) return;

    setIsEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-enhance-mcqs', { body: { mcq_ids: selectedMcqIds } });
      if (error) throw error;
      toast({ title: "Complete", description: `Enhanced ${data.successCount} MCQs.` });
    } catch (error: any) {
      toast({ title: "Error", description: "Enhancement failed.", variant: "destructive" });
    } finally {
      setIsEnhancing(false);
      setRowSelection({});
      loadData();
    }
  };

  const handleEditClick = (mcq: MCQ) => {
    setSelectedMcqForEdit(mcq);
    setIsEditDialogOpen(true);
  };

  const columns = useMemo(() => createMcqColumns({ onDelete: handleDeleteMcq, onEdit: handleEditClick }), [loadData]);

  if (!hasCheckedInitialSession) return <LoadingBar />;

  const numSelected = Object.keys(rowSelection).length;

  return (
    <div className="space-y-6">
      {isPageLoading && <LoadingBar />}
      <h1 className="text-3xl font-bold">Manage MCQs</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filter & Search</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex-1">
            <Label htmlFor="search-term">Search Text</Label>
            <Input id="search-term" placeholder="Find question..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="filterCategory">Category</Label>
              <Select onValueChange={(v) => setSelectedFilterCategory(v === "all" ? null : v)} value={selectedFilterCategory || "all"}>
                <SelectTrigger id="filterCategory"><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name} ({cat.mcq_count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
                <Button onClick={() => { setSelectedFilterCategory(null); setSearchTerm(''); }} variant="outline" className="w-full sm:w-auto">Reset</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Actions</CardTitle>
        </CardHeader>
        <CardContent>
            <Button onClick={handleBulkEnhance} disabled={isEnhancing || numSelected === 0}>
              {isEnhancing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Bulk Enhance with AI ({numSelected})
            </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Multiple Choice Questions</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={filteredMcqs} rowSelection={rowSelection} setRowSelection={setRowSelection} />
          {!isPageLoading && filteredMcqs.length === 0 && (
            <div className="mt-8 text-center text-muted-foreground">No questions matching your filters.</div>
          )}
        </CardContent>
      </Card>

      {selectedMcqForEdit && (
        <EditMcqDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} mcq={selectedMcqForEdit} onSave={loadData} />
      )}
      <MadeWithDyad />
    </div>
  );
};

export default ManageMcqsPage;