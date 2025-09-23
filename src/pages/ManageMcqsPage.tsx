"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { createMcqColumns, MCQ } from '@/components/mcq-columns';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import EditMcqDialog from '@/components/EditMcqDialog'; // Import the new dialog
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // For filtering
import { Label } from '@/components/ui/label';

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

// Extend MCQ type for display purposes to include category/subcategory names
type DisplayMCQ = MCQ & {
  category_name: string | null;
  subcategory_name: string | null;
};

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


  const fetchCategoriesAndSubcategories = async () => {
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');
    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories for filter.", variant: "destructive" });
    } else {
      setCategories(categoriesData || []);
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
        categories (name),
        subcategories (name)
      `);

    if (selectedFilterCategory) {
      query = query.eq('category_id', selectedFilterCategory);
    }
    if (selectedFilterSubcategory) {
      query = query.eq('subcategory_id', selectedFilterSubcategory);
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
        category_name: mcq.categories?.name || null,
        subcategory_name: mcq.subcategories?.name || null,
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
  }, [selectedFilterCategory, selectedFilterSubcategory]); // Refetch when filters change

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
      // Delete the MCQ first
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
    } catch (error: any) {
      console.error("Error deleting MCQ:", error);
      toast({
        title: "Error",
        description: `Failed to delete MCQ: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const handleEditClick = (mcq: MCQ) => {
    setSelectedMcqForEdit(mcq);
    setIsEditDialogOpen(true);
  };

  const columns = createMcqColumns({ onDelete: handleDeleteMcq, onEdit: handleEditClick }); // Pass onEdit

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage MCQs</h1>

      <Card>
        <CardHeader>
          <CardTitle>Filter MCQs</CardTitle>
          <CardDescription>Filter MCQs by category and subcategory.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Label htmlFor="filterCategory">Category</Label>
            <Select onValueChange={(value) => setSelectedFilterCategory(value === "all" ? null : value)} value={selectedFilterCategory || "all"}>
              <SelectTrigger id="filterCategory">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
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
          <Button onClick={() => { setSelectedFilterCategory(null); setSelectedFilterSubcategory(null); }} variant="outline" className="self-end">Clear Filters</Button>
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