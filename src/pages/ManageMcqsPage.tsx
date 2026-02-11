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
import { Wand2, Loader2, Sparkles, CircleDashed, LayoutList } from 'lucide-react'; 
import { useSession } from '@/components/SessionContextProvider'; 
import { RowSelectionState } from '@tanstack/react-table';
import LoadingBar from '@/components/LoadingBar';
import { showLoading, dismissToast, showError, showSuccess } from '@/utils/toast';

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
  const [isFetchingMcqs, setIsFetchingMcqs] = useState(false);
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMcqForEdit, setSelectedMcqForEdit] = useState<MCQ | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string | null>(null);
  const [enhancementFilter, setEnhancementFilter] = useState<'all' | 'enhanced' | 'unenhanced'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isEnhancing, setIsEnhancing] = useState(false);

  const { hasCheckedInitialSession } = useSession();

  const fetchCategories = async () => {
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (categoriesError) {
      console.error('[ManageMcqsPage] Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories for filter.", variant: "destructive" });
    } else {
      const { count: linkedCount } = await supabase
        .from('mcq_category_links')
        .select('mcq_id', { count: 'exact', head: true });

      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count: mcqCount } = await supabase
            .from('mcq_category_links')
            .select('mcq_id', { count: 'exact', head: true })
            .eq('category_id', category.id);
          return { ...category, mcq_count: mcqCount || 0 };
        })
      );

      const { count: totalMcqCount } = await supabase
        .from('mcqs')
        .select('id', { count: 'exact', head: true });

      const uncategorizedMcqCount = (totalMcqCount || 0) - (linkedCount || 0);

      setCategories([...categoriesWithCounts, { id: UNCATEGORIZED_ID, name: 'General Medical Practice', mcq_count: Math.max(0, uncategorizedMcqCount) }]);
    }
  };

  const fetchMcqs = async (categoryId: string | null) => {
    setIsFetchingMcqs(true);
    let allMcqs: any[] = [];
    let allMcqCategoryLinks: DbMcqCategoryLink[] = [];
    const limit = 1000; 

    try {
      let mcqIdsToFetch: string[] | null = null;

      if (categoryId && categoryId !== "all") {
        if (categoryId === UNCATEGORIZED_ID) {
          const { data: linked } = await supabase.from('mcq_category_links').select('mcq_id');
          const linkedIds = new Set(linked?.map(l => l.mcq_id) || []);
          const { data: all } = await supabase.from('mcqs').select('id');
          mcqIdsToFetch = (all?.map(m => m.id) || []).filter(id => !linkedIds.has(id));
        } else {
          const { data: links } = await supabase.from('mcq_category_links').select('mcq_id').eq('category_id', categoryId);
          mcqIdsToFetch = links?.map(l => l.mcq_id) || [];
        }
      }

      let offsetMcqs = 0;
      let hasMoreMcqs = true;
      
      while (hasMoreMcqs) {
        let mcqsQuery = supabase
          .from('mcqs')
          .select(`id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation_id, difficulty, is_trial_mcq`)
          .range(offsetMcqs, offsetMcqs + limit - 1);

        if (mcqIdsToFetch) {
          if (mcqIdsToFetch.length === 0) break;
          mcqsQuery = mcqsQuery.in('id', mcqIdsToFetch);
        }

        if (searchTerm) {
          mcqsQuery = mcqsQuery.ilike('question_text', `%${searchTerm}%`);
        }
        
        mcqsQuery = mcqsQuery.order('created_at', { ascending: true });

        const { data, error } = await mcqsQuery;
        if (error) throw error;

        if (data && data.length > 0) {
          allMcqs = allMcqs.concat(data);
          offsetMcqs += data.length;
          hasMoreMcqs = data.length === limit;
        } else {
          hasMoreMcqs = false;
        }
      }

      const mcqIds = allMcqs.map(m => m.id);
      if (mcqIds.length > 0) {
        const { data: linksData } = await supabase
          .from('mcq_category_links')
          .select('mcq_id, category_id')
          .in('mcq_id', mcqIds);
        allMcqCategoryLinks = linksData || [];
      }

      const categoryNameMap = new Map(categories.map(cat => [cat.id, cat.name]));
      const mcqLinksMap = new Map<string, DbMcqCategoryLink[]>();
      allMcqCategoryLinks.forEach(link => { 
        if (!mcqLinksMap.has(link.mcq_id)) mcqLinksMap.set(link.mcq_id, []);
        mcqLinksMap.get(link.mcq_id)?.push(link);
      });

      const displayMcqs: DisplayMCQ[] = allMcqs.map((mcq: any) => { 
        const linksForMcq = mcqLinksMap.get(mcq.id) || [];
        const hydratedLinks = linksForMcq.map(link => ({
          category_id: link.category_id,
          category_name: categoryNameMap.get(link.category_id) || null,
        }));
        return { ...mcq, category_links: hydratedLinks };
      });
      
      setRawMcqs(displayMcqs);
    } catch (error: any) {
      console.error('[ManageMcqsPage] Error fetching MCQs:', error.message);
      toast({ title: "Error", description: "Failed to load MCQs.", variant: "destructive" });
      setRawMcqs([]);
    } finally {
      setIsFetchingMcqs(false);
    }
  };

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchCategories().then(() => setIsPageLoading(false));
    }
  }, [hasCheckedInitialSession]);

  useEffect(() => {
    if (selectedFilterCategory) {
      fetchMcqs(selectedFilterCategory);
    } else {
      setRawMcqs([]);
    }
  }, [selectedFilterCategory, searchTerm]);

  const filteredMcqs = useMemo(() => {
    let result = rawMcqs;
    if (enhancementFilter === 'enhanced') {
      result = result.filter(mcq => !!mcq.difficulty);
    } else if (enhancementFilter === 'unenhanced') {
      result = result.filter(mcq => !mcq.difficulty);
    }
    return result;
  }, [rawMcqs, enhancementFilter]);

  const handleDeleteMcq = async (mcqId: string, explanationId: string | null) => {
    if (!window.confirm("Are you sure you want to delete this MCQ?")) return;
    try {
      await supabase.from('mcq_category_links').delete().eq('mcq_id', mcqId);
      const { error: mcqError } = await supabase.from('mcqs').delete().eq('id', mcqId);
      if (mcqError) throw mcqError;
      if (explanationId) await supabase.from('mcq_explanations').delete().eq('id', explanationId);
      toast({ title: "Success!", description: "MCQ deleted successfully." });
      if (selectedFilterCategory) fetchMcqs(selectedFilterCategory);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleBulkEnhance = async () => {
    const selectedIndices = Object.keys(rowSelection);
    const selectedMcqIds = selectedIndices.map(index => filteredMcqs[parseInt(index)].id);

    if (selectedMcqIds.length === 0) {
      toast({ title: "No MCQs Selected", variant: "destructive" });
      return;
    }

    if (!window.confirm(`Optimize ${selectedMcqIds.length} MCQs one-by-one?`)) return;

    setIsEnhancing(true);
    let successCount = 0;
    let errorCount = 0;
    
    // Tracking the active toast ID so we can properly dismiss/update it
    let activeToastId = showLoading(`Initializing AI optimization for ${selectedMcqIds.length} scenarios...`);

    try {
      for (let i = 0; i < selectedMcqIds.length; i++) {
        const currentId = selectedMcqIds[i];
        
        // Dismiss previous loop toast and create new one with updated counter
        dismissToast(activeToastId);
        activeToastId = showLoading(`AI Optimizing scenario ${i + 1} of ${selectedMcqIds.length}...`);

        try {
          const { data, error } = await supabase.functions.invoke('bulk-enhance-mcqs', {
            body: { mcq_ids: [currentId] },
          });

          if (error || data.errorCount > 0) {
            errorCount++;
          } else {
            successCount++;
          }
        } catch (e) {
          console.error(`Error enhancing MCQ ${currentId}:`, e);
          errorCount++;
        }
      }

      // Final cleanup of loading toast
      dismissToast(activeToastId);
      
      if (errorCount > 0) {
        showError(`Optimization complete. Successfully updated ${successCount} items. ${errorCount} failed.`);
      } else {
        showSuccess(`Successfully optimized all ${successCount} scenarios with clinical AI insights.`);
      }

      setRowSelection({});
      if (selectedFilterCategory) fetchMcqs(selectedFilterCategory);
    } catch (error: any) {
      dismissToast(activeToastId);
      showError(`Enhancement Interrupted: ${error.message}`);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleEditClick = (mcq: MCQ) => {
    setSelectedMcqForEdit(mcq);
    setIsEditDialogOpen(true);
  };

  const columns = useMemo(() => createMcqColumns({ onDelete: handleDeleteMcq, onEdit: handleEditClick }), []);

  if (!hasCheckedInitialSession || isPageLoading) return <LoadingBar />;

  const numSelected = Object.keys(rowSelection).length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage MCQs</h1>

      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-primary/5 border-b pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <LayoutList className="h-5 w-5 text-primary" /> Select Specialty to Manage
          </CardTitle>
          <CardDescription>Select a category first to view and edit its questions.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="filterCategory">Specialty Category</Label>
              <Select onValueChange={(value) => setSelectedFilterCategory(value)} value={selectedFilterCategory || ""}>
                <SelectTrigger id="filterCategory" className="h-11 rounded-xl">
                  <SelectValue placeholder="-- Select Category --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">View All (Advanced Users)</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name} ({cat.mcq_count})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 flex-1">
              <Label htmlFor="search-term">Search within Specialty</Label>
              <Input 
                id="search-term" 
                placeholder="Keywords..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5 flex-1">
              <Label htmlFor="enhancementStatus">AI Enhancement Status</Label>
              <Select onValueChange={(value: any) => setEnhancementFilter(value)} value={enhancementFilter}>
                <SelectTrigger id="enhancementStatus" className="h-11 rounded-xl">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Questions</SelectItem>
                  <SelectItem value="enhanced">
                    <div className="flex items-center gap-2 text-blue-600 font-bold"><Sparkles className="h-3.5 w-3.5" /> Enhanced</div>
                  </SelectItem>
                  <SelectItem value="unenhanced">
                    <div className="flex items-center gap-2 text-muted-foreground"><CircleDashed className="h-3.5 w-3.5" /> Un-enhanced</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
                onClick={() => { setSelectedFilterCategory(null); setSearchTerm(''); setEnhancementFilter('all'); setRawMcqs([]); }} 
                variant="outline" 
                className="h-11 rounded-xl"
            >
                Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {!selectedFilterCategory ? (
        <Card className="py-20 text-center rounded-3xl border-2 border-dashed bg-muted/20">
            <div className="max-w-md mx-auto space-y-4">
                <div className="p-4 bg-white rounded-full w-fit mx-auto shadow-sm">
                    <LayoutList className="h-10 w-10 text-primary/30" />
                </div>
                <div>
                    <h3 className="text-lg font-bold">No Specialty Selected</h3>
                    <p className="text-muted-foreground text-sm">Please select a category above to load the corresponding MCQs and start managing them.</p>
                </div>
            </div>
        </Card>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-4">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            {isFetchingMcqs && <Loader2 className="h-5 w-5 animate-spin text-primary" />}
                            {filteredMcqs.length} Questions in {categories.find(c => c.id === selectedFilterCategory)?.name || 'Selected Filter'}
                        </CardTitle>
                        <CardDescription>Managing all questions on one page for faster auditing.</CardDescription>
                    </div>
                    <Button onClick={handleBulkEnhance} disabled={isEnhancing || numSelected === 0} className="rounded-xl font-bold">
                        {isEnhancing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Bulk Enhance Selected ({numSelected})
                    </Button>
                </CardHeader>
                <CardContent className="pt-6">
                    <DataTable 
                        columns={columns} 
                        data={filteredMcqs} 
                        rowSelection={rowSelection} 
                        setRowSelection={setRowSelection}
                        pageSize={1000} 
                    />
                    {isFetchingMcqs && filteredMcqs.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center gap-3">
                            <Loader2 className="h-10 w-10 animate-spin text-primary/20" />
                            <p className="text-muted-foreground font-black uppercase tracking-widest text-xs">Fetching Clinical Data...</p>
                        </div>
                    )}
                    {!isFetchingMcqs && filteredMcqs.length === 0 && (
                        <div className="py-20 text-center text-muted-foreground">No questions found matching your filters.</div>
                    )}
                </CardContent>
            </Card>
        </div>
      )}

      {selectedMcqForEdit && (
        <EditMcqDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} mcq={selectedMcqForEdit} onSave={() => fetchMcqs(selectedFilterCategory)} />
      )}
      <MadeWithDyad />
    </div>
  );
};

export default ManageMcqsPage;