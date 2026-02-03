"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Edit, 
  FolderTree, 
  Video as VideoIcon,
  Plus,
  FolderPlus,
  MoreHorizontal
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EditVideoDialog from '@/components/EditVideoDialog';
import EditVideoGroupDialog, { VideoGroup } from '@/components/EditVideoGroupDialog';
import EditVideoSubgroupDialog from '@/components/EditVideoSubgroupDialog';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import LoadingBar from '@/components/LoadingBar';
import { MadeWithDyad } from '@/components/made-with-dyad';

interface Video {
  id: string;
  title: string;
  description: string | null;
  youtube_video_id: string;
  platform: string;
  group_id: string | null;
  subgroup_id: string | null;
  order: number;
  created_at: string;
}

interface StructuredLibrary {
  id: string;
  name: string;
  standaloneVideos: Video[];
  subgroups: {
    id: string;
    name: string;
    videos: Video[];
  }[];
}

const ManageVideosPage = () => {
  const { toast } = useToast();
  
  // State for Video Library (Tab 1)
  const [library, setLibrary] = useState<StructuredLibrary[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // State for Groups (Tab 2)
  const [groups, setGroups] = useState<VideoGroup[]>([]);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<VideoGroup | null>(null);

  // State for Subgroups (Tab 3)
  const [subgroups, setSubgroups] = useState<any[]>([]);
  const [isSubgroupDialogOpen, setIsSubgroupDialogOpen] = useState(false);
  const [selectedSubgroup, setSelectedSubgroup] = useState<any | null>(null);

  const fetchAllData = useCallback(async () => {
    setIsPageLoading(true);
    try {
      const [groupsRes, subRes, videoRes] = await Promise.all([
        supabase.from('video_groups').select('*').order('order'),
        supabase.from('video_subgroups').select('*, video_groups(name)').order('order'),
        supabase.from('videos').select('*').order('order', { ascending: true })
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (subRes.error) throw subRes.error;
      if (videoRes.error) throw videoRes.error;

      // Update basic lists
      setGroups(groupsRes.data || []);
      setSubgroups(subRes.data || []);

      // Build structured library
      const allVideos = videoRes.data || [];
      const allSubgroups = subRes.data || [];
      
      const structured: StructuredLibrary[] = (groupsRes.data || []).map(g => {
        const groupSubgroups = allSubgroups
          .filter(sg => sg.group_id === g.id)
          .map(sg => ({
            id: sg.id,
            name: sg.name,
            videos: allVideos.filter(v => v.subgroup_id === sg.id)
          }));

        return {
          id: g.id,
          name: g.name,
          subgroups: groupSubgroups,
          standaloneVideos: allVideos.filter(v => v.group_id === g.id && !v.subgroup_id)
        };
      });

      const uncategorized = allVideos.filter(v => !v.group_id);
      if (uncategorized.length > 0) {
        structured.push({
          id: 'uncategorized',
          name: 'Uncategorized / General',
          subgroups: [],
          standaloneVideos: uncategorized
        });
      }

      setLibrary(structured);
    } catch (error: any) {
      console.error("Error fetching library data:", error);
      toast({ title: "Error", description: "Failed to load library data.", variant: "destructive" });
    } finally {
      setIsPageLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  const handleDeleteVideo = async (id: string) => {
    if (!window.confirm("Delete this video?")) return;
    const { error } = await supabase.from('videos').delete().eq('id', id);
    if (!error) {
      toast({ title: "Deleted", description: "Video removed." });
      fetchAllData();
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm("Delete this group? Videos in this group will be moved to 'Uncategorized'.")) return;
    const { error } = await supabase.from('video_groups').delete().eq('id', id);
    if (!error) {
      toast({ title: "Deleted", description: "Group removed." });
      fetchAllData();
    }
  };

  const handleDeleteSubgroup = async (id: string) => {
    if (!window.confirm("Delete this sub-group? Videos will be unlinked.")) return;
    const { error } = await supabase.from('video_subgroups').delete().eq('id', id);
    if (!error) {
      toast({ title: "Deleted", description: "Sub-group removed." });
      fetchAllData();
    }
  };

  // --- Column Definitions ---

  const groupColumns: ColumnDef<VideoGroup>[] = [
    { accessorKey: "order", header: "Order" },
    { accessorKey: "name", header: "Group Name" },
    { accessorKey: "description", header: "Description", cell: ({ row }) => <span className="truncate max-w-xs block">{row.original.description}</span> },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => { setSelectedGroup(row.original); setIsGroupDialogOpen(true); }}>
              <Edit className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteGroup(row.original.id)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const subgroupColumns: ColumnDef<any>[] = [
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
            <DropdownMenuItem onClick={() => { setSelectedSubgroup(row.original); setIsSubgroupDialogOpen(true); }}>
              <Edit className="h-4 w-4 mr-2" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={() => handleDeleteSubgroup(row.original.id)}>
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    }
  ];

  const VideoRow = ({ video }: { video: Video }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-muted/30 transition-colors group">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex flex-col items-center justify-center bg-muted px-2 py-1 rounded text-[10px] font-bold min-w-[32px]">
          {video.order}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{video.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-[9px] h-4 uppercase tracking-tighter">
              {video.platform}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono truncate">{video.youtube_video_id}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedVideo(video); setIsVideoDialogOpen(true); }}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteVideo(video.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (isPageLoading) return <LoadingBar />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Video Manager</h1>
          <p className="text-muted-foreground text-sm">Organize your educational curriculum.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => { setSelectedVideo(null); setIsVideoDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Video
          </Button>
        </div>
      </div>

      <Tabs defaultValue="library" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3 mb-8">
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="groups">Groups</TabsTrigger>
          <TabsTrigger value="subgroups">Sub-groups</TabsTrigger>
        </TabsList>

        {/* Tab 1: Structured Library */}
        <TabsContent value="library">
          {library.length === 0 ? (
            <Card className="border-dashed py-20 text-center">
              <VideoIcon className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-bold">No Videos Found</h3>
              <p className="text-muted-foreground">Start by creating groups and adding videos.</p>
            </Card>
          ) : (
            <Accordion type="multiple" defaultValue={[library[0]?.id]} className="space-y-4">
              {library.map((group) => (
                <AccordionItem key={group.id} value={group.id} className="border rounded-xl bg-card overflow-hidden shadow-sm">
                  <AccordionTrigger className="px-6 py-4 hover:bg-muted/30 hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-2 py-0.5">
                        {group.standaloneVideos.length + group.subgroups.reduce((acc, sg) => acc + sg.videos.length, 0)} Items
                      </Badge>
                      <span className="font-bold text-lg">{group.name}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-6 bg-muted/5 border-t space-y-8">
                    {group.standaloneVideos.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Foundation Lessons</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {group.standaloneVideos.map(v => <VideoRow key={v.id} video={v} />)}
                        </div>
                      </div>
                    )}
                    {group.subgroups.length > 0 && (
                      <div className="space-y-4">
                        <Accordion type="multiple" className="space-y-4">
                          {group.subgroups.map(sg => (
                            <AccordionItem key={sg.id} value={sg.id} className="border rounded-lg bg-background shadow-sm overflow-hidden">
                              <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/20">
                                <div className="flex items-center gap-2 text-left">
                                  <FolderTree className="h-4 w-4 text-primary/60" />
                                  <span className="font-bold text-xs uppercase tracking-tight">{sg.name}</span>
                                  <Badge variant="outline" className="ml-2 text-[10px] font-bold">{sg.videos.length} videos</Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="p-4 bg-muted/5 border-t">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {sg.videos.map(v => <VideoRow key={v.id} video={v} />)}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </TabsContent>

        {/* Tab 2: Manage Groups */}
        <TabsContent value="groups">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Main Categories</CardTitle>
                <CardDescription>Top-level navigation for your library.</CardDescription>
              </div>
              <Button size="sm" onClick={() => { setSelectedGroup(null); setIsGroupDialogOpen(true); }}>
                <FolderPlus className="h-4 w-4 mr-2" /> Add Group
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable columns={groupColumns} data={groups} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Manage Subgroups */}
        <TabsContent value="subgroups">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Nested Sub-groups</CardTitle>
                <CardDescription>Specific topics within your main categories.</CardDescription>
              </div>
              <Button size="sm" onClick={() => { setSelectedSubgroup(null); setIsSubgroupDialogOpen(true); }}>
                <FolderPlus className="h-4 w-4 mr-2" /> Add Sub-group
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable columns={subgroupColumns} data={subgroups} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Shared Dialogs */}
      <EditVideoDialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen} video={selectedVideo} onSave={fetchAllData} />
      <EditVideoGroupDialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen} group={selectedGroup} onSave={fetchAllData} />
      <EditVideoSubgroupDialog open={isSubgroupDialogOpen} onOpenChange={setIsSubgroupDialogOpen} subgroup={selectedSubgroup} onSave={fetchAllData} />
      
      <MadeWithDyad />
    </div>
  );
};

export default ManageVideosPage;