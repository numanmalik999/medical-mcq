"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { createMcqColumns, MCQ } from '@/components/mcq-columns'; // Removed McqCategoryLink import
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import EditMcqDialog from '@/components/EditMcqDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input'; // Import Input component
import { Trash2 } from 'lucide-react'; // Import Trash2 icon

interface Category {
  id: string;
  name: string;
  mcq_count?: number; // Added mcq_count
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

// DisplayMCQ is now the same as MCQ as category_links contains display names
type DisplayMCQ = MCQ;

const ManageMcqsPage = () => {
  const [mcqs, setMcqs] = useState<DisplayMCQ[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedMcqForEdit, setSelectedMcqForEdit] = useState<MCQ | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string | null>(null);
  const [selectedFilterSubcategory, setSelectedFilterSubcategory] = useState<string | null>(null);
  const [filteredSubcategoriesForFilter, setFilteredSubcategoriesForFilter] = useState<Subcategory[]>([]);
  const [searchTerm, setSearchTerm] = useState(''); // New state for search term


  const fetchCategoriesAndSubcategories = async () => {
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');
    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories for filter.", variant: "destructive" });
    } else {
      // Fetch MCQ counts for each category
      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count, error: mcqCountError } = await supabase
            .from('mcq_category_links') // Count from the join table
            .select('id', { count: 'exact', head: true })
            .eq('category_id', category.id);

          if (mcqCountError) {
            console.error(`Error fetching MCQ count for category ${category.name}:`, mcqCountError);
          }
          return { ...category, mcq_count: count || 0 };
        })
      );
      setCategories(categoriesWithCounts);
    }

    const { data: subcategoriesData, error: subcategoriesError } = await supabase
      .from('subcategories')
      .select('*');
    if (subcategoriesError) {
      console.error('Error fetching subcategories:', subcategoriesError);
      toast({ title: "Error", description: "Failed to load subcategories for filter.", variant: "destructive" });
    } else {
      setSubcategories(subcategoriesData || []);
    }
  };

  const fetchMcqs = async () => {
    setIsLoading(true);
    let query = supabase
      .from('mcqs')
      .select(`
        *,
        mcq_category_links (
          category_id,
          subcategory_id,
          categories (name),
          subcategories (name)
        )
      `);

    // Filtering logic for multi-category system
    if (selectedFilterCategory) {
      const { data: mcqLinksData, error: mcqLinksError } = await supabase
        .from('mcq_category_links')
        .select('mcq_id')
        .eq('category_id', selectedFilterCategory)
        .filter('subcategory_id', selectedFilterSubcategory ? 'eq' : 'neq', selectedFilterSubcategory || 'null'); // Adjust for subcategory filter

      if (mcqLinksError) {
        console.error('Error fetching MCQ links for category filter:', mcqLinksError);
        setMcqs([]);
        setIsLoading(false);
        return;
      }
      const mcqIds = mcqLinksData?.map(link => link.mcq_id) || [];
      query = query.in('id', mcqIds);
    } else if (selectedFilterSubcategory) { // If only subcategory is selected, filter by it
      const { data: mcqLinksData, error: mcqLinksError } = await supabase
        .from('mcq_category_links')
        .select('mcq_id')
        .eq('subcategory_id', selectedFilterSubcategory);

      if (mcqLinksError) {
        console.error('Error fetching MCQ links for subcategory filter:', mcqLinksError);
        setMcqs([]);
        setIsLoading(false);
        return;
      }
      const mcqIds = mcqLinksData?.map(link => link.mcq_id) || [];
      query = query.in('id', mcqIds);
    }

    if (searchTerm) { // Apply search filter
      query = query.ilike('question_text', `%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching MCQs:', error);
      toast({
        title: "Error",
        description: "Failed to load MCQs. Please try again.",
        variant: "destructive",
      });
      setMcqs([]);
    } else {
      const displayMcqs: DisplayMCQ[] = data.map((mcq: any) => ({
        ...mcq,
        category_links: mcq.mcq_category_links.map((link: any) => ({
          category_id: link.category_id,
          category_name: link.categories?.name || null,
          subcategory_id: link.subcategory_id,
          subcategory_name: link.subcategories?.name || null,
        })),
      }));
      setMcqs(displayMcqs || []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCategoriesAndSubcategories();
  }, []);

  useEffect(() => {
    fetchMcqs();
  }, [selectedFilterCategory, selectedFilterSubcategory, searchTerm]); // Refetch when filters or search term change

  useEffect(() => {
    if (selectedFilterCategory) {
      setFilteredSubcategoriesForFilter(subcategories.filter(sub => sub.category_id === selectedFilterCategory));
    } else {
      setFilteredSubcategoriesForFilter([]);
      setSelectedFilterSubcategory(null); // Clear subcategory filter if category is unselected
    }
  }, [selectedFilterCategory, subcategories]);


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
      fetchCategoriesAndSubcategories(); // Refresh counts
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

    setIsLoading(true);
    try {
      // Fetch all MCQ IDs and their explanation IDs linked to the selected category
      const { data: linksToDelete, error: fetchLinksError } = await supabase
        .from('mcq_category_links')
        .select('mcq_id')
        .eq('category_id', selectedFilterCategory);

      if (fetchLinksError) {
        throw fetchLinksError;
      }

      const mcqIdsToDelete = Array.from(new Set(linksToDelete?.map(link => link.mcq_id) || []));

      if (mcqIdsToDelete.length === 0) {
        toast({ title: "Info", description: `No MCQs found linked to "${categoryName}" to delete.`, variant: "default" });
        setIsLoading(false);
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

      // Delete category links first
      const { error: deleteLinksError } = await supabase
        .from('mcq_category_links')
        .delete()
        .in('mcq_id', mcqIdsToDelete)
        .eq('category_id', selectedFilterCategory); // Ensure only links for this category are deleted

      if (deleteLinksError) {
        console.warn("Error deleting some category links:", deleteLinksError);
      }

      // Delete explanations
      if (explanationIdsToDelete.length > 0) {
        const { error: deleteExplanationsError } = await supabase
          .from('mcq_explanations')
          .delete()
          .in('id', explanationIdsToDelete);

        if (deleteExplanationsError) {
          console.warn("Error deleting some explanations:", deleteExplanationsError);
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
      fetchCategoriesAndSubcategories(); // Refresh counts
      setSelectedFilterCategory(null); // Clear filter after mass deletion
    } catch (error: any) {
      console.error("Error deleting all MCQs in category:", error);
      toast({
        title: "Error",
        description: `Failed to delete MCQs in category: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditClick = (mcq: MCQ) => {
    setSelectedMcqForEdit(mcq);
    setIsEditDialogOpen(true);
  };

  const columns = createMcqColumns({ onDelete: handleDeleteMcq, onEdit: handleEditClick });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage MCQs</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filter MCQs</CardTitle>
          <CardDescription>Filter MCQs by category, subcategory, or search by question text.</CardDescription>
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
            <div className="flex-1">
              <Label htmlFor="filterSubcategory">Subcategory</Label>
              <Select onValueChange={(value) => setSelectedFilterSubcategory(value === "all" ? null : value)} value={selectedFilterSubcategory || "all"} disabled={!selectedFilterCategory || filteredSubcategoriesForFilter.length === 0}>
                <SelectTrigger id="filterSubcategory">
                  <SelectValue placeholder="Select subcategory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subcategories</SelectItem>
                  {filteredSubcategoriesForFilter.map((subcat) => (
                    <SelectItem key={subcat.id} value={subcat.id}>{subcat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button onClick={() => { setSelectedFilterCategory(null); setSelectedFilterSubcategory(null); setSearchTerm(''); }} variant="outline">Clear Filters</Button>
            <Button
              onClick={handleDeleteAllMcqsInCategory}
              variant="destructive"
              disabled={!selectedFilterCategory || isLoading}
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
          {isLoading ? (
            <p className="text-center text-gray-600 dark:text-gray-400">Loading MCQs...</p>
          ) : (
            <DataTable columns={columns} data={mcqs} />
          )}
          {!isLoading && mcqs.length === 0 && (
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