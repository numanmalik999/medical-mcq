"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, Youtube, Trash2, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EditVideoDialog from '@/components/EditVideoDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface Video {
  id: string;
  title: string;
  description: string | null;
  youtube_video_id: string;
  created_at: string;
}

const ManageVideosPage = () => {
  const { toast } = useToast();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const fetchVideos = async () => {
    const { data, error } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
    if (!error) setVideos(data || []);
  };

  useEffect(() => { fetchVideos(); }, []);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this video?")) return;
    const { error } = await supabase.from('videos').delete().eq('id', id);
    if (!error) {
      toast({ title: "Deleted", description: "Video removed from library." });
      fetchVideos();
    }
  };

  const columns: ColumnDef<Video>[] = [
    {
      accessorKey: "youtube_video_id",
      header: "Preview",
      cell: ({ row }) => (
        <img 
          src={`https://img.youtube.com/vi/${row.original.youtube_video_id}/default.jpg`} 
          className="w-16 h-12 object-cover rounded" 
          alt="thumbnail"
        />
      )
    },
    { accessorKey: "title", header: "Title" },
    { accessorKey: "created_at", header: "Added", cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString() },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedVideo(row.original); setIsDialogOpen(true); }}>
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
        <h1 className="text-3xl font-bold">Manage Videos</h1>
        <Button onClick={() => { setSelectedVideo(null); setIsDialogOpen(true); }}>
          <Youtube className="h-4 w-4 mr-2" /> Add Video
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <DataTable columns={columns} data={videos} />
        </CardContent>
      </Card>

      <EditVideoDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        video={selectedVideo} 
        onSave={fetchVideos} 
      />
    </div>
  );
};

export default ManageVideosPage;