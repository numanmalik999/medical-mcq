"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, FolderPlus, Trash2, Edit, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';
import EditVideoSubgroupDialog from '@/components/EditVideoSubgroupDialog';
import { Badge } from '@/components/ui/badge';

const ManageVideoSubgroupsPage = () => {
  const { toast } = useToast();
  const [subgroups, setSubgroups] = useState<any[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSubgroup, setSelectedSubgroup] = useState<any | null>(null);

  const fetchSubgroups = async () => {
    const { data, error } = await supabase
      .from('video_subgroups')
      .select('*, video_groups(name)')
      .order('order', { ascending: true });
    if (!error) setSubgroups(data || []);
  };

  useEffect(() => { fetchSubgroups(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this sub-group? Videos will be unlinked.")) return;
    const { error } = await supabase.from('video_subgroups').delete().eq('id', id);
    if (!error) {
      toast({ title: "Deleted" });
      fetchSubgroups();
    }
  };

  const columns: ColumnDef<any>[] = [
    { accessorKey: "order", header: "Order" },
    { accessorKey: "name", header: "Sub-group" },
    { 
      id: "parent", 
      header: "Parent Group", 
      cell: ({ row }) => <Badge variant="outline">{row.original.video_groups?.name || 'Error'}</Badge> 
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedSubgroup(row.original); setIsDialogOpen(true); }}>
              <Edit className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(row.original.id)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
            <Link to="/admin/manage-videos"><Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
            <h1 className="text-3xl font-bold">Manage Sub-groups</h1>
        </div>
        <Button onClick={() => { setSelectedSubgroup(null); setIsDialogOpen(true); }}>
          <FolderPlus className="h-4 w-4 mr-2" /> Add Sub-group
        </Button>
      </div>
      <Card><CardContent className="pt-6"><DataTable columns={columns} data={subgroups} /></CardContent></Card>
      <EditVideoSubgroupDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} subgroup={selectedSubgroup} onSave={fetchSubgroups} />
    </div>
  );
};

export default ManageVideoSubgroupsPage;