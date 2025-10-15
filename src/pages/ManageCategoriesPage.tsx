"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSession } from '@/components/SessionContextProvider'; // Import useSession

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

const ManageCategoriesPage = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true); // New combined loading state

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');

  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  const [currentSubcategory, setCurrentSubcategory] = useState<Subcategory | null>(null);
  const [subcategoryName, setSubcategoryName] = useState('');
  const [selectedCategoryIdForSub, setSelectedCategoryIdForSub] = useState<string | null>(null);

  const { hasCheckedInitialSession } = useSession(); // Get hasCheckedInitialSession

  useEffect(() => {
    if (hasCheckedInitialSession) { // Only fetch if initial session check is done
      fetchCategoriesAndSubcategories();
    }
  }, [hasCheckedInitialSession]); // Dependency changed

  const fetchCategoriesAndSubcategories = async () => {
    setIsPageLoading(true); // Set loading for this specific fetch
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');

    const { data: subcategoriesData, error: subcategoriesError } = await supabase
      .from('subcategories')
      .select('*');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
    } else {
      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count, error: mcqCountError } = await supabase
            .from('mcqs')
            .select('id', { count: 'exact', head: true })
            .eq('category_id', category.id);

          if (mcqCountError) {
            console.error(`Error fetching MCQ count for category ${category.name}:`, mcqCountError);
          }
          return { ...category, mcq_count: count || 0 };
        })
      );
      setCategories(categoriesWithCounts || []);
    }

    if (subcategoriesError) {
      console.error('Error fetching subcategories:', subcategoriesError);
      toast({ title: "Error", description: "Failed to load subcategories.", variant: "destructive" });
    } else {
      setSubcategories(subcategoriesData || []);
    }
    setIsPageLoading(false); // Clear loading for this specific fetch
  };

  // Category Management
  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      toast({ title: "Error", description: "Category name cannot be empty.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from('categories')
        .insert({ name: categoryName.trim() });

      if (error) throw error;
      toast({ title: "Success", description: "Category added successfully." });
      fetchCategoriesAndSubcategories();
      setIsCategoryDialogOpen(false);
      setCategoryName('');
    } catch (error: any) {
      console.error("Error adding category:", error);
      toast({ title: "Error", description: `Failed to add category: ${error.message}`, variant: "destructive" });
    }
  };

  const handleEditCategory = async () => {
    if (!currentCategory || !categoryName.trim()) {
      toast({ title: "Error", description: "Category name cannot be empty.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from('categories')
        .update({ name: categoryName.trim() })
        .eq('id', currentCategory.id);

      if (error) throw error;
      toast({ title: "Success", description: "Category updated successfully." });
      fetchCategoriesAndSubcategories();
      setIsCategoryDialogOpen(false);
      setCategoryName('');
      setCurrentCategory(null);
    } catch (error: any) {
      console.error("Error updating category:", error);
      toast({ title: "Error", description: `Failed to update category: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this category? All associated subcategories will also be deleted.")) {
      return;
    }
    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Category deleted successfully." });
      fetchCategoriesAndSubcategories();
    } catch (error: any) {
      console.error("Error deleting category:", error);
      toast({ title: "Error", description: `Failed to delete category: ${error.message}`, variant: "destructive" });
    }
  };

  const openCategoryDialog = (category?: Category) => {
    setCurrentCategory(category || null);
    setCategoryName(category ? category.name : '');
    setIsCategoryDialogOpen(true);
  };

  // Subcategory Management
  const handleAddSubcategory = async () => {
    if (!subcategoryName.trim() || !selectedCategoryIdForSub) {
      toast({ title: "Error", description: "Subcategory name and category are required.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from('subcategories')
        .insert({ name: subcategoryName.trim(), category_id: selectedCategoryIdForSub });

      if (error) throw error;
      toast({ title: "Success", description: "Subcategory added successfully." });
      fetchCategoriesAndSubcategories();
      setIsSubcategoryDialogOpen(false);
      setSubcategoryName('');
      setSelectedCategoryIdForSub(null);
    } catch (error: any) {
      console.error("Error adding subcategory:", error);
      toast({ title: "Error", description: `Failed to add subcategory: ${error.message}`, variant: "destructive" });
    }
  };

  const handleEditSubcategory = async () => {
    if (!currentSubcategory || !subcategoryName.trim() || !selectedCategoryIdForSub) {
      toast({ title: "Error", description: "Subcategory name and category are required.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from('subcategories')
        .update({ name: subcategoryName.trim(), category_id: selectedCategoryIdForSub })
        .eq('id', currentSubcategory.id);

      if (error) throw error;
      toast({ title: "Success", description: "Subcategory updated successfully." });
      fetchCategoriesAndSubcategories();
      setIsSubcategoryDialogOpen(false);
      setSubcategoryName('');
      setSelectedCategoryIdForSub(null);
      setCurrentSubcategory(null);
    } catch (error: any) {
      console.error("Error updating subcategory:", error);
      toast({ title: "Error", description: `Failed to update subcategory: ${error.message}`, variant: "destructive" });
    }
  };

  const handleDeleteSubcategory = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this subcategory?")) {
      return;
    }
    try {
      const { error } = await supabase
        .from('subcategories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Subcategory deleted successfully." });
      fetchCategoriesAndSubcategories();
    } catch (error: any) {
      console.error("Error deleting subcategory:", error);
      toast({ title: "Error", description: `Failed to delete subcategory: ${error.message}`, variant: "destructive" });
    }
  };

  const openSubcategoryDialog = (subcategory?: Subcategory) => {
    setCurrentSubcategory(subcategory || null);
    setSubcategoryName(subcategory ? subcategory.name : '');
    setSelectedCategoryIdForSub(subcategory ? subcategory.category_id : null);
    setIsSubcategoryDialogOpen(true);
  };

  const categoryColumns: ColumnDef<Category>[] = [
    { 
      accessorKey: 'name', 
      header: 'Category Name',
      cell: ({ row }) => `${row.original.name} (${row.original.mcq_count || 0})`, // Display count here
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openCategoryDialog(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteCategory(row.original.id)} className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const subcategoryColumns: ColumnDef<Subcategory>[] = [
    {
      accessorKey: 'name',
      header: 'Subcategory Name',
    },
    {
      accessorKey: 'category_id',
      header: 'Parent Category',
      cell: ({ row }) => {
        const category = categories.find(cat => cat.id === row.original.category_id);
        return category ? category.name : 'N/A';
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openSubcategoryDialog(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteSubcategory(row.original.id)} className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!hasCheckedInitialSession || isPageLoading) { // Use hasCheckedInitialSession for initial loading
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage Categories & Subcategories</h1>

      {/* Categories Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">Categories</CardTitle>
          <Button onClick={() => openCategoryDialog()}>Add Category</Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={categoryColumns} data={categories} />
        </CardContent>
      </Card>

      {/* Subcategories Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">Subcategories</CardTitle>
          <Button onClick={() => openSubcategoryDialog()} disabled={categories.length === 0}>Add Subcategory</Button>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <p className="text-center text-gray-600 dark:text-gray-400">
              Please add at least one category before adding subcategories.
            </p>
          ) : (
            <DataTable columns={subcategoryColumns} data={subcategories} />
          )}
        </CardContent>
      </Card>

      <MadeWithDyad />

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="categoryName" className="text-right">
                Name
              </Label>
              <Input
                id="categoryName"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>Cancel</Button>
            <Button onClick={currentCategory ? handleEditCategory : handleAddCategory}>
              {currentCategory ? 'Save Changes' : 'Add Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={isSubcategoryDialogOpen} onOpenChange={setIsSubcategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentSubcategory ? 'Edit Subcategory' : 'Add New Subcategory'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subCategoryName" className="text-right">
                Name
              </Label>
              <Input
                id="subCategoryName"
                value={subcategoryName}
                onChange={(e) => setSubcategoryName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parentCategory" className="text-right">
                Parent Category
              </Label>
              <Select onValueChange={setSelectedCategoryIdForSub} value={selectedCategoryIdForSub || ''}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSubcategoryDialogOpen(false)}>Cancel</Button>
            <Button onClick={currentSubcategory ? handleEditSubcategory : handleAddSubcategory}>
              {currentSubcategory ? 'Save Changes' : 'Add Subcategory'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageCategoriesPage;