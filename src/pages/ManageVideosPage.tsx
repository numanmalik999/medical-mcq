"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [isSubgroupDialogOpen, setIsSubgroupDialogOpen] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchMetadata = useCallback(async () => {
    setIsPageLoading(true);
    try {
      const [groupsRes, subRes, allVideosRes] = await Promise.all([
        supabase.from('video_groups').select('*').order('order'),
        supabase.from('video_subgroups').select('*').order('order'),
        supabase.from('videos').select('group_id, subgroup_id')
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (subRes.error) throw subRes.error;

      setGroups(groupsRes.data || []);
      setSubgroups(subRes.data || []);

      const groupCounts: Record<string, number> = {};
      const subCounts: Record<string, number> = {};

      allVideosRes.data?.forEach(v => {
        if (v.group_id) groupCounts[v.group_id] = (groupCounts[v.group_id] || 0) + 1;
        if (v.subgroup_id) subCounts[v.subgroup_id] = (subCounts[v.subgroup_id] || 0) + 1;
      });

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
    try {
      const query = supabase.from('videos').select('*').order('order', { ascending: true });
      if (type === 'subgroup') query.eq('subgroup_id', id);
      else query.eq('group_id', id).is('subgroup_id', null);

      const { data, error } = await query;
      if (error) throw error;

      setLoadedVideos(prev => ({ ...prev, [id]: data || [] }));
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
    setUploadProgress("Analyzing Spreadsheet...");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        const findVal = (row: any, keys: string[]) => {
          const rowKeys = Object.keys(row);
          for (const key of keys) {
            const found = rowKeys.find(rk => rk.toLowerCase().trim() === key.toLowerCase().trim());
            if (found) return row[found];
          }
          return undefined;
        };

        const videosToUpload = json.map(row => ({
          parent_category: findVal(row, ['Parent Category', 'Category', 'Parent']),
          sub_category: findVal(row, ['Sub-Category', 'Topic', 'Subcategory']),
          sub_category_order: parseInt(findVal(row, ['Sub-Category Order', 'Sub Order'])) || 0,
          video_title: findVal(row, ['Video Title', 'Title', 'Name']),
          order: parseInt(findVal(row, ['Display Number (Order)', 'Display Order', 'Order'])) || 0,
          video_id: String(findVal(row, ['Vimeo ID', 'Video ID', 'ID']) || '').trim(),
        })).filter(v => v.parent_category && v.video_title && v.video_id);

        if (videosToUpload.length === 0) throw new Error("No valid data found.");

        const CHUNK_SIZE = 50;
        let successCount = 0;

        for (let i = 0; i < videosToUpload.length; i += CHUNK_SIZE) {
          const chunk = videosToUpload.slice(i, i + CHUNK_SIZE);
          setUploadProgress(`Processing ${i + chunk.length} of ${videosToUpload.length}...`);
          
          const { data: res, error } = await supabase.functions.invoke('bulk-upload-videos', {
            body: { videos: chunk },
          });
          if (error) throw error;
          successCount += (res.successCount || 0);
        }

        toast({ title: "Import Complete", description: `Successfully processed ${successCount} videos.` });
        setSelectedFile(null);
        setLoadedVideos({}); // Clear cache
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

  const VideoRow = ({ video }: { video: Video }) => (
    <div className="flex items-center justify-between p-3 border rounded-xl bg-background hover:bg-muted/50 transition-all group shadow-sm">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center shrink-0">
          <PlayCircle className="h-4 w-4 text-primary/40" />
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sm truncate leading-none mb-1">
            <span className="text-primary/40 mr-1">#{video.order}</span> {video.title}
          </p>
          <Badge variant="secondary" className="text-[8px] h-3 px-1 uppercase font-black tracking-tighter">
            {video.platform} ID: {video.youtube_video_id}
          </Badge>
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
          <h1 className="text-3xl font-bold tracking-tight">Enterprise Video CMS</h1>
          <p className="text-muted-foreground text-sm">Managing curriculum with on-demand loading for high performance.</p>
        </div>
        <Button onClick={() => { setSelectedVideo(null); setIsVideoDialogOpen(true); }} className="rounded-full shadow-lg">
          <Plus className="h-4 w-4 mr-2" /> Single Lesson
        </Button>
      </div>

      <Tabs defaultValue="curriculum" className="w-full">
        <TabsList className="inline-flex h-11 items-center justify-center rounded-full bg-muted p-1 mb-8">
          <TabsTrigger value="curriculum" className="rounded-full px-8">Hierarchy View</TabsTrigger>
          <TabsTrigger value="bulk" className="rounded-full px-8">Excel Import</TabsTrigger>
        </TabsList>

        <TabsContent value="curriculum" className="space-y-6">
          <Accordion type="multiple" className="space-y-6">
            {groups.map((group) => {
              const groupSubgroups = subgroups.filter(sg => sg.group_id === group.id);
              const totalVideosInGroup = counts.groups[group.id] || 0;
              
              return (
                <AccordionItem 
                  key={group.id} 
                  value={group.id} 
                  className="border rounded-2xl bg-card overflow-hidden shadow-md border-border/60"
                  onClick={() => fetchVideosForSection(group.id, 'group')}
                >
                  <AccordionTrigger className="px-6 py-6 hover:bg-muted/30 hover:no-underline bg-muted/10 border-b">
                    <div className="flex items-center justify-between w-full pr-6">
                      <div className="flex items-center gap-4 text-left">
                        <div className="p-3 bg-primary/5 rounded-2xl text-primary shadow-inner">
                          <GripVertical className="h-6 w-6 opacity-30" />
                        </div>
                        <div>
                          <span className="font-black text-2xl tracking-tight text-foreground/90 uppercase">{group.name}</span>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">Primary Category (Order: {group.order})</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="h-8 px-4 rounded-xl bg-slate-100 text-slate-900 font-black border shadow-sm">
                        {totalVideosInGroup} Videos
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-6 bg-muted/5 space-y-8">
                    
                    <div className="space-y-4">
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60 px-1">Ungrouped Lessons</h3>
                      {loadingState[group.id] ? (
                        <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-primary" /></div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {loadedVideos[group.id]?.map(v => <VideoRow key={v.id} video={v} />)}
                          {(!loadedVideos[group.id] || loadedVideos[group.id].length === 0) && !loadingState[group.id] && (
                            <p className="text-xs text-muted-foreground italic col-span-2 text-center py-4">No standalone lessons in this category.</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60 px-1">Curriculum Sub-groups</h3>
                      <Accordion type="multiple" className="space-y-4">
                        {groupSubgroups.map(sg => {
                          const videosInSubgroup = counts.subgroups[sg.id] || 0;
                          return (
                            <AccordionItem 
                              key={sg.id} 
                              value={sg.id} 
                              className="border rounded-xl bg-background shadow-sm overflow-hidden"
                              onClick={(e) => { e.stopPropagation(); fetchVideosForSection(sg.id, 'subgroup'); }}
                            >
                              <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/10">
                                <div className="flex items-center justify-between w-full pr-4">
                                  <div className="flex items-center gap-3 text-left">
                                    <div className="p-2 bg-muted rounded-lg"><FolderTree className="h-4 w-4 opacity-50" /></div>
                                    <div>
                                      <span className="font-bold text-base text-foreground/80">{sg.name}</span>
                                      <p className="text-[10px] text-muted-foreground">Order: {sg.order}</p>
                                    </div>
                                  </div>
                                  <Badge variant="outline" className="text-[10px] font-bold">
                                    {videosInSubgroup} Lessons
                                  </Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent className="p-5 pt-2 border-t bg-muted/5">
                                {loadingState[sg.id] ? (
                                  <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin h-5 w-5 text-primary" /></div>
                                ) : (
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                    {loadedVideos[sg.id]?.map(v => <VideoRow key={v.id} video={v} />)}
                                    {(!loadedVideos[sg.id] || loadedVideos[sg.id].length === 0) && (
                                      <p className="text-xs text-muted-foreground italic col-span-2 text-center py-4">No lessons assigned to this sub-group.</p>
                                    )}
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

        <TabsContent value="bulk">
          <Card className="max-w-4xl border-none shadow-xl mx-auto">
            <CardHeader className="bg-primary text-primary-foreground py-10 text-center rounded-t-3xl">
              <CardTitle className="text-3xl font-black uppercase tracking-tight flex justify-center items-center gap-3">
                <UploadCloud className="h-8 w-8" /> Data Import
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
               <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-primary/20 rounded-3xl bg-primary/5 hover:bg-primary/10 transition-colors group cursor-pointer">
                  <Input 
                    type="file" 
                    accept=".xlsx, .xls, .csv" 
                    onChange={handleFileChange}
                    className="hidden"
                    id="excel-video-upload"
                  />
                  <Label htmlFor="excel-video-upload" className="cursor-pointer text-center space-y-4">
                      <div className="bg-background p-5 rounded-full w-fit mx-auto shadow-xl">
                        <FileSpreadsheet className="h-10 w-10 text-primary" />
                      </div>
                      <div>
                        <p className="font-black text-lg text-primary">{selectedFile ? selectedFile.name : "Choose Excel File"}</p>
                        <p className="text-xs text-muted-foreground font-medium">Headers: Parent Category, Sub-Category, Video Title, Vimeo ID</p>
                      </div>
                  </Label>
               </div>
               <Button 
                 onClick={handleBulkUpload} 
                 disabled={isUploading || !selectedFile} 
                 className="w-full h-16 rounded-2xl text-xl font-black uppercase shadow-2xl"
               >
                 {isUploading ? <><Loader2 className="h-6 w-6 animate-spin mr-3" /> {uploadProgress}</> : "Execute Bulk Upload"}
               </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EditVideoDialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen} video={selectedVideo} onSave={() => { setLoadedVideos({}); fetchMetadata(); }} />
      <EditVideoGroupDialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen} group={null} onSave={fetchMetadata} />
      <EditVideoSubgroupDialog open={isSubgroupDialogOpen} onOpenChange={setIsSubgroupDialogOpen} subgroup={null} onSave={fetchMetadata} />
      <MadeWithDyad />
    </div>
  );
};

export default ManageVideosPage;