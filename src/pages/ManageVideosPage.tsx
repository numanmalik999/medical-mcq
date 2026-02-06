"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Edit, 
  FolderTree, 
  Plus,
  PlayCircle,
  GripVertical,
  UploadCloud,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EditVideoDialog from '@/components/EditVideoDialog';
import EditVideoGroupDialog from '@/components/EditVideoGroupDialog';
import EditVideoSubgroupDialog from '@/components/EditVideoSubgroupDialog';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingBar from '@/components/LoadingBar';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
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
}

interface VideoCounts {
  groups: Record<string, number>;
  subgroups: Record<string, number>;
}

const ManageVideosPage = () => {
  const { toast } = useToast();
  
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [subgroups, setSubgroups] = useState<any[]>([]);
  const [counts, setCounts] = useState<VideoCounts>({ groups: {}, subgroups: {} });
  
  const [loadedVideos, setLoadedVideos] = useState<Record<string, Video[]>>({});
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({});

  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  
  const [isSubgroupDialogOpen, setIsSubgroupDialogOpen] = useState(false);
  const [selectedSubgroup, setSelectedSubgroup] = useState<any>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchMetadata = useCallback(async () => {
    setIsPageLoading(true);
    try {
      const [groupsRes, subRes] = await Promise.all([
        supabase.from('video_groups').select('*').order('order'),
        supabase.from('video_subgroups').select('*').order('order')
      ]);

      const fetchedGroups = groupsRes.data || [];
      const fetchedSubgroups = subRes.data || [];

      // Parallelized head-count queries for accurate results without row limits
      const groupCountPromises = fetchedGroups.map(g => 
        supabase.from('videos').select('id', { count: 'exact', head: true }).eq('group_id', g.id)
      );
      const subCountPromises = fetchedSubgroups.map(sg => 
        supabase.from('videos').select('id', { count: 'exact', head: true }).eq('subgroup_id', sg.id)
      );

      const groupCountResults = await Promise.all(groupCountPromises);
      const subCountResults = await Promise.all(subCountPromises);

      const groupCounts: Record<string, number> = {};
      const subCounts: Record<string, number> = {};

      fetchedGroups.forEach((g, i) => {
        groupCounts[g.id] = groupCountResults[i].count || 0;
      });
      fetchedSubgroups.forEach((sg, i) => {
        subCounts[sg.id] = subCountResults[i].count || 0;
      });

      setGroups(fetchedGroups);
      setSubgroups(fetchedSubgroups);
      setCounts({ groups: groupCounts, subgroups: subCounts });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsPageLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMetadata();
  }, [fetchMetadata]);

  const fetchVideosForSection = async (id: string, type: 'group' | 'subgroup') => {
    if (loadedVideos[id] || loadingState[id]) return;

    setLoadingState(prev => ({ ...prev, [id]: true }));
    let allData: Video[] = [];
    let hasMore = true;
    let offset = 0;
    const CHUNK_SIZE = 1000;

    try {
      while (hasMore) {
        let query = supabase.from('videos').select('*').order('order', { ascending: true }).range(offset, offset + CHUNK_SIZE - 1);
        if (type === 'subgroup') query = query.eq('subgroup_id', id);
        else query = query.eq('group_id', id).is('subgroup_id', null);

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
            allData = [...allData, ...(data as Video[])];
            offset += CHUNK_SIZE;
            hasMore = data.length === CHUNK_SIZE;
        } else {
            hasMore = false;
        }
      }
      setLoadedVideos(prev => ({ ...prev, [id]: allData }));
    } catch (error: any) {
      toast({ title: "Fetch Failed", description: error.message, variant: "destructive" });
    } finally {
      setLoadingState(prev => ({ ...prev, [id]: false }));
    }
  };

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
          sub_category_order: parseInt(row['Sub-Category Order']) || 0,
          video_title: row['Video Title'],
          order: parseInt(row['Display Number (Order)']) || 0,
          video_id: String(row['Vimeo ID'] || '').trim(),
        })).filter(v => v.parent_category && v.video_title && v.video_id);

        if (videosToUpload.length === 0) throw new Error("No valid data found matching required headers.");

        const CHUNK_SIZE = 50;
        let successCount = 0;

        for (let i = 0; i < videosToUpload.length; i += CHUNK_SIZE) {
          const chunk = videosToUpload.slice(i, i + CHUNK_SIZE);
          const { data: res, error } = await supabase.functions.invoke('bulk-upload-videos', {
            body: { videos: chunk },
          });
          if (error) throw error;
          successCount += (res.successCount || 0);
        }

        toast({ title: "Import Complete", description: `Processed ${successCount} videos.` });
        setSelectedFile(null);
        setLoadedVideos({}); 
        fetchMetadata();
      } catch (err: any) {
        toast({ title: "Upload Error", description: err.message, variant: "destructive" });
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const handleDeleteVideo = async (id: string) => {
    if (!window.confirm("Delete this video permanently?")) return;
    const { error } = await supabase.from('videos').delete().eq('id', id);
    if (!error) {
      toast({ title: "Deleted" });
      setLoadedVideos({});
      fetchMetadata();
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (!window.confirm("Delete this group? Videos will be uncategorized.")) return;
    const { error } = await supabase.from('video_groups').delete().eq('id', id);
    if (!error) fetchMetadata();
  };

  const handleDeleteSubgroup = async (id: string) => {
    if (!window.confirm("Delete this sub-group? Videos will move to parent group.")) return;
    const { error } = await supabase.from('video_subgroups').delete().eq('id', id);
    if (!error) fetchMetadata();
  };

  const VideoRow = ({ video }: { video: Video }) => (
    <div className="flex items-center justify-between p-2 border rounded-lg bg-background hover:bg-muted/50 transition-all group shadow-sm">
      <div className="flex items-center gap-2 overflow-hidden">
        <div className="h-6 w-6 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
          <PlayCircle className="h-3 w-3 text-primary/40" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-[11px] truncate leading-none mb-1">
            <span className="text-primary/40 mr-1">#{video.order}</span> {video.title}
          </p>
          <p className="text-[8px] text-muted-foreground uppercase font-black">ID: {video.youtube_video_id}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setSelectedVideo(video); setIsVideoDialogOpen(true); }}>
          <Edit className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteVideo(video.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  const groupColumns: ColumnDef<any>[] = [
    { accessorKey: 'order', header: 'Order' },
    { accessorKey: 'name', header: 'Group Name' },
    { id: 'actions', cell: ({ row }) => (
      <div className="flex gap-1 justify-end">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSelectedGroup(row.original); setIsGroupDialogOpen(true); }}><Edit className="h-3 w-3"/></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteGroup(row.original.id)}><Trash2 className="h-3 w-3"/></Button>
      </div>
    )}
  ];

  const subgroupColumns: ColumnDef<any>[] = [
    { accessorKey: 'order', header: 'Order' },
    { accessorKey: 'name', header: 'Sub-group Name' },
    { 
        accessorKey: 'group_id', 
        header: 'Parent',
        cell: ({ row }) => groups.find(g => g.id === row.original.group_id)?.name || 'Unknown'
    },
    { id: 'actions', cell: ({ row }) => (
      <div className="flex gap-1 justify-end">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSelectedSubgroup(row.original); setIsSubgroupDialogOpen(true); }}><Edit className="h-3 w-3"/></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSubgroup(row.original.id)}><Trash2 className="h-3 w-3"/></Button>
      </div>
    )}
  ];

  if (isPageLoading) return <LoadingBar />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center gap-4">
        <h1 className="text-xl font-black tracking-tight uppercase">Video CMS</h1>
        <Button onClick={() => { setSelectedVideo(null); setIsVideoDialogOpen(true); }} size="sm" className="rounded-lg h-8 px-4">
          <Plus className="h-3 w-3 mr-2" /> New Lesson
        </Button>
      </div>

      <Tabs defaultValue="curriculum" className="w-full">
        <TabsList className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 mb-4">
          <TabsTrigger value="curriculum" className="rounded-md px-4 text-xs">Hierarchy</TabsTrigger>
          <TabsTrigger value="groups" className="rounded-md px-4 text-xs">Main Groups</TabsTrigger>
          <TabsTrigger value="subgroups" className="rounded-md px-4 text-xs">Sub-groups</TabsTrigger>
          <TabsTrigger value="bulk" className="rounded-md px-4 text-xs">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="curriculum" className="space-y-3">
          <Accordion type="multiple" className="space-y-3">
            {groups.map((group) => {
              const groupSubgroups = subgroups.filter(sg => sg.group_id === group.id);
              const totalVideosInGroup = counts.groups[group.id] || 0;
              
              return (
                <AccordionItem 
                  key={group.id} 
                  value={group.id} 
                  className="border rounded-xl bg-card overflow-hidden shadow-sm"
                  onClick={() => fetchVideosForSection(group.id, 'group')}
                >
                  <AccordionTrigger className="px-4 py-3 hover:bg-muted/30 hover:no-underline bg-muted/10 border-b">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3 text-left">
                        <GripVertical className="h-4 w-4 opacity-30" />
                        <span className="font-black text-sm tracking-tight text-foreground/90 uppercase">{group.name}</span>
                      </div>
                      <Badge variant="secondary" className="h-5 px-2 rounded-md bg-slate-100 text-slate-900 font-black text-[9px] border">
                        {totalVideosInGroup}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-3 bg-muted/5 space-y-4">
                    
                    <div className="space-y-2">
                      {loadingState[group.id] ? (
                        <div className="flex items-center justify-center py-4"><Loader2 className="animate-spin h-5 w-5 text-primary" /></div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {loadedVideos[group.id]?.map(v => <VideoRow key={v.id} video={v} />)}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Accordion type="multiple" className="space-y-2">
                        {groupSubgroups.map(sg => {
                          const videosInSubgroup = counts.subgroups[sg.id] || 0;
                          return (
                            <AccordionItem 
                              key={sg.id} 
                              value={sg.id} 
                              className="border rounded-lg bg-background shadow-sm overflow-hidden"
                              onClick={(e) => { e.stopPropagation(); fetchVideosForSection(sg.id, 'subgroup'); }}
                            >
                              <AccordionTrigger className="px-3 py-2 hover:no-underline hover:bg-muted/10">
                                <div className="flex items-center justify-between w-full pr-2">
                                  <div className="flex items-center gap-2 text-left">
                                    <FolderTree className="h-3 w-3 opacity-50" />
                                    <span className="font-bold text-[12px] text-foreground/80 uppercase">{sg.name}</span>
                                  </div>
                                  <Badge variant="outline" className="text-[9px] h-4 px-1 font-black">
                                    {videosInSubgroup}
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="p-2 border-t bg-muted/5">
                                {loadingState[sg.id] ? (
                                  <div className="flex items-center justify-center py-4"><Loader2 className="animate-spin h-4 w-4 text-primary" /></div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                    {loadedVideos[sg.id]?.map(v => <VideoRow key={v.id} video={v} />)}
                                  </div>
                                )}
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </TabsContent>

        <TabsContent value="groups">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
               <div>
                 <CardTitle className="text-sm font-black uppercase">Main Groups</CardTitle>
                 <CardDescription className="text-[10px]">Manage top-level curriculum categories.</CardDescription>
               </div>
               <Button size="sm" onClick={() => { setSelectedGroup(null); setIsGroupDialogOpen(true); }}><Plus className="h-3 w-3 mr-2"/> Add Group</Button>
            </CardHeader>
            <CardContent className="pt-4">
              <DataTable columns={groupColumns} data={groups} pageSize={20} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subgroups">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
               <div>
                 <CardTitle className="text-sm font-black uppercase">Sub-groups (Topics)</CardTitle>
                 <CardDescription className="text-[10px]">Manage nested chapters under main groups.</CardDescription>
               </div>
               <Button size="sm" onClick={() => { setSelectedSubgroup(null); setIsSubgroupDialogOpen(true); }}><Plus className="h-3 w-3 mr-2"/> Add Sub-group</Button>
            </CardHeader>
            <CardContent className="pt-4">
              <DataTable columns={subgroupColumns} data={subgroups} pageSize={20} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card className="max-w-4xl border-none shadow-md mx-auto">
            <CardHeader className="bg-primary text-primary-foreground py-6 text-center rounded-t-xl">
              <CardTitle className="text-lg font-black uppercase flex justify-center items-center gap-2">
                <UploadCloud className="h-5 w-5" /> Data Import
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-6 text-center">
               <div className="p-6 border-2 border-dashed border-primary/20 rounded-xl bg-primary/5 cursor-pointer">
                  <Input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleFileChange}
                    className="hidden"
                    id="excel-video-upload"
                  />
                  <Label htmlFor="excel-video-upload" className="cursor-pointer space-y-2">
                      <FileSpreadsheet className="h-8 w-8 text-primary mx-auto" />
                      <div>
                        <p className="font-black text-xs text-primary">{selectedFile ? selectedFile.name : "Select Excel"}</p>
                        <p className="text-[10px] text-muted-foreground">Required Headers: Parent Category | Sub-Category | Sub-Category Order | Video Title | Display Number (Order) | Vimeo ID</p>
                      </div>
                  </Label>
               </div>
               <Button 
                 onClick={handleBulkUpload} 
                 disabled={isUploading || !selectedFile} 
                 className="w-full h-10 rounded-lg text-sm font-black uppercase"
               >
                 {isUploading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Working...</> : "Import All"}
               </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditVideoDialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen} video={selectedVideo} onSave={() => { setLoadedVideos({}); fetchMetadata(); }} />
      <EditVideoGroupDialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen} group={selectedGroup} onSave={fetchMetadata} />
      <EditVideoSubgroupDialog open={isSubgroupDialogOpen} onOpenChange={setIsSubgroupDialogOpen} subgroup={selectedSubgroup} onSave={fetchMetadata} />
      <MadeWithDyad />
    </div>
  );
};

export default ManageVideosPage;