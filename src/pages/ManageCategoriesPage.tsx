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
import { useSession } from '@/components/SessionContextProvider';

interface Category {
  id: string;
  name: string;
  display_order: number; // Added field
  mcq_count?: number;
}

const ManageCategoriesPage = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0'); // Added state

  const { hasCheckedInitialSession } = useSession();

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchCategories();
    }
  }, [hasCheckedInitialSession]);

  const fetchCategories = async () => {
    setIsPageLoading(true);
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*')
      .order('display_order', { ascending: true }); // Sort by order

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
    } else {
      const categoriesWithCounts = await Promise.all(
        (categoriesData || []).map(async (category) => {
          const { count: mcqCount, error: mcqCountError } = await supabase
            .from('mcq_category_links')
            .select('mcq_id', { count: 'exact', head: true })
            .eq('category_id', category.id);

          if (mcqCountError) {
            console.error(`Error fetching MCQ count for category ${category.name}:`, mcqCountError);
          }
          return { ...category, mcq_count: mcqCount || 0 };
        })
      );
      setCategories(categoriesWithCounts || []);
    }
    setIsPageLoading(false);
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      toast({ title: "Error", description: "Category name cannot be empty.", variant: "destructive" });
      return;
    }
    try {
      const { error } = await supabase
        .from('categories')
        .insert({ 
          name: categoryName.trim(),
          display_order: parseInt(displayOrder) || 0 
        });

      if (error) throw error;
      toast({ title: "Success", description: "Category added successfully." });
      fetchCategories();
      setIsCategoryDialogOpen(false);
      resetForm();
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
        .update({ 
          name: categoryName.trim(),
          display_order: parseInt(displayOrder) || 0 
        })
        .eq('id', currentCategory.id);

      if (error) throw error;
      toast({ title: "Success", description: "Category updated successfully." });
      fetchCategories();
      setIsCategoryDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error("Error updating category:", error);
      toast({ title: "Error", description: `Failed to update category: ${error.message}`, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setCategoryName('');
    setDisplayOrder('0');
    setCurrentCategory(null);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this category? All associated MCQs will become uncategorized.")) {
      return;
    }
    try {
      const { error: deleteLinksError } = await supabase
        .from('mcq_category_links')
        .delete()
        .eq('category_id', id);

      if (deleteLinksError) {
        console.warn("Error deleting associated category links:", deleteLinksError);
      }

      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Category deleted successfully." });
      fetchCategories();
    } catch (error: any) {
      console.error("Error deleting category:", error);
      toast({ title: "Error", description: `Failed to delete category: ${error.message}`, variant: "destructive" });
    }
  };

  const openCategoryDialog = (category?: Category) => {
    if (category) {
      setCurrentCategory(category);
      setCategoryName(category.name);
      setDisplayOrder(category.display_order.toString());
    } else {
      resetForm();
    }
    setIsCategoryDialogOpen(true);
  };

  const categoryColumns: ColumnDef<Category>[] = [
    {
      accessorKey: 'display_order',
      header: 'Order',
      cell: ({ row }) => (
        <div className="font-mono text-xs text-muted-foreground">
          #{row.original.display_order}
        </div>
      ),
    },
    { 
      accessorKey: 'name', 
      header: 'Category Name',
      cell: ({ row }) => <span className="font-bold">{row.original.name} ({row.original.mcq_count || 0})</span>,
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

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage Categories</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">Categories</CardTitle>
          <Button onClick={() => openCategoryDialog()}>Add Category</Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={categoryColumns} data={categories} />
        </CardContent>
      </Card>

      <MadeWithDyad />

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentCategory ? 'Edit Category' : 'Add New Category'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="categoryName" className="text-right">Name</Label>
              <Input
                id="categoryName"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="displayOrder" className="text-right">Serial No.</Label>
              <Input
                id="displayOrder"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                className="col-span-3"
                placeholder="e.g. 1"
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
    </div>
  );
};

export default ManageCategoriesPage;