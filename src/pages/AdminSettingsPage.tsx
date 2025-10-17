"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import EditStaticPageDialog, { StaticPage } from '@/components/EditStaticPageDialog';
import { useSession } from '@/components/SessionContextProvider';

const AdminSettingsPage = () => {
  const { toast } = useToast();
  const [staticPages, setStaticPages] = useState<StaticPage[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPageForEdit, setSelectedPageForEdit] = useState<StaticPage | null>(null);

  const { hasCheckedInitialSession } = useSession();

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchStaticPages();
    }
  }, [hasCheckedInitialSession]);

  const fetchStaticPages = async () => {
    setIsPageLoading(true);
    const { data, error } = await supabase
      .from('static_pages')
      .select('*')
      .order('title', { ascending: true });

    if (error) {
      console.error('Error fetching static pages:', error);
      toast({ title: "Error", description: "Failed to load static pages.", variant: "destructive" });
      setStaticPages([]);
    } else {
      setStaticPages(data || []);
    }
    setIsPageLoading(false);
  };

  const handleDeletePage = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this static page? This action cannot be undone.")) {
      return;
    }
    try {
      const { error } = await supabase
        .from('static_pages')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Static page deleted successfully." });
      fetchStaticPages();
    } catch (error: any) {
      console.error("Error deleting static page:", error);
      toast({ title: "Error", description: `Failed to delete page: ${error.message}`, variant: "destructive" });
    }
  };

  const openEditDialog = (page?: StaticPage) => {
    setSelectedPageForEdit(page || null);
    setIsEditDialogOpen(true);
  };

  const columns: ColumnDef<StaticPage>[] = [
    { accessorKey: 'title', header: 'Page Title' },
    { accessorKey: 'slug', header: 'Slug' },
    {
      accessorKey: 'updated_at',
      header: 'Last Updated',
      cell: ({ row }) => new Date(row.original.updated_at).toLocaleDateString(),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEditDialog(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeletePage(row.original.id)} className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Settings</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">Static Pages Content</CardTitle>
          <Button onClick={() => openEditDialog()}>Add New Page</Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={staticPages} />
        </CardContent>
      </Card>

      <MadeWithDyad />

      <EditStaticPageDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        page={selectedPageForEdit}
        onSave={fetchStaticPages}
      />
    </div>
  );
};

export default AdminSettingsPage;