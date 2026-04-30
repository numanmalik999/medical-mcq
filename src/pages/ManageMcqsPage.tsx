"use client";

import { useEffect, useState, useMemo } from 'react'; 
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/data-table';
import { createMcqColumns, MCQ } from '@/components/mcq-columns';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import EditMcqDialog from '@/components/EditMcqDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Wand2, Loader2, Sparkles, CircleDashed, LayoutList, Search, Filter, CheckCircle, Database, Trash2 } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider'; 
import { RowSelectionState } from '@tanstack/react-table';
import LoadingBar from '@/components/LoadingBar';
import { showLoading, updateLoading, dismissToast } from '@/utils/toast';
import { Badge } from '@/components/ui/badge';

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
const MANAGE_MCQ_CACHE_KEY = 'manage-mcqs-page-cache-v1';

const ManageMcqsPage = () => {
  const [rawMcqs, setRawMcqs] = useState<DisplayMCQ[]>([]); 
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isFetchingMcqs, setIsFetchingMcqs] = useState(false);
  const [totalGlobalCount, setTotalGlobalCount] = useState<number>(0);
  const [serverPage, setServerPage] = useState(0);
  const [serverPageSize] = useState(100);
  const [serverTotalCount, setServerTotalCount] = useState(0);
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMcqForEdit, setSelectedMcqForEdit] = useState<MCQ | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string | null>(null);
  const [enhancementFilter, setEnhancementFilter] = useState<'all' | 'enhanced' | 'unenhanced'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const { hasCheckedInitialSession } = useSession();

  useEffect(() => {
    const cached = sessionStorage.getItem(MANAGE_MCQ_CACHE_KEY);
    if (!cached) return;

    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed.rawMcqs)) setRawMcqs(parsed.rawMcqs);
      if (Array.isArray(parsed.categories)) setCategories(parsed.categories);
      if (typeof parsed.selectedFilterCategory === 'string' || parsed.selectedFilterCategory === null) {
        setSelectedFilterCategory(parsed.selectedFilterCategory);
      }
      if (parsed.enhancementFilter === 'all' || parsed.enhancementFilter === 'enhanced' || parsed.enhancementFilter === 'unenhanced') {
        setEnhancementFilter(parsed.enhancementFilter);
      }
      if (typeof parsed.searchTerm === 'string') setSearchTerm(parsed.searchTerm);
      if (typeof parsed.totalGlobalCount === 'number') setTotalGlobalCount(parsed.totalGlobalCount);
      if (typeof parsed.serverPage === 'number') setServerPage(parsed.serverPage);
      if (typeof parsed.serverTotalCount === 'number') setServerTotalCount(parsed.serverTotalCount);
      if (typeof parsed.isEditDialogOpen === 'boolean') setIsEditDialogOpen(false);
      if (parsed.rawMcqs?.length || parsed.categories?.length) setIsPageLoading(false);
    } catch {
      sessionStorage.removeItem(MANAGE_MCQ_CACHE_KEY);
    }
  }, []);

  useEffect(() => {
    const payload = {
      rawMcqs,
      categories,
      selectedFilterCategory,
      enhancementFilter,
      searchTerm,
      totalGlobalCount,
      serverPage,
      serverTotalCount,
    };
    sessionStorage.setItem(MANAGE_MCQ_CACHE_KEY, JSON.stringify(payload));
  }, [rawMcqs, categories, selectedFilterCategory, enhancementFilter, searchTerm, totalGlobalCount, serverPage, serverTotalCount]);

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

      setTotalGlobalCount(totalMcqCount || 0);

      const uncategorizedMcqCount = (totalMcqCount || 0) - (linkedCount || 0);

      setCategories([...categoriesWithCounts, { id: UNCATEGORIZED_ID, name: 'General Medical Practice', mcq_count: Math.max(0, uncategorizedMcqCount) }]);
    }
  };

  const fetchMcqs = async (page = serverPage) => {
    if (!selectedFilterCategory) return;

    setIsFetchingMcqs(true);
    const from = page * serverPageSize;
    const to = from + serverPageSize - 1;

    try {
      let pageMcqs: any[] = [];
      let pageLinks: DbMcqCategoryLink[] = [];
      const q = searchTerm.trim();

      if (selectedFilterCategory === 'all') {
        let mcqsQuery = supabase
          .from('mcqs')
          .select(`id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation_id, difficulty, is_trial_mcq`, { count: 'exact' })
          .order('created_at', { ascending: true })
          .range(from, to);

        if (q) mcqsQuery = mcqsQuery.ilike('question_text', `%${q}%`);

        const { data, error, count } = await mcqsQuery;
        if (error) throw error;

        pageMcqs = data || [];
        setServerTotalCount(count || 0);
      } else if (selectedFilterCategory === UNCATEGORIZED_ID) {
        let mcqsQuery = supabase
          .from('mcqs')
          .select(`id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation_id, difficulty, is_trial_mcq`)
          .order('created_at', { ascending: true });

        if (q) mcqsQuery = mcqsQuery.ilike('question_text', `%${q}%`);

        const { data: allData, error: allError } = await mcqsQuery;
        if (allError) throw allError;

        const allMcqs = allData || [];

        if (allMcqs.length > 0) {
          const allLinkedIds = new Set<string>();
          let linksOffset = 0;
          let hasMoreLinks = true;

          while (hasMoreLinks) {
            const { data: linkedRows, error: linkedError } = await supabase
              .from('mcq_category_links')
              .select('mcq_id')
              .range(linksOffset, linksOffset + 999);

            if (linkedError) throw linkedError;

            if (linkedRows && linkedRows.length > 0) {
              linkedRows.forEach((r) => allLinkedIds.add(r.mcq_id));
              linksOffset += linkedRows.length;
              hasMoreLinks = linkedRows.length === 1000;
            } else {
              hasMoreLinks = false;
            }
          }

          const uncategorized = allMcqs.filter((m) => !allLinkedIds.has(m.id));
          setServerTotalCount(uncategorized.length);
          pageMcqs = uncategorized.slice(from, to + 1);
        } else {
          setServerTotalCount(0);
          pageMcqs = [];
        }
      } else {
        const { data: linkRows, error: linkError, count } = await supabase
          .from('mcq_category_links')
          .select('mcq_id, category_id', { count: 'exact' })
          .eq('category_id', selectedFilterCategory)
          .order('mcq_id', { ascending: true })
          .range(from, to);

        if (linkError) throw linkError;

        const mcqIds = (linkRows || []).map((l) => l.mcq_id);
        pageLinks = linkRows || [];
        setServerTotalCount(count || 0);

        if (mcqIds.length > 0) {
          const { data: mcqRows, error: mcqError } = await supabase
            .from('mcqs')
            .select(`id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation_id, difficulty, is_trial_mcq`)
            .in('id', mcqIds)
            .order('created_at', { ascending: true });

          if (mcqError) throw mcqError;

          pageMcqs = q
            ? (mcqRows || []).filter((m) => (m.question_text || '').toLowerCase().includes(q.toLowerCase()))
            : (mcqRows || []);
        } else {
          pageMcqs = [];
        }
      }

      if (pageMcqs.length > 0 && pageLinks.length === 0) {
        const pageIds = pageMcqs.map(m => m.id);
        const { data: linksData, error: linksError } = await supabase
          .from('mcq_category_links')
          .select('mcq_id, category_id')
          .in('mcq_id', pageIds);
        if (linksError) throw linksError;
        pageLinks = linksData || [];
      }

      const categoryNameMap = new Map(categories.map(cat => [cat.id, cat.name]));
      const mcqLinksMap = new Map<string, DbMcqCategoryLink[]>();
      pageLinks.forEach(link => {
        if (!mcqLinksMap.has(link.mcq_id)) mcqLinksMap.set(link.mcq_id, []);
        mcqLinksMap.get(link.mcq_id)?.push(link);
      });

      const displayMcqs: DisplayMCQ[] = pageMcqs.map((mcq: any) => {
        const linksForMcq = mcqLinksMap.get(mcq.id) || [];
        const hydratedLinks = linksForMcq.map(link => ({
          category_id: link.category_id,
          category_name: categoryNameMap.get(link.category_id) || null,
        }));
        return { ...mcq, category_links: hydratedLinks };
      });

      setRawMcqs(displayMcqs);
      setServerPage(page);
    } catch (error: any) {
      console.error('[ManageMcqsPage] Error fetching MCQs:', error.message);
      toast({ title: "Error", description: "Failed to load MCQs.", variant: "destructive" });
    } finally {
      setIsFetchingMcqs(false);
    }
  };

  useEffect(() => {
    if (!hasCheckedInitialSession) return;

    if (categories.length > 0) {
      setIsPageLoading(false);
      return;
    }

    fetchCategories().then(() => setIsPageLoading(false));
  }, [hasCheckedInitialSession, categories.length]);

  const filteredMcqs = useMemo(() => {
    let result = rawMcqs;

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      result = result.filter((mcq) =>
        [
          mcq.question_text,
          mcq.option_a,
          mcq.option_b,
          mcq.option_c,
          mcq.option_d,
        ]
          .filter(Boolean)
          .some((text) => text.toLowerCase().includes(q))
      );
    }

    if (enhancementFilter === 'enhanced') {
      result = result.filter(mcq => !!mcq.difficulty);
    } else if (enhancementFilter === 'unenhanced') {
      result = result.filter(mcq => !mcq.difficulty);
    }

    return result;
  }, [rawMcqs, searchTerm, enhancementFilter]);

  const handleDeleteMcq = async (mcqId: string, explanationId: string | null) => {
    if (!window.confirm("Are you sure you want to delete this MCQ?")) return;
    try {
      await supabase.from('mcq_category_links').delete().eq('mcq_id', mcqId);
      const { error: mcqError } = await supabase.from('mcqs').delete().eq('id', mcqId);
      if (mcqError) throw mcqError;
      if (explanationId) await supabase.from('mcq_explanations').delete().eq('id', explanationId);
      toast({ title: "Success!", description: "MCQ deleted successfully." });
      fetchMcqs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSingleEnhance = async (mcqId: string) => {
    setIsProcessing(true);
    const activeToastId = showLoading(`Optimizing clinical scenario with AI...`);

    try {
      const { data, error } = await supabase.functions.invoke('bulk-enhance-mcqs', {
        body: { mcq_ids: [mcqId] },
      });

      if (error || data?.errorCount > 0) {
        updateLoading(activeToastId, `Clinical optimization failed for this question.`, 'error');
      } else {
        updateLoading(activeToastId, `Question successfully enhanced with clinical pearls.`, 'success');
        fetchMcqs();
        fetchCategories();
      }
    } catch (error: any) {
      updateLoading(activeToastId, `Error: \${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => dismissToast(activeToastId), 3000);
    }
  };

  const handleMarkAsEnhanced = async (mcqId: string) => {
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('mcqs')
        .update({ difficulty: 'Medium' })
        .eq('id', mcqId);

      if (error) throw error;
      toast({ title: "Updated", description: "Question marked as enhanced." });
      fetchMcqs();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBulkMarkAsEnhanced = async () => {
    const selectedIndices = Object.keys(rowSelection);
    const selectedMcqIds = selectedIndices.map(index => filteredMcqs[parseInt(index)].id);

    if (selectedMcqIds.length === 0) return;
    if (!window.confirm(`Mark \${selectedMcqIds.length} questions as enhanced?`)) return;

    setIsProcessing(true);
    const activeToastId = showLoading(`Updating \${selectedMcqIds.length} questions...`);

    try {
      const { error } = await supabase
        .from('mcqs')
        .update({ difficulty: 'Medium' })
        .in('id', selectedMcqIds);

      if (error) throw error;
      
      updateLoading(activeToastId, `Successfully marked \${selectedMcqIds.length} items as enhanced.`, 'success');
      setRowSelection({});
      fetchMcqs();
    } catch (error: any) {
      updateLoading(activeToastId, `Failed to update: \${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => dismissToast(activeToastId), 3000);
    }
  };

  const handleBulkEnhance = async () => {
    const selectedIndices = Object.keys(rowSelection);
    const selectedMcqIds = selectedIndices.map(index => filteredMcqs[parseInt(index)].id);

    if (selectedMcqIds.length === 0) {
      toast({ title: "No MCQs Selected", variant: "destructive" });
      return;
    }

    if (!window.confirm(`Optimize \${selectedMcqIds.length} MCQs one-by-one?`)) return;

    setIsProcessing(true);
    let successCount = 0;
    let errorCount = 0;
    
    const activeToastId = showLoading(`Initializing AI optimization for \${selectedMcqIds.length} scenarios...`);

    try {
      for (let i = 0; i < selectedMcqIds.length; i++) {
        const currentId = selectedMcqIds[i];
        updateLoading(activeToastId, `AI Optimizing scenario \${i + 1} of \${selectedMcqIds.length}...`);

        try {
          const { data, error } = await supabase.functions.invoke('bulk-enhance-mcqs', {
            body: { mcq_ids: [currentId] },
          });

          if (error || data?.errorCount > 0) {
            errorCount++;
          } else {
            successCount++;
          }
        } catch (e) {
          console.error(`Error enhancing MCQ \${currentId}:`, e);
          errorCount++;
        }
      }

      if (errorCount > 0) {
        updateLoading(activeToastId, `Optimization complete. Successfully updated \${successCount} items. \${errorCount} failed.`, 'error');
      } else {
        updateLoading(activeToastId, `Successfully optimized all \${successCount} scenarios with clinical AI insights.`, 'success');
      }

      setRowSelection({});
      setTimeout(() => fetchMcqs(), 500);
      fetchCategories();
    } catch (error: any) {
      updateLoading(activeToastId, `Enhancement Interrupted: \${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => dismissToast(activeToastId), 5000);
    }
  };

  const handleBulkDelete = async () => {
    const selectedIndices = Object.keys(rowSelection);
    const selectedMcqs = selectedIndices
      .map(index => filteredMcqs[parseInt(index)])
      .filter(Boolean);

    const selectedMcqIds = selectedMcqs.map(mcq => mcq.id);
    const explanationIds = selectedMcqs
      .map(mcq => mcq.explanation_id)
      .filter((id): id is string => Boolean(id));

    if (selectedMcqIds.length === 0) {
      toast({ title: "No MCQs Selected", variant: "destructive" });
      return;
    }

    if (!window.confirm(`Delete \${selectedMcqIds.length} selected MCQ(s)? This action cannot be undone.`)) return;

    setIsProcessing(true);
    const activeToastId = showLoading(`Deleting \${selectedMcqIds.length} selected MCQ(s)...`);

    try {
      const { error: linksError } = await supabase
        .from('mcq_category_links')
        .delete()
        .in('mcq_id', selectedMcqIds);

      if (linksError) throw linksError;

      const { error: mcqError } = await supabase
        .from('mcqs')
        .delete()
        .in('id', selectedMcqIds);

      if (mcqError) throw mcqError;

      if (explanationIds.length > 0) {
        const { error: explanationError } = await supabase
          .from('mcq_explanations')
          .delete()
          .in('id', explanationIds);

        if (explanationError) throw explanationError;
      }

      updateLoading(activeToastId, `Deleted \${selectedMcqIds.length} selected MCQ(s).`, 'success');
      setRowSelection({});
      await fetchMcqs();
      await fetchCategories();
    } catch (error: any) {
      updateLoading(activeToastId, `Failed to delete selected MCQs: \${error.message}`, 'error');
    } finally {
      setIsProcessing(false);
      setTimeout(() => dismissToast(activeToastId), 3000);
    }
  };

  const handleEditClick = (mcq: MCQ) => {
    setSelectedMcqForEdit(mcq);
    setIsEditDialogOpen(true);
  };

  const columns = useMemo(() => createMcqColumns({ 
    onDelete: handleDeleteMcq, 
    onEdit: handleEditClick,
    onEnhance: handleSingleEnhance,
    onMarkEnhanced: handleMarkAsEnhanced
  }), [categories, rawMcqs]);

  if (!hasCheckedInitialSession || isPageLoading) return <LoadingBar />;

  const numSelected = Object.keys(rowSelection).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          Manage MCQs
          {!isPageLoading && totalGlobalCount > 0 && (
            <Badge variant="secondary" className="h-7 px-3 text-sm font-black bg-primary/10 text-primary border-none rounded-full">
              {totalGlobalCount} Total
            </Badge>
          )}
        </h1>
      </div>

      <Card className="border-primary/20 shadow-lg">
        <CardHeader className="bg-primary/5 border-b pb-4">
          <CardTitle className="text-xl flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" /> Audit Filter Configuration
          </CardTitle>
          <CardDescription>Select a specialty and optional search terms, then click "Apply Filters" to load the question set.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
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
              <Label htmlFor="search-term">Search Keywords</Label>
              <Input 
                id="search-term" 
                placeholder="Keywords..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-1.5 flex-1">
              <Label htmlFor="enhancementStatus">AI Status</Label>
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
                onClick={() => fetchMcqs(0)}
                className="h-11 rounded-xl font-bold bg-primary text-primary-foreground"
                disabled={isFetchingMcqs || !selectedFilterCategory}
            >
                {isFetchingMcqs ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />} 
                Apply Filters
            </Button>

            <Button 
                onClick={() => { setSelectedFilterCategory(null); setSearchTerm(''); setEnhancementFilter('all'); setRawMcqs([]); setServerPage(0); setServerTotalCount(0); }}
                variant="outline" 
                className="h-11 rounded-xl"
            >
                Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {!selectedFilterCategory || (rawMcqs.length === 0 && !isFetchingMcqs) ? (
        <Card className="py-20 text-center rounded-3xl border-2 border-dashed bg-muted/20">
            <div className="max-w-md mx-auto space-y-4">
                <div className="p-4 bg-white rounded-full w-fit mx-auto shadow-sm">
                    {isFetchingMcqs ? <Loader2 className="h-10 w-10 animate-spin text-primary" /> : <LayoutList className="h-10 w-10 text-primary/30" />}
                </div>
                <div>
                    <h3 className="text-lg font-bold">{isFetchingMcqs ? "Loading Clinical Data..." : "Question List Ready"}</h3>
                    <p className="text-muted-foreground text-sm">
                        {isFetchingMcqs 
                            ? "Please wait while we sync with the medical database." 
                            : "Configure your specialty and keywords above, then click 'Apply Filters' to start managing scenarios."}
                    </p>
                    {!isFetchingMcqs && totalGlobalCount > 0 && (
                      <div className="flex items-center justify-center gap-2 mt-4 text-primary font-black uppercase tracking-widest text-[10px]">
                        <Database className="h-3 w-3" /> {totalGlobalCount} Questions in Database
                      </div>
                    )}
                </div>
            </div>
        </Card>
      ) : (
        <div className="space-y-6 animate-in fade-in duration-500">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-4">
                    <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                            {filteredMcqs.length} Questions Loaded
                        </CardTitle>
                        <CardDescription>Filtering specialty: {categories.find(c => c.id === selectedFilterCategory)?.name || 'Custom selection'}</CardDescription>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                        <Button
                          variant="destructive"
                          onClick={handleBulkDelete}
                          disabled={isProcessing || numSelected === 0}
                          className="rounded-xl font-bold"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({numSelected})
                        </Button>
                        <Button variant="outline" onClick={handleBulkMarkAsEnhanced} disabled={isProcessing || numSelected === 0} className="rounded-xl font-bold border-green-600 text-green-700 hover:bg-green-50">
                            <CheckCircle className="mr-2 h-4 w-4" /> Mark Selected Enhanced ({numSelected})
                        </Button>
                        <Button onClick={handleBulkEnhance} disabled={isProcessing || numSelected === 0} className="rounded-xl font-bold">
                            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                            Bulk AI Optimize ({numSelected})
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                    <DataTable
                        columns={columns}
                        data={filteredMcqs}
                        rowSelection={rowSelection}
                        setRowSelection={setRowSelection}
                        pageSize={100}
                    />
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Server Page {serverPage + 1} / {Math.max(1, Math.ceil(serverTotalCount / serverPageSize))} · {serverTotalCount} total
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={() => fetchMcqs(serverPage - 1)}
                          disabled={isFetchingMcqs || serverPage === 0}
                        >
                          Previous Batch
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => fetchMcqs(serverPage + 1)}
                          disabled={isFetchingMcqs || (serverPage + 1) * serverPageSize >= serverTotalCount}
                        >
                          Next Batch
                        </Button>
                      </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      )}

      {selectedMcqForEdit && (
        <EditMcqDialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} mcq={selectedMcqForEdit} onSave={fetchMcqs} />
      )}
    </div>
  );
};

export default ManageMcqsPage;