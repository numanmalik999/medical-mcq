"use client";

import { useEffect, useState, useMemo } from 'react'; // Import useMemo
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
import { Trash2 } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider'; // Import useSession

interface Category {
  id: string;
  name: string;
  mcq_count?: number;
}

// Define a type for a single MCQ-Category link from the database
interface DbMcqCategoryLink {
  mcq_id: string;
  category_id: string;
}

type DisplayMCQ = MCQ;

const UNCATEGORIZED_ID = 'uncategorized-mcqs-virtual-id'; // Unique ID for the virtual uncategorized category

const ManageMcqsPage = () => {
  const [rawMcqs, setRawMcqs] = useState<DisplayMCQ[]>([]); // Store raw fetched MCQs
  const [isPageLoading, setIsPageLoading] = useState(true);
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMcqForEdit, setSelectedMcqForEdit] = useState<MCQ | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { hasCheckedInitialSession } = useSession();

  const fetchCategories = async () => {
    console.log('[ManageMcqsPage] Fetching categories...');
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');
    if (categoriesError) {
      console.error('[ManageMcqsPage] Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories for filter.", variant: "destructive" });
    } else {
      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
          // Count MCQs by querying mcq_category_links table directly
          const { count: mcqCount, error: mcqCountError } = await supabase
            .from('mcq_category_links')
            .select('mcq_id', { count: 'exact', head: true })
            .eq('category_id', category.id);

          if (mcqCountError) {
            console.error(`[ManageMcqsPage] Error fetching MCQ count for category ${category.name}:`, mcqCountError);
          } else {
            const { data: linkedMcqIds, error: linkedIdsError } = await supabase
              .from('mcq_category_links')
              .select('mcq_id')
              .eq('category_id', category.id);
            if (linkedIdsError) {
              console.error(`[ManageMcqsPage] Error fetching sample linked MCQ IDs for category ${category.name}:`, linkedIdsError);
            }
            console.log(`[ManageMcqsPage] Category "${category.name}" (${category.id}) has ${mcqCount} links. Sample linked MCQ IDs:`, linkedMcqIds?.slice(0, 5).map((l:any) => l.mcq_id));
          }
          return { ...category, mcq_count: mcqCount || 0 };
        })
      );

      // Calculate count for Uncategorized MCQs
      console.log('[ManageMcqsPage] Calculating uncategorized MCQ count...');
      const { data: allLinkedMcqIdsData, error: linkedMcqIdsError } = await supabase
        .from('mcq_category_links')
        .select('mcq_id');

      if (linkedMcqIdsError) {
        console.error('[ManageMcqsPage] Error fetching all linked MCQ IDs for uncategorized count:', linkedMcqIdsError);
      }
      const uniqueLinkedMcqIds = new Set(allLinkedMcqIdsData?.map(link => link.mcq_id) || []);
      console.log(`[ManageMcqsPage] Total unique linked MCQ IDs: ${uniqueLinkedMcqIds.size}`);

      const { count: totalMcqCount, error: totalMcqCountError } = await supabase
        .from('mcqs')
        .select('id', { count: 'exact', head: true });

      if (totalMcqCountError) {
        console.error('[ManageMcqsPage] Error fetching total MCQ count for uncategorized:', totalMcqCountError);
      }
      console.log(`[ManageMcqsPage] Total MCQs in 'mcqs' table: ${totalMcqCount}`);

      const uncategorizedMcqCount = (totalMcqCount || 0) - uniqueLinkedMcqIds.size;
      console.log(`[ManageMcqsPage] Calculated uncategorized MCQ count: ${uncategorizedMcqCount}`);

      setCategories([...categoriesWithCounts, { id: UNCATEGORIZED_ID, name: 'Uncategorized', mcq_count: Math.max(0, uncategorizedMcqCount) }]);
    }
  };

  const fetchMcqs = async () => {
    setIsPageLoading(true);
    console.log(`[ManageMcqsPage] STARTING PAGINATED DATA FETCH with search term: ${searchTerm}`);

    let allMcqs: any[] = [];
    let allMcqCategoryLinks: DbMcqCategoryLink[] = [];
    const limit = 1000; // Fetch 1000 records at a time

    // --- Fetch all MCQs (paginated) ---
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

      console.log(`[ManageMcqsPage] Executing MCQs query for range ${offsetMcqs}-${offsetMcqs + limit - 1}...`);
      const { data: mcqsData, error: mcqsError } = await mcqsQuery;

      if (mcqsError) {
        console.error('[ManageMcqsPage] Error fetching MCQs during pagination:', mcqsError.message, mcqsError.details, mcqsError.hint);
        toast({ title: "Error", description: "Failed to load MCQs. Please try again.", variant: "destructive" });
        setRawMcqs([]);
        setIsPageLoading(false);
        return;
      }

      if (mcqsData && mcqsData.length > 0) {
        allMcqs = allMcqs.concat(mcqsData);
        offsetMcqs += mcqsData.length;
        hasMoreMcqs = mcqsData.length === limit;
        console.log(`[ManageMcqsPage] Fetched ${mcqsData.length} MCQs. Total MCQs so far: ${allMcqs.length}. Has more MCQs: ${hasMoreMcqs}`);
      } else {
        hasMoreMcqs = false;
      }
    }
    console.log('[ManageMcqsPage] All MCQs fetched. Total:', allMcqs.length);

    // --- Fetch all MCQ category links (paginated) ---
    let offsetLinks = 0;
    let hasMoreLinks = true;
    while (hasMoreLinks) {
      const { data: mcqCategoryLinksData, error: mcqCategoryLinksError } = await supabase
        .from('mcq_category_links')
        .select('mcq_id, category_id')
        .range(offsetLinks, offsetLinks + limit - 1);

      if (mcqCategoryLinksError) {
        console.error('[ManageMcqsPage] Error fetching MCQ category links during pagination:', mcqCategoryLinksError);
        toast({ title: "Error", description: "Failed to load MCQ category links. Please try again.", variant: "destructive" });
        setRawMcqs([]);
        setIsPageLoading(false);
        return;
      }

      if (mcqCategoryLinksData && mcqCategoryLinksData.length > 0) {
        allMcqCategoryLinks = allMcqCategoryLinks.concat(mcqCategoryLinksData);
        offsetLinks += mcqCategoryLinksData.length;
        hasMoreLinks = mcqCategoryLinksData.length === limit;
        console.log(`[ManageMcqsPage] Fetched ${mcqCategoryLinksData.length} links. Total links so far: ${allMcqCategoryLinks.length}. Has more links: ${hasMoreLinks}`);
      } else {
        hasMoreLinks = false;
      }
    }
    console.log('[ManageMcqsPage] All MCQ category links fetched. Total:', allMcqCategoryLinks.length);

    // 3. Hydrate MCQs with category names on the client side
    const categoryNameMap = new Map(categories.map(cat => [cat.id, cat.name]));
    console.log('[ManageMcqsPage] categoryNameMap:', categoryNameMap);

    const mcqLinksMap = new Map<string, DbMcqCategoryLink[]>();
    allMcqCategoryLinks.forEach(link => { // Use allMcqCategoryLinks here
      if (!mcqLinksMap.has(link.mcq_id)) {
        mcqLinksMap.set(link.mcq_id, []);
      }
      mcqLinksMap.get(link.mcq_id)?.push(link);
    });
    console.log('[ManageMcqsPage] mcqLinksMap (first 5 entries):', Array.from(mcqLinksMap.entries()).slice(0, 5));

    const displayMcqs: DisplayMCQ[] = (allMcqs || []).map((mcq: any) => { // Use allMcqs here
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
    console.log(`[ManageMcqsPage] Successfully fetched and hydrated ${displayMcqs.length} MCQs. First 5 hydrated MCQs:`, displayMcqs.slice(0, 5));
    setRawMcqs(displayMcqs || []);
    setIsPageLoading(false);
  };

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchCategories();
    }
  }, [hasCheckedInitialSession]);

  useEffect(() => {
    // Only fetch MCQs if categories are loaded (or if there are no categories to load)
    // and initial session check is done.
    if (hasCheckedInitialSession && (categories.length > 0 || (categories.length === 0 && !isPageLoading))) {
      fetchMcqs();
    }
  }, [searchTerm, hasCheckedInitialSession, categories]); // Re-run when categories change

  // Client-side filtering based on selectedFilterCategory
  const filteredMcqs = useMemo(() => {
    console.log('[filteredMcqs Memo] Recalculating...'); // Added log
    console.log('[filteredMcqs Memo] rawMcqs length:', rawMcqs.length); // Added log
    console.log('[filteredMcqs Memo] selectedFilterCategory:', selectedFilterCategory); // Added log

    if (!selectedFilterCategory || selectedFilterCategory === "all") {
      console.log('[filteredMcqs Memo] Returning all rawMcqs.'); // Added log
      return rawMcqs;
    }

    if (selectedFilterCategory === UNCATEGORIZED_ID) {
      const result = rawMcqs.filter(mcq => mcq.category_links.length === 0);
      console.log('[filteredMcqs Memo] Filtering for UNCATEGORIZED_ID. Result length:', result.length); // Added log
      return result;
    }

    const result = rawMcqs.filter(mcq =>
      mcq.category_links.some(link => link.category_id === selectedFilterCategory)
    );
    console.log(`[filteredMcqs Memo] Filtering for category ID "${selectedFilterCategory}". Result length:`, result.length); // Added log
    // Log a sample of filtered MCQs to inspect their category_links
    if (result.length > 0) {
      console.log('[filteredMcqs Memo] First filtered MCQ category_links:', result[0].category_links); // Added log
    }
    console.log('[filteredMcqs Memo] Final filteredMcqs length:', result.length); // ADDED LOG
    return result;
  }, [rawMcqs, selectedFilterCategory]);

  const handleDeleteMcq = async (mcqId: string, explanationId: string | null) => {
    if (!window.confirm("Are you sure you want to delete this MCQ? This action cannot be undone.")) {
      return;
    }

    try {
      // Delete associated links first
      const { error: linksError } = await supabase
        .from('mcq_category_links')
        .delete()
        .eq('mcq_id', mcqId);

      if (linksError) {
        console.warn("Could not delete associated category links:", linksError);
        // Continue with MCQ deletion even if links fail
      }

      // Delete the MCQ
      const { error: mcqError } = await supabase
        .from('mcqs')
        .delete()
        .eq('id', mcqId);

      if (mcqError) {
        throw mcqError;
      }

      // If there's an associated explanation, delete it too
      if (explanationId) {
        const { error: explanationError } = await supabase
          .from('mcq_explanations')
          .delete()
          .eq('id', explanationId);

        if (explanationError) {
          console.warn("Could not delete associated explanation:", explanationError);
          // We don't throw here as the MCQ itself was deleted successfully
        }
      }

      toast({
        title: "Success!",
        description: "MCQ deleted successfully.",
      });
      fetchMcqs(); // Refresh the list
      fetchCategories(); // Refresh counts
    } catch (error: any) {
      console.error("Error deleting MCQ:", error);
      toast({
        title: "Error",
        description: `Failed to delete MCQ: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAllMcqsInCategory = async () => {
    if (!selectedFilterCategory) {
      toast({ title: "Error", description: "Please select a category to delete all MCQs from.", variant: "destructive" });
      return;
    }

    const categoryName = categories.find(cat => cat.id === selectedFilterCategory)?.name || 'Selected Category';

    if (!window.confirm(`Are you absolutely sure you want to delete ALL MCQs and their explanations linked to the "${categoryName}" category? This action cannot be undone.`)) {
      return;
    }

    setIsPageLoading(true);
    try {
      let mcqIdsToDelete: string[] = [];

      if (selectedFilterCategory === UNCATEGORIZED_ID) {
        // Get all categorized MCQ IDs
        const { data: categorizedMcqLinks, error: linksError } = await supabase
          .from('mcq_category_links')
          .select('mcq_id');

        if (linksError) {
          throw linksError;
        }
        const categorizedMcqIds = Array.from(new Set(categorizedMcqLinks?.map(link => link.mcq_id) || []));

        // Get all MCQs that are NOT in the categorized list
        const { data: uncategorizedMcqs, error: uncategorizedError } = await supabase
          .from('mcqs')
          .select('id')
          .not('id', 'in', `(${categorizedMcqIds.join(',')})`);

        if (uncategorizedError) {
          throw uncategorizedError;
        }
        mcqIdsToDelete = uncategorizedMcqs?.map(mcq => mcq.id) || [];

      } else {
        // First, get all mcq_ids that are linked to this category
        const { data: mcqLinksData, error: fetchLinksError } = await supabase
          .from('mcq_category_links')
          .select('mcq_id')
          .eq('category_id', selectedFilterCategory);

        if (fetchLinksError) {
          throw fetchLinksError;
        }
        mcqIdsToDelete = Array.from(new Set(mcqLinksData?.map(link => link.mcq_id) || []));
      }

      if (mcqIdsToDelete.length === 0) {
        toast({ title: "Info", description: `No MCQs found linked to "${categoryName}" to delete.`, variant: "default" });
        setIsPageLoading(false);
        return;
      }

      // Fetch explanation IDs for these MCQs
      const { data: mcqsWithExplanations, error: fetchMcqsError } = await supabase
        .from('mcqs')
        .select('id, explanation_id')
        .in('id', mcqIdsToDelete);

      if (fetchMcqsError) {
        throw fetchMcqsError;
      }

      const explanationIdsToDelete = mcqsWithExplanations
        .map(mcq => mcq.explanation_id)
        .filter((id): id is string => id !== null);

      // Delete category links first (only for actual categories)
      if (selectedFilterCategory !== UNCATEGORIZED_ID) {
        const { error: deleteLinksError } = await supabase
          .from('mcq_category_links')
          .delete()
          .in('mcq_id', mcqIdsToDelete) // Delete all links for these MCQs
          .eq('category_id', selectedFilterCategory); // And specifically for this category

        if (deleteLinksError) {
          console.warn("Error deleting some category links:", deleteLinksError);
        }
      }

      // Delete explanations
      if (explanationIdsToDelete.length > 0) {
        const { error: deleteExplanationsError } = await supabase
          .from('mcq_explanations')
          .delete()
          .in('id', explanationIdsToDelete);

        if (deleteExplanationsError) {
          console.warn("Could not delete some explanations:", explanationIdsToDelete);
        }
      }

      // Delete MCQs
      const { error: deleteMcqsError } = await supabase
        .from('mcqs')
        .delete()
        .in('id', mcqIdsToDelete);

      if (deleteMcqsError) {
        throw deleteMcqsError;
      }

      toast({
        title: "Success!",
        description: `All ${mcqIdsToDelete.length} MCQs and their explanations linked to "${categoryName}" have been deleted.`,
      });
      fetchMcqs(); // Refresh the list
      fetchCategories(); // Refresh counts
      setSelectedFilterCategory(null); // Clear filter after mass deletion
    } catch (error: any) {
      console.error("Error deleting all MCQs in category:", error);
      toast({
        title: "Error",
        description: `Failed to delete MCQs in category: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsPageLoading(false);
    }
  };

  const handleEditClick = (mcq: MCQ) => {
    setSelectedMcqForEdit(mcq);
    setIsEditDialogOpen(true);
  };

  const columns = createMcqColumns({ onDelete: handleDeleteMcq, onEdit: handleEditClick });

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading MCQs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage MCQs</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filter MCQs</CardTitle>
          <CardDescription>Filter MCQs by category or search by question text.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex-1">
            <Label htmlFor="search-term">Search Question</Label>
            <Input
              id="search-term"
              placeholder="Search by question text..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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
            <Button
              onClick={handleDeleteAllMcqsInCategory}
              variant="destructive"
              disabled={!selectedFilterCategory || isPageLoading}
              className="flex items-center gap-1"
            >
              <Trash2 className="h-4 w-4" /> Delete All in Category
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Multiple Choice Questions</CardTitle>
          <CardDescription>View, edit, and delete MCQs from your database.</CardDescription>
        </CardHeader>
        <CardContent>
          {isPageLoading ? (
            <p className="text-center text-gray-600 dark:text-gray-400">Loading MCQs...</p>
          ) : (
            <DataTable columns={columns} data={filteredMcqs} />
          )}
          {!isPageLoading && filteredMcqs.length === 0 && (
            <div className="mt-4 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-2">No MCQs found. Add some using the "Add MCQ" link in the sidebar.</p>
              <Button onClick={fetchMcqs}>Refresh List</Button>
            </div>
          )}
        </CardContent>
      </Card>
      <MadeWithDyad />

      {selectedMcqForEdit && (
        <EditMcqDialog
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          mcq={selectedMcqForEdit}
          onSave={fetchMcqs}
        />
      )}
    </div>
  );
};

export default ManageMcqsPage;