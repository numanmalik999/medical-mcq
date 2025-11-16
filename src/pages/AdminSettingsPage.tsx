"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import SocialMediaSettingsCard from '@/components/SocialMediaSettingsCard'; // Import new component

const defaultPages = [
  { slug: 'about', title: 'About Us', content: '# About Study Prometric MCQs...', location: ['footer'] },
  { slug: 'contact', title: 'Contact Us', content: '# Contact Us...', location: ['footer'] },
  { slug: 'privacy', title: 'Privacy Policy', content: '# Privacy Policy...', location: ['footer'] },
  { slug: 'terms', title: 'Terms of Service', content: '# Terms of Service...', location: ['footer'] },
  { slug: 'faq', title: 'FAQ', content: '# Frequently Asked Questions...', location: ['footer'] },
  { slug: 'refund', title: 'Return & Refund Policy', content: '# Return and Refund Policy...', location: ['footer'] },
  { slug: 'reviews', title: 'Reviews', content: 'This page is dynamically generated.', location: ['footer'] },
  { slug: 'road-to-gulf', title: 'Road to Gulf', content: '## Your Road to Practicing in the Gulf...', location: ['header', 'footer'] },
];

const AdminSettingsPage = () => {
  const { toast } = useToast();
  const [staticPages, setStaticPages] = useState<StaticPage[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPageForEdit, setSelectedPageForEdit] = useState<StaticPage | null>(null);

  const { hasCheckedInitialSession } = useSession();

  const ensureDefaultStaticPages = async () => {
    const existingPagesMap = new Map(staticPages.map(p => [p.slug, p]));
    const pagesToInsert = [];
    const pagesToUpdate = [];

    for (const defaultPage of defaultPages) {
      const existingPage = existingPagesMap.get(defaultPage.slug);
      if (!existingPage) {
        pagesToInsert.push(defaultPage);
      } else {
        // Check if location needs an update
        const existingLocation = existingPage.location || [];
        const defaultLocation = defaultPage.location || [];
        const needsUpdate = defaultLocation.length !== existingLocation.length || !defaultLocation.every(loc => existingLocation.includes(loc));
        
        if (needsUpdate) {
          pagesToUpdate.push({
            ...existingPage,
            location: defaultPage.location,
          });
        }
      }
    }

    if (pagesToInsert.length > 0) {
      console.log(`Inserting ${pagesToInsert.length} default static pages.`);
      const { error } = await supabase
        .from('static_pages')
        .insert(pagesToInsert);

      if (error) {
        console.error('Error inserting default static pages:', error);
        toast({ title: "Error", description: "Failed to initialize default pages.", variant: "destructive" });
      }
    }

    if (pagesToUpdate.length > 0) {
      console.log(`Updating ${pagesToUpdate.length} default static pages with correct locations.`);
      const updates = pagesToUpdate.map(page => 
        supabase.from('static_pages').update({ location: page.location }).eq('id', page.id)
      );
      const results = await Promise.all(updates);
      const updateError = results.some(res => res.error);

      if (updateError) {
        console.error('Error updating default static page locations:', results.map(r => r.error).filter(Boolean));
        toast({ title: "Error", description: "Failed to update default page locations.", variant: "destructive" });
      }
    }

    if (pagesToInsert.length > 0 || pagesToUpdate.length > 0) {
      await fetchStaticPages(false); // Re-fetch if any changes were made
    }
  };

  const fetchStaticPages = async (setLoading = true) => {
    if (setLoading) setIsPageLoading(true);
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
    if (setLoading) setIsPageLoading(false);
  };

  useEffect(() => {
    if (hasCheckedInitialSession) {
      // First, fetch existing pages
      fetchStaticPages().then(() => {
        // Then, ensure defaults exist (this relies on the state being updated, so we call it after the initial fetch completes)
        // We call it here to ensure it runs after the initial fetch completes and populates `staticPages` state.
      });
    }
  }, [hasCheckedInitialSession]);

  // Separate effect to run default page check after initial fetch completes
  useEffect(() => {
    if (hasCheckedInitialSession && !isPageLoading) {
        ensureDefaultStaticPages();
    }
  }, [isPageLoading, hasCheckedInitialSession]);


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
      accessorKey: 'location',
      header: 'Location',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {(row.original.location || []).length > 0 ? (
            (row.original.location || []).map((loc, index) => (
              <Badge key={index} variant="secondary">
                {loc.charAt(0).toUpperCase() + loc.slice(1)}
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </div>
      ),
    },
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

      <SocialMediaSettingsCard />

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
        onSave={() => fetchStaticPages()}
      />
    </div>
  );
};

export default AdminSettingsPage;