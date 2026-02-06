"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Loader2,
  Table as TableIcon,
  List as ListIcon
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
  
  const [allVideos, setAllVideos] = useState<Video[]>([]);
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
  const [uploadProgress, setUploadProgress] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchAllData = useCallback(async () => {
    setIsPageLoading(true);
    try {
      const [groupsRes, subRes, videoRes] = await Promise.all([
        supabase.from('video_groups').select('*').order('order'),
        supabase.from('video_subgroups').select('*, video_groups(name)').order('order'),
        supabase.from('videos').select('*').order('created_at', { ascending: false })
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (subRes.error) throw subRes.error;
      if (videoRes.error) throw videoRes.error;

      const videosData = videoRes.data || [];
      setAllVideos(videosData);
      setGroups(groupsRes.data || []);
      setSubgroups(subRes.data || []);

      const allSubgroups = subRes.data || [];
      
      const structured: StructuredLibrary[] = (groupsRes.data || []).map(g => {
        const groupSubgroups = allSubgroups
          .filter(sg => sg.group_id === g.id)
          .map(sg => ({
            id: sg.id,
            name: sg.name,
            description: sg.description,
            videos: videosData.filter(v => v.subgroup_id === sg.id)
          }));

        return {
          id: g.id,
          name: g.name,
          subgroups: groupSubgroups,
          standaloneVideos: videosData.filter(v => v.group_id === g.id && !v.subgroup_id)
        };
      });

      const uncategorized = videosData.filter(v => !v.group_id);
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

  const findVal = (row: any, keys: string[]) => {
    const rowKeys = Object.keys(row);
    for (const key of keys) {
      const found = rowKeys.find(rk => rk.toLowerCase().trim() === key.toLowerCase().trim());
      if (found) return row[found];
    }
    return undefined;
  };

  const handleBulkUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadProgress("Reading spreadsheet...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const videosToUpload = json.map(row => ({
          parent_category: findVal(row, ['Parent Category', 'Category', 'Parent']),
          sub_category: findVal(row, ['Sub-Category', 'Topic', 'Subcategory']),
          sub_category_order: parseInt(findVal(row, ['Sub-Category Order', 'Sub Order'])) || 0,
          video_title: findVal(row, ['Video Title', 'Title', 'Name']),
          order: parseInt(findVal(row, ['Display Number (Order)', 'Display Order', 'Order'])) || 0,
          video_id: String(findVal(row, ['Vimeo ID', 'Video ID', 'ID']) || '').trim(),
          platform: 'vimeo'
        })).filter(v => v.parent_category && v.video_title && v.video_id && v.video_id !== 'undefined' && v.video_id !== '');

        if (videosToUpload.length === 0) {
          throw new Error("No valid records found. Verify headers: 'Parent Category', 'Video Title', 'Vimeo ID'.");
        }

        const CHUNK_SIZE = 40;
        let totalProcessed = 0;
        let totalErrors = 0;

        for (let i = 0; i < videosToUpload.length; i += CHUNK_SIZE) {
          const chunk = videosToUpload.slice(i, i + CHUNK_SIZE);
          const batchNum = Math.floor(i / CHUNK_SIZE) + 1;
          const totalBatches = Math.ceil(videosToUpload.length / CHUNK_SIZE);
          
          setUploadProgress(`Uploading batch ${batchNum} of ${totalBatches}...`);

          const { data: res, error } = await supabase.functions.invoke('bulk-upload-videos', {
            body: { videos: chunk },
          });

          if (error) {
            console.error("Function Invoke Error:", error);
            throw new Error(error.message || "The server encountered an error during processing.");
          }
          
          if (res) {
            totalProcessed += (res.successCount || 0);
            totalErrors += (res.errorCount || 0);
            if (res.errors && res.errors.length > 0) {
                console.warn("Processing warnings:", res.errors);
            }
          }
        }

        toast({ 
          title: "Import Finished", 
          description: `Imported ${totalProcessed} videos successfully. Errors: ${totalErrors}.` 
        });
        
        setSelectedFile(null);
        setUploadProgress("");
        fetchAllData();
      } catch (err: any) {
        console.error("Bulk upload logic error:", err);
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

  const videoListColumns: ColumnDef<Video>[] = useMemo(() => [
    { accessorKey: "title", header: "Title", cell: ({ row }) => <span className="font-bold text-sm">{row.original.title}</span> },
    { accessorKey: "youtube_video_id", header: "Vimeo ID", cell: ({ row }) => <code className="text-xs bg-muted p-1 rounded">{row.original.youtube_video_id}</code> },
    { 
      id: "placement", 
      header: "Group", 
      cell: ({ row }) => {
        const group = groups.find(g => g.id === row.original.group_id);
        return <Badge variant="outline">{group?.name || 'Uncategorized'}</Badge>;
      } 
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedVideo(row.original); setIsVideoDialogOpen(true); }}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-red-500" onClick={() => handleDeleteVideo(row.original.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ], [groups]);

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
            <DropdownMenuItem className="text-red-600" onClick={() => { if(window.confirm("Delete this group?")) supabase.from('video_groups').delete().eq('id', row.original.id).then(() => fetchAllData()) }}>
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
            <DropdownMenuItem className="text-red-600" onClick={() => { if(window.confirm("Delete this sub-group?")) supabase.from('video_subgroups').delete().eq('id', row.original.id).then(() => fetchAllData()) }}>
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
          <p className="text-muted-foreground text-sm">You have <strong>{allVideos.length}</strong> lessons total.</p>
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
          <TabsTrigger value="all-lessons" className="rounded-full px-6 flex items-center gap-2">
            <ListIcon className="h-4 w-4" /> All Lessons
          </TabsTrigger>
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

        <TabsContent value="all-lessons">
          <Card className="shadow-sm border-none bg-muted/20">
            <CardHeader>
              <CardTitle>Complete Lesson List</CardTitle>
              <CardDescription>Verify existence of all {allVideos.length} lessons in the database.</CardDescription>
            </CardHeader>
            <CardContent>
              <DataTable columns={videoListColumns} data={allVideos} />
            </CardContent>
          </Card>
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
          <Card className="max-w-4xl border-none shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-6 w-6 text-primary" />
                Excel Curriculum Import
              </CardTitle>
              <CardDescription>
                Import categories, topics, and lessons in bulk.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-5 rounded-2xl border space-y-4">
                  <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <TableIcon className="h-4 w-4 text-primary" /> Required Column Headers
                  </h4>
                  <div className="space-y-2">
                    {[
                      { h: "Parent Category", d: "e.g., Cardiology" },
                      { h: "Sub-Category", d: "e.g., Heart Failure" },
                      { h: "Sub-Category Order", d: "e.g., 1, 2, 3" },
                      { h: "Video Title", d: "e.g., Intro to CHF" },
                      { h: "Display Number (Order)", d: "e.g., 1, 2, 3" },
                      { h: "Vimeo ID", d: "e.g., 123456789" }
                    ].map((col, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] bg-background p-2 rounded-lg border">
                        <code className="font-bold text-primary">{col.h}</code>
                        <span className="text-muted-foreground italic text-right">{col.d}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-2xl p-6 bg-primary/5 hover:bg-primary/10 transition-colors">
                  <Input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleFileChange}
                    className="hidden"
                    id="bulk-video-upload"
                  />
                  <Label htmlFor="bulk-video-upload" className="cursor-pointer text-center space-y-3 w-full">
                    <div className="bg-background p-4 rounded-full w-fit mx-auto shadow-sm">
                      <UploadCloud className="h-8 w-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-black text-sm uppercase tracking-tight">{selectedFile ? selectedFile.name : "Select Spreadsheet"}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Click to browse your device.</p>
                    </div>
                  </Label>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/30 p-6 rounded-b-2xl border-t flex flex-col items-center gap-3">
              <Button 
                onClick={handleBulkUpload} 
                disabled={isUploading || !selectedFile} 
                className="w-full h-12 text-lg font-black uppercase tracking-widest shadow-lg"
              >
                {isUploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing File...</> : "Execute Bulk Import"}
              </Button>
              {isUploading && (
                <p className="text-sm font-bold text-primary animate-pulse">{uploadProgress}</p>
              )}
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