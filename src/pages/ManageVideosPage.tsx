"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Edit, 
  FolderTree, 
  Plus,
  PlayCircle,
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  ChevronRight,
  ImageIcon,
  MonitorPlay
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EditVideoDialog from '@/components/EditVideoDialog';
import EditVideoGroupDialog, { VideoGroup } from '@/components/EditVideoGroupDialog';
import EditVideoSubgroupDialog from '@/components/EditVideoSubgroupDialog';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LoadingBar from '@/components/LoadingBar';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { DataTable } from '@/components/data-table';
import { ColumnDef } from '@tanstack/react-table';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { dismissToast, showLoading } from '@/utils/toast';

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
  const detailsRef = useRef<HTMLDivElement>(null);
  
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [groups, setGroups] = useState<VideoGroup[]>([]);
  const [subgroups, setSubgroups] = useState<any[]>([]);
  const [counts, setCounts] = useState<VideoCounts>({ groups: {}, subgroups: {} });
  
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [loadedVideos, setLoadedVideos] = useState<Record<string, Video[]>>({});
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({});

  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<VideoGroup | null>(null);
  
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

  const handleGroupCardClick = (groupId: string) => {
    const isTogglingOff = activeGroupId === groupId;
    setActiveGroupId(isTogglingOff ? null : groupId);
    
    if (!isTogglingOff) {
        fetchVideosForSection(groupId, 'group');
        setTimeout(() => {
            detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleBulkUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    let loadingId: string | number | undefined;
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        const BATCH_SIZE = 50;
        let totalSuccess = 0;
        let totalError = 0;
        const allErrors: string[] = [];

        loadingId = showLoading(`Preparing to import ${json.length} videos...`);

        for (let i = 0; i < json.length; i += BATCH_SIZE) {
            const batch = json.slice(i, i + BATCH_SIZE);
            const currentBatchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(json.length / BATCH_SIZE);

            toast({ title: "Importing...", description: `Processing batch ${currentBatchNum} of ${totalBatches}...` });

            const { data: response, error } = await supabase.functions.invoke('bulk-upload-videos', {
              body: { videos: batch }
            });

            if (error) {
                totalError += batch.length;
                allErrors.push(`Batch ${currentBatchNum} failed: ${error.message}`);
                continue;
            }

            totalSuccess += response.successCount;
            totalError += response.errorCount;
            if (response.errors) allErrors.push(...response.errors);
        }

        if (loadingId) dismissToast(loadingId);
        
        if (totalError > 0) {
            toast({ 
                title: "Upload Completed with Errors", 
                description: `Imported ${totalSuccess} videos. ${totalError} items failed. See console for details.`,
                variant: "destructive"
            });
            console.error("Bulk Upload Errors:", allErrors);
        } else {
            toast({ title: "Upload Success", description: `Successfully imported ${totalSuccess} videos.` });
        }
        
        setSelectedFile(null);
        setLoadedVideos({});
        fetchMetadata();
      };
      reader.readAsArrayBuffer(selectedFile);
    } catch (error: any) {
      if (loadingId) dismissToast(loadingId);
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const VideoRow = ({ video }: { video: Video }) => (
    <div className="flex items-center justify-between p-3 border rounded-xl bg-background hover:bg-muted/50 transition-all group shadow-sm">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center shrink-0 border border-primary/10">
          <PlayCircle className="h-4 w-4 text-primary/60" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-xs truncate leading-none mb-1">
            <span className="text-primary/40 mr-1">#{video.order}</span> {video.title}
          </p>
          <p className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter">ID: {video.youtube_video_id}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setSelectedVideo(video); setIsVideoDialogOpen(true); }}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); handleDeleteVideo(video.id); }}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const groupColumns: ColumnDef<any>[] = [
    { accessorKey: 'order', header: 'Order' },
    { accessorKey: 'name', header: 'Group Name', cell: ({ row }) => <span className="font-bold">{row.original.name}</span> },
    { id: 'actions', cell: ({ row }) => (
      <div className="flex gap-1 justify-end">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSelectedGroup(row.original); setIsGroupDialogOpen(true); }}><Edit className="h-3 w-3"/></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if(window.confirm('Delete group?')) supabase.from('video_groups').delete().eq('id', row.original.id).then(() => fetchMetadata()); }}><Trash2 className="h-3 w-3"/></Button>
      </div>
    )}
  ];

  const subgroupColumns: ColumnDef<any>[] = [
    { accessorKey: 'order', header: 'Order' },
    { accessorKey: 'name', header: 'Topic Name' },
    { 
      id: 'parent', 
      header: 'Specialty', 
      cell: ({ row }) => groups.find(g => g.id === row.original.group_id)?.name || 'Unknown' 
    },
    { id: 'actions', cell: ({ row }) => (
      <div className="flex gap-1 justify-end">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setSelectedSubgroup(row.original); setIsSubgroupDialogOpen(true); }}><Edit className="h-3 w-3"/></Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => { if(window.confirm('Delete topic?')) supabase.from('video_subgroups').delete().eq('id', row.original.id).then(() => fetchMetadata()); }}><Trash2 className="h-3 w-3"/></Button>
      </div>
    )}
  ];

  if (isPageLoading) return <LoadingBar />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-2xl font-black tracking-tight uppercase italic flex items-center gap-2">
                <MonitorPlay className="h-6 w-6 text-primary" /> Video Masterclass CMS
            </h1>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Manage curriculum structure and streaming content</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <Button onClick={() => { setSelectedGroup(null); setIsGroupDialogOpen(true); }} variant="outline" size="sm" className="rounded-lg h-9 font-bold px-4 flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" /> New Category
            </Button>
            <Button onClick={() => { setSelectedVideo(null); setIsVideoDialogOpen(true); }} size="sm" className="rounded-lg h-9 font-bold px-4 flex-1 sm:flex-none">
              <Plus className="h-4 w-4 mr-2" /> New Lesson
            </Button>
        </div>
      </div>

      <Tabs defaultValue="grid" className="w-full">
        <TabsList className="inline-flex h-10 items-center justify-center rounded-xl bg-muted p-1 mb-6 shadow-inner">
          <TabsTrigger value="grid" className="rounded-lg px-6 text-[10px] font-black uppercase tracking-widest data-[state=active]:shadow-sm">Card Grid</TabsTrigger>
          <TabsTrigger value="groups" className="rounded-lg px-6 text-[10px] font-black uppercase tracking-widest data-[state=active]:shadow-sm">Group List</TabsTrigger>
          <TabsTrigger value="subgroups" className="rounded-lg px-6 text-[10px] font-black uppercase tracking-widest data-[state=active]:shadow-sm">Topic List</TabsTrigger>
          <TabsTrigger value="bulk" className="rounded-lg px-6 text-[10px] font-black uppercase tracking-widest data-[state=active]:shadow-sm">Import/Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="space-y-8 animate-in fade-in duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {groups.map((group) => {
              const isActive = activeGroupId === group.id;
              const videoCount = counts.groups[group.id] || 0;
              
              return (
                <Card 
                  key={group.id} 
                  className={cn(
                    "group cursor-pointer overflow-hidden transition-all duration-300 border-2 rounded-2xl shadow-sm hover:shadow-xl",
                    isActive ? "border-primary ring-4 ring-primary/5" : "border-transparent bg-white hover:border-primary/20"
                  )}
                  onClick={() => handleGroupCardClick(group.id)}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
                     {group.image_url ? (
                        <img src={group.image_url} alt={group.name} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center opacity-20">
                            <ImageIcon className="h-10 w-10" />
                        </div>
                     )}
                     <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="font-black text-[10px] h-6 px-3 rounded-full shadow-lg border-white/20">
                            {videoCount} LESSONS
                        </Badge>
                     </div>
                  </div>
                  <CardHeader className="p-4 space-y-1">
                    <CardTitle className="text-sm font-black uppercase tracking-tighter leading-tight whitespace-normal">{group.name}</CardTitle>
                    <CardDescription className="text-[10px] font-medium line-clamp-2 h-7 italic">
                        {group.description || "Comprehensive clinical video modules."}
                    </CardDescription>
                  </CardHeader>
                  <CardFooter className="p-4 pt-0 flex justify-between items-center border-t border-slate-50 mt-2">
                     <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-primary/5" onClick={(e) => { e.stopPropagation(); setSelectedGroup(group); setIsGroupDialogOpen(true); }}>
                           <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-destructive/5 text-destructive" onClick={(e) => { e.stopPropagation(); if(window.confirm('Delete category?')) supabase.from('video_groups').delete().eq('id', group.id).then(() => fetchMetadata()); }}>
                           <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                     </div>
                     <div className="flex items-center gap-1 text-primary font-black text-[10px] uppercase">
                        Manage <ChevronRight className="h-3 w-3" />
                     </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>

          {activeGroupId && (
            <div ref={detailsRef} className="pt-8 border-t space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary rounded-xl text-white shadow-lg">
                        <FolderTree className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tighter leading-tight whitespace-normal">
                            {groups.find(g => g.id === activeGroupId)?.name}
                        </h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Curriculum Breakdown</p>
                    </div>
                </div>

                <div className="space-y-4">
                  {loadedVideos[activeGroupId]?.length > 0 && (
                     <div className="space-y-2">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-1">Ungrouped Lessons</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {loadedVideos[activeGroupId].map(v => <VideoRow key={v.id} video={v} />)}
                        </div>
                     </div>
                  )}

                  <Accordion type="multiple" className="space-y-3">
                    {subgroups.filter(sg => sg.group_id === activeGroupId).map((sg) => {
                        const subVideoCount = counts.subgroups[sg.id] || 0;
                        return (
                            <AccordionItem 
                                key={sg.id} 
                                value={sg.id} 
                                className="border rounded-2xl bg-white shadow-sm overflow-hidden"
                                onClick={() => fetchVideosForSection(sg.id, 'subgroup')}
                            >
                                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/10 group">
                                    <div className="flex items-center justify-between w-full pr-4">
                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="h-7 w-7 rounded-full p-0 flex items-center justify-center font-black">
                                                {sg.order}
                                            </Badge>
                                            <span className="font-bold text-sm uppercase tracking-tight text-slate-800 leading-tight whitespace-normal text-left">{sg.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <Badge className="font-black text-[9px] px-2 h-5 bg-slate-100 text-slate-900 border">{subVideoCount} LESSONS</Badge>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedSubgroup(sg); setIsSubgroupDialogOpen(true); }}>
                                                    <Edit className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-5 pb-5 pt-2 bg-muted/5 border-t border-slate-50">
                                    {loadingState[sg.id] ? (
                                        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary/20" /></div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                                            {loadedVideos[sg.id]?.map(v => <VideoRow key={v.id} video={v} />)}
                                            {loadedVideos[sg.id]?.length === 0 && <p className="col-span-full text-center py-6 text-[10px] font-bold text-muted-foreground uppercase">No lessons in this topic yet.</p>}
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        );
                    })}
                  </Accordion>
                  <Button variant="outline" className="w-full h-12 rounded-2xl border-dashed border-2 font-bold uppercase tracking-wider gap-2 text-xs" onClick={() => { setSelectedSubgroup(null); setIsSubgroupDialogOpen(true); }}>
                      <Plus className="h-4 w-4" /> Add Topic to Category
                  </Button>
                </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="groups">
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
               <div>
                 <CardTitle className="text-sm font-black uppercase">Specialty Categories</CardTitle>
                 <CardDescription className="text-[10px] uppercase font-bold tracking-tight">Top-level curriculum hierarchy</CardDescription>
               </div>
               <Button size="sm" onClick={() => { setSelectedGroup(null); setIsGroupDialogOpen(true); }} className="rounded-lg h-8 px-4 font-bold text-xs"><Plus className="h-3 w-3 mr-2"/> Add Specialty</Button>
            </CardHeader>
            <CardContent className="pt-4">
              <DataTable columns={groupColumns} data={groups} pageSize={20} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subgroups">
          <Card className="border-none shadow-md rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
               <div>
                 <CardTitle className="text-sm font-black uppercase">Topics & Chapters</CardTitle>
                 <CardDescription className="text-[10px] uppercase font-bold tracking-tight">Nested subjects within specialties</CardDescription>
               </div>
               <Button size="sm" onClick={() => { setSelectedSubgroup(null); setIsSubgroupDialogOpen(true); }} className="rounded-lg h-8 px-4 font-bold text-xs"><Plus className="h-3 w-3 mr-2"/> Add Topic</Button>
            </CardHeader>
            <CardContent className="pt-4">
              <DataTable columns={subgroupColumns} data={subgroups} pageSize={20} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bulk">
          <Card className="max-w-4xl border-none shadow-xl mx-auto rounded-3xl overflow-hidden">
            <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
              <CardTitle className="text-2xl font-black uppercase flex justify-center items-center gap-3">
                <UploadCloud className="h-8 w-8 text-primary-foreground/50" /> Bulk Import
              </CardTitle>
              <CardDescription className="text-primary-foreground/70 font-medium">Sync your entire Vimeo library via spreadsheet</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
               <div className="p-10 border-4 border-dashed border-primary/10 rounded-3xl bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer text-center relative group">
                  <input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleFileChange}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    id="excel-video-upload"
                  />
                  <div className="space-y-4">
                      <div className="h-16 w-16 bg-white rounded-2xl shadow-lg flex items-center justify-center mx-auto transition-transform group-hover:scale-110">
                        <FileSpreadsheet className="h-8 w-8 text-primary" />
                      </div>
                      <div>
                        <p className="font-black text-lg text-primary">{selectedFile ? selectedFile.name : "Drop Spreadsheet Here"}</p>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-2 max-w-sm mx-auto">
                            Requires: Parent Category | Sub-Category | Sub-Category Order | Video Title | Display Number (Order) | Vimeo ID
                        </p>
                      </div>
                  </div>
               </div>
               <Button 
                 onClick={handleBulkUpload} 
                 disabled={isUploading || !selectedFile} 
                 className="w-full h-14 rounded-2xl text-lg font-black uppercase tracking-widest shadow-xl transition-all active:scale-95"
               >
                 {isUploading ? <><Loader2 className="h-6 w-6 animate-spin mr-3" /> Syncing Content...</> : "Publish to Curriculum"}
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