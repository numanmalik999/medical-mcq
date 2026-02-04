"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Edit, 
  FolderTree, 
  Plus,
  FolderPlus,
  MoreHorizontal,
  PlayCircle,
  GripVertical,
  UploadCloud,
  FileSpreadsheet,
  Download,
  Loader2
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import * as XLSX from 'xlsx';

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
    description: string | null;
    videos: Video[];
  }[];
}

const ManageVideosPage = () => {
  const { toast } = useToast();
  
  const [library, setLibrary] = useState<StructuredLibrary[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  
  // Video Dialog State
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  // Group Dialog State
  const [groups, setGroups] = useState<VideoGroup[]>([]);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<VideoGroup | null>(null);

  // Subgroup Dialog State
  const [subgroups, setSubgroups] = useState<any[]>([]);
  const [isSubgroupDialogOpen, setIsSubgroupDialogOpen] = useState(false);
  const [selectedSubgroup, setSelectedSubgroup] = useState<any | null>(null);

  // Bulk Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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

      setGroups(groupsRes.data || []);
      setSubgroups(subRes.data || []);

      const allVideos = videoRes.data || [];
      const allSubgroups = subRes.data || [];
      
      const structured: StructuredLibrary[] = (groupsRes.data || []).map(g => {
        const groupSubgroups = allSubgroups
          .filter(sg => sg.group_id === g.id)
          .map(sg => ({
            id: sg.id,
            name: sg.name,
            description: sg.description,
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleBulkUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const videosToUpload = json.map(row => ({
          parent_category: row['Parent Category'],
          sub_category: row['Sub-Category'],
          video_title: row['Video Title'],
          order: parseInt(row['Display Number (Order)']) || 0,
          video_id: String(row['Vimeo ID']),
          platform: 'vimeo'
        })).filter(v => v.parent_category && v.video_title && v.video_id);

        if (videosToUpload.length === 0) {
          throw new Error("No valid data found. Ensure column headers match: Parent Category, Sub-Category, Video Title, Display Number (Order), Vimeo ID");
        }

        const { data: _res, error } = await supabase.functions.invoke('bulk-upload-videos', {
          body: { videos: videosToUpload },
        });

        if (error) throw error;

        toast({ 
          title: "Upload Complete", 
          description: "Videos have been successfully imported into the curriculum." 
        });
        
        setSelectedFile(null);
        fetchAllData();
      } catch (err: any) {
        toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

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

  const groupColumns: ColumnDef<VideoGroup>[] = [
    { accessorKey: "order", header: "Order" },
    { accessorKey: "name", header: "Group Name" },
    { accessorKey: "description", header: "Description", cell: ({ row }) => <span className="truncate max-w-xs block text-xs">{row.original.description || '-'}</span> },
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
    <div className="flex items-center justify-between p-2 pl-3 border rounded-lg bg-background/50 hover:bg-muted/50 transition-all group">
      <div className="flex items-center gap-3 overflow-hidden">
        <PlayCircle className="h-4 w-4 text-primary/40 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-[13px] truncate leading-none mb-1">
            <span className="text-muted-foreground mr-1">#{video.order}</span> {video.title}
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[8px] h-3 px-1 uppercase font-black">
              {video.platform}
            </Badge>
            <span className="text-[9px] text-muted-foreground font-mono truncate">{video.youtube_video_id}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setSelectedVideo(video); setIsVideoDialogOpen(true); }}>
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteVideo(video.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  if (isPageLoading) return <LoadingBar />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Curriculum Manager</h1>
          <p className="text-muted-foreground text-sm">Organize medical lessons into structured categories and topics.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => { setSelectedVideo(null); setIsVideoDialogOpen(true); }} className="rounded-full shadow-md">
            <Plus className="h-4 w-4 mr-2" /> New Lesson
          </Button>
        </div>
      </div>

      <Tabs defaultValue="library" className="w-full">
        <TabsList className="inline-flex h-11 items-center justify-center rounded-full bg-muted p-1 mb-8">
          <TabsTrigger value="library" className="rounded-full px-6">Curriculum View</TabsTrigger>
          <TabsTrigger value="groups" className="rounded-full px-6">Groups</TabsTrigger>
          <TabsTrigger value="subgroups" className="rounded-full px-6">Sub-groups</TabsTrigger>
          <TabsTrigger value="bulk" className="rounded-full px-6 flex items-center gap-2">
            <UploadCloud className="h-4 w-4" /> Bulk Upload
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library" className="space-y-6">
            <Accordion type="multiple" defaultValue={[library[0]?.id]} className="space-y-6">
              {library.map((group) => (
                <AccordionItem key={group.id} value={group.id} className="border rounded-2xl bg-card overflow-hidden shadow-sm border-border/60">
                  <AccordionTrigger className="px-6 py-5 hover:bg-muted/30 hover:no-underline border-b bg-muted/10">
                    <div className="flex items-center gap-4 text-left">
                      <div className="p-2 bg-primary/5 rounded-xl text-primary">
                        <GripVertical className="h-5 w-5 opacity-40" />
                      </div>
                      <div className="space-y-0.5">
                        <span className="font-extrabold text-xl tracking-tight">{group.name}</span>
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="text-[10px] uppercase font-black bg-background">
                            {group.standaloneVideos.length + group.subgroups.reduce((acc, sg) => acc + sg.videos.length, 0)} Items Total
                           </Badge>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-6 bg-muted/5 space-y-10">
                    {group.standaloneVideos.length > 0 && (
                      <section className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                           <Badge variant="secondary" className="h-1.5 w-1.5 rounded-full p-0" />
                           <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground">Foundation Lessons</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {group.standaloneVideos.map(v => <VideoRow key={v.id} video={v} />)}
                        </div>
                      </section>
                    )}
                    {group.subgroups.length > 0 && (
                      <section className="space-y-4">
                        <div className="flex items-center gap-2 px-1">
                           <Badge variant="secondary" className="h-1.5 w-1.5 rounded-full p-0" />
                           <h3 className="text-[11px] font-black uppercase tracking-[0.15em] text-muted-foreground">Topic Sub-groups</h3>
                        </div>
                        <Accordion type="multiple" className="space-y-4">
                          {group.subgroups.map(sg => (
                            <AccordionItem key={sg.id} value={sg.id} className="border rounded-xl bg-background shadow-sm border-border/40 overflow-hidden">
                              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/20">
                                <div className="flex items-center gap-3 text-left">
                                  <div className="p-1.5 bg-primary/5 rounded-lg">
                                    <FolderTree className="h-4 w-4 text-primary/60" />
                                  </div>
                                  <div>
                                    <span className="font-bold text-sm text-foreground">{sg.name}</span>
                                    <p className="text-[10px] text-muted-foreground line-clamp-1">{sg.description || 'Section items'}</p>
                                  </div>
                                  <Badge variant="secondary" className="ml-2 text-[10px] font-bold rounded-full">
                                    {sg.videos.length} videos
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="px-5 pb-5 pt-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                  {sg.videos.map(v => <VideoRow key={v.id} video={v} />)}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </section>
                    )}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
        </TabsContent>

        <TabsContent value="groups">
          <Card className="shadow-sm border-none bg-muted/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Category Management</CardTitle>
                <CardDescription className="text-xs">Define top-level curriculum categories.</CardDescription>
              </div>
              <Button size="sm" variant="secondary" onClick={() => { setSelectedGroup(null); setIsGroupDialogOpen(true); }}>
                <FolderPlus className="h-4 w-4 mr-2" /> New Category
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable columns={groupColumns} data={groups} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subgroups">
          <Card className="shadow-sm border-none bg-muted/20">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Nested Topic Management</CardTitle>
                <CardDescription className="text-xs">Group specific lessons into topics within categories.</CardDescription>
              </div>
              <Button size="sm" variant="secondary" onClick={() => { setSelectedSubgroup(null); setIsSubgroupDialogOpen(true); }}>
                <FolderPlus className="h-4 w-4 mr-2" /> New Topic
              </Button>
            </CardHeader>
            <CardContent>
              <DataTable columns={subgroupColumns} data={subgroups} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card className="max-w-2xl border-none shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
                Spreadsheet Upload
              </CardTitle>
              <CardDescription>
                Quickly populate your video library using an Excel file.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted p-4 rounded-xl border space-y-3">
                 <h4 className="text-sm font-bold flex items-center gap-2">
                   <Download className="h-4 w-4" /> Required Column Headers
                 </h4>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
                    <div className="bg-background p-2 border rounded">Parent Category</div>
                    <div className="bg-background p-2 border rounded">Sub-Category</div>
                    <div className="bg-background p-2 border rounded">Video Title</div>
                    <div className="bg-background p-2 border rounded">Display Number (Order)</div>
                    <div className="bg-background p-2 border rounded">Vimeo ID</div>
                 </div>
              </div>

              <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-10 bg-muted/30">
                 <Input 
                   type="file" 
                   accept=".xlsx, .xls, .csv" 
                   onChange={handleFileChange}
                   className="hidden"
                   id="bulk-video-upload"
                 />
                 <Label htmlFor="bulk-video-upload" className="cursor-pointer text-center space-y-2">
                   <div className="bg-primary/5 p-4 rounded-full w-fit mx-auto">
                     <UploadCloud className="h-10 w-10 text-primary" />
                   </div>
                   <p className="font-bold text-sm">{selectedFile ? selectedFile.name : "Select your Excel file"}</p>
                   <p className="text-xs text-muted-foreground">Click to browse or drag and drop here.</p>
                 </Label>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleBulkUpload} 
                disabled={isUploading || !selectedFile} 
                className="w-full h-11 text-lg font-bold"
              >
                {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</> : "Start Bulk Import"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <EditVideoDialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen} video={selectedVideo} onSave={fetchAllData} />
      <EditVideoGroupDialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen} group={selectedGroup} onSave={fetchAllData} />
      <EditVideoSubgroupDialog open={isSubgroupDialogOpen} onOpenChange={setIsSubgroupDialogOpen} subgroup={selectedSubgroup} onSave={fetchAllData} />
      
      <MadeWithDyad />
    </div>
  );
};

export default ManageVideosPage;