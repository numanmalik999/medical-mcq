"use client";

import React, { useEffect, useState } from 'react';
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EditSubscriptionTierDialog, { SubscriptionTier } from '@/components/EditSubscriptionTierDialog';

const ManageSubscriptionsPage = () => {
  const { toast } = useToast();
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTierForEdit, setSelectedTierForEdit] = useState<SubscriptionTier | null>(null);

  useEffect(() => {
    fetchSubscriptionTiers();
  }, []);

  const fetchSubscriptionTiers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('subscription_tiers')
      .select('*');

    if (error) {
      console.error('Error fetching subscription tiers:', error);
      toast({ title: "Error", description: "Failed to load subscription tiers.", variant: "destructive" });
      setTiers([]);
    } else {
      setTiers(data || []);
    }
    setIsLoading(false);
  };

  const handleDeleteTier = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this subscription tier? This action cannot be undone.")) {
      return;
    }
    try {
      const { error } = await supabase
        .from('subscription_tiers')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "Subscription tier deleted successfully." });
      fetchSubscriptionTiers();
    } catch (error: any) {
      console.error("Error deleting subscription tier:", error);
      toast({ title: "Error", description: `Failed to delete tier: ${error.message}`, variant: "destructive" });
    }
  };

  const openEditDialog = (tier?: SubscriptionTier) => {
    setSelectedTierForEdit(tier || null);
    setIsEditDialogOpen(true);
  };

  const columns: ColumnDef<SubscriptionTier>[] = [
    { accessorKey: 'name', header: 'Tier Name' },
    {
      accessorKey: 'price',
      header: 'Price',
      cell: ({ row }) => `${row.original.currency} ${row.original.price.toFixed(2)}`,
    },
    {
      accessorKey: 'duration_in_months',
      header: 'Duration',
      cell: ({ row }) => `${row.original.duration_in_months} month${row.original.duration_in_months > 1 ? 's' : ''}`,
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => <div className="w-[200px] truncate">{row.original.description || 'N/A'}</div>,
    },
    {
      accessorKey: 'features',
      header: 'Features',
      cell: ({ row }) => (
        <div className="w-[200px] truncate">
          {(row.original.features && row.original.features.length > 0) ? row.original.features.join(', ') : 'N/A'}
        </div>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => openEditDialog(row.original)}>Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleDeleteTier(row.original.id)} className="text-red-600">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading subscription tiers...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Manage Subscription Tiers</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl">Subscription Tiers</CardTitle>
          <Button onClick={() => openEditDialog()}>Add New Tier</Button>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={tiers} />
        </CardContent>
      </Card>

      <MadeWithDyad />

      <EditSubscriptionTierDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        tier={selectedTierForEdit}
        onSave={fetchSubscriptionTiers}
      />
    </div>
  );
};

export default ManageSubscriptionsPage;