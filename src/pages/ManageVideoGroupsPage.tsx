"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, FolderPlus, Trash2, Edit, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EditVideoGroupDialog, { VideoGroup } from '@/components/EditVideoGroupDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Link } from 'react-router-dom';

const ManageVideoGroupsPage = () => {
  const { toast } = useToast();
  const [groups, setGroups] = useState<VideoGroup[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<VideoGroup | null>(null);

  const fetchGroups = async () => {
    const { data, error } = await supabase.from('video_groups').select('*').order('order', { ascending: true });
    if (!error) setGroups(data || []);
  };

  useEffect(() => { fetchGroups(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this group? Videos in this group will be moved to 'Uncategorized'.")) return;
    const { error } = await supabase.from('video_groups').delete().eq('id', id);
    if (!error) {
      toast({ title: "Deleted", description: "Group removed." });
      fetchGroups();
    }
  };

  const columns: ColumnDef<VideoGroup>[] = [
    { accessorKey: "order", header: "Order" },
    { accessorKey: "name", header: "Group Name" },
    { accessorKey: "description", header: "Description", cell: ({ row }) => <span className="truncate max-w-xs block">{row.original.description}</span> },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedGroup(row.original); setIsDialogOpen(true); }}>
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
            <h1 className="text-3xl font-bold">Manage Video Groups</h1>
        </div>
        <Button onClick={() => { setSelectedGroup(null); setIsDialogOpen(true); }}>
          <FolderPlus className="h-4 w-4 mr-2" /> Add Group
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable columns={columns} data={groups} />
        </CardContent>
      </Card>

      <EditVideoGroupDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        group={selectedGroup} 
        onSave={fetchGroups} 
      />
    </div>
  );
};

export default ManageVideoGroupsPage;