"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Loader2, 
  CheckCircle2, 
  Circle, 
  Layers, 
  AlertCircle,
  MonitorPlay,
  ChevronRight,
  ImageIcon,
  ArrowLeft,
  VideoIcon
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import SubscribePromptDialog from '@/components/SubscribePromptDialog';
import LoadingBar from '@/components/LoadingBar';

interface Video {
  id: string;
  title: string;
  description: string | null;
  youtube_video_id: string;
  platform: string;
  group_id: string | null;
  subgroup_id: string | null;
  order: number;
  video_groups?: { name: string } | null;
  video_subgroups?: { name: string } | null;
}

interface VideoCounts {
  groups: Record<string, number>;
  subgroups: Record<string, number>;
}

const UserVideosPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const contentRef = useRef<HTMLDivElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [subgroups, setSubgroups] = useState<any[]>([]);
  const [counts, setCounts] = useState<VideoCounts>({ groups: {}, subgroups: {} });
  
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [loadedVideos, setLoadedVideos] = useState<Record<string, Video[]>>({});
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({});
  const [progressMap, setProgressMap] = useState<Map<string, boolean>>(new Map());

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);

  // Helper to extract ID from potential full URLs
  const getCleanVimeoId = (input: string) => {
    if (!input) return "";
    const match = input.match(/(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:\w+\/)?|album\/(?:\d+\/)?video\/|video\/|)(\d+)(?:$|\/|\?)/);
    return match ? match[1] : input.trim();
  };

  const fetchMetadata = useCallback(async () => {
    try {
      const [groupsRes, subRes, progRes] = await Promise.all([
        supabase.from('video_groups').select('*').order('order'),
        supabase.from('video_subgroups').select('*').order('order'),
        user ? supabase.from('user_video_progress').select('video_id, is_watched').eq('user_id', user.id) : Promise.resolve({ data: [] }),
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

      const newProgressMap = new Map();
      progRes.data?.forEach(p => newProgressMap.set(p.video_id, p.is_watched));
      
      setProgressMap(newProgressMap);
      setGroups(fetchedGroups);
      setSubgroups(fetchedSubgroups);
      setCounts({ groups: groupCounts, subgroups: subCounts });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load library structure.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (hasCheckedInitialSession) fetchMetadata();
  }, [hasCheckedInitialSession, fetchMetadata]);

  const loadVideosForId = async (id: string, type: 'group' | 'subgroup') => {
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
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingState(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleGroupClick = (id: string) => {
    setActiveGroupId(id);
    loadVideosForId(id, 'group');
    setTimeout(() => {
        contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      let allResults: Video[] = [];
      let hasMore = true;
      let offset = 0;
      const CHUNK_SIZE = 1000;

      try {
        while (hasMore) {
          const { data, error = null } = await supabase
            .from('videos')
            .select('*, video_groups(name), video_subgroups(name)')
            .or(`title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
            .order('title', { ascending: true })
            .range(offset, offset + CHUNK_SIZE - 1);
          
          if (error) throw error;
          if (data && data.length > 0) {
            allResults = [...allResults, ...(data as Video[])];
            offset += CHUNK_SIZE;
            hasMore = data.length === CHUNK_SIZE && allResults.length < 5000;
          } else {
            hasMore = false;
          }
        }
        setSearchResults(allResults);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const toggleWatched = async (videoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) return;
    const newStatus = !(progressMap.get(videoId) || false);
    try {
      await supabase.from('user_video_progress').upsert({ user_id: user.id, video_id: videoId, is_watched: newStatus }, { onConflict: 'user_id,video_id' });
      setProgressMap(prev => new Map(prev).set(videoId, newStatus));
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleVideoClick = (video: Video) => {
    if (!user?.has_active_subscription) {
      setIsUpgradeDialogOpen(true);
      return;
    }
    setSelectedVideo(video);
  };

  const VideoCard = ({ video, showPath = false }: { video: Video, showPath?: boolean }) => {
    const isWatched = progressMap.get(video.id) || false;
    
    return (
      <Card 
        className={cn(
          "group relative overflow-hidden cursor-pointer transition-all border flex flex-col justify-between shadow-sm", 
          isWatched ? "border-green-500/20 bg-green-50/5" : "border-slate-100 bg-white"
        )}
        onClick={() => handleVideoClick(video)}
      >
        <div className="p-3 flex flex-col gap-1">
            <div className="flex items-start gap-3">
                <div className={cn(
                    "h-7 w-7 shrink-0 rounded flex items-center justify-center font-black text-[11px] transition-colors mt-0.5",
                    isWatched ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
                )}>
                    {video.order}
                </div>
                <div className="flex-grow min-w-0">
                    <h4 className="font-bold text-xs leading-tight text-slate-800 line-clamp-2">
                        {video.title}
                    </h4>
                    {showPath && (video.video_groups || video.video_subgroups) && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[9px] font-black uppercase text-primary/40 truncate max-w-[45%]">
                          {video.video_groups?.name || 'Uncategorized'}
                        </span>
                        {video.video_subgroups?.name && (
                          <>
                            <ChevronRight className="h-2 w-2 text-slate-300" />
                            <span className="text-[9px] font-bold uppercase text-slate-400 truncate max-w-[45%]">
                              {video.video_subgroups.name}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                </div>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-6 w-6 rounded-full shrink-0 -mt-1 -mr-1" 
                    onClick={(e) => toggleWatched(video.id, e)}
                    disabled={!user}
                >
                  {isWatched ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-slate-300" />}
                </Button>
            </div>
        </div>
      </Card>
    );
  };

  if (!hasCheckedInitialSession || isLoading) return <LoadingBar />;

  return (
    <div className="space-y-6 pb-12">
      <section className="relative overflow-hidden bg-primary rounded-2xl p-6 md:p-10 text-primary-foreground shadow-lg">
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="text-center lg:text-left">
            <h1 className="text-2xl md:text-4xl font-black tracking-tight uppercase italic leading-none mb-2">Expert Video Library</h1>
            <p className="text-primary-foreground/80 font-bold uppercase tracking-widest text-[10px] md:text-xs">Clinical masterclasses for DHA, SMLE & MOH</p>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
            <Input 
              placeholder="Search concepts, diseases, or tests..." 
              className="h-12 pl-12 rounded-xl bg-white text-slate-900 font-bold border-none shadow-xl text-sm" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
            {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto px-0">
        {searchTerm.trim() ? (
          <section className="animate-in fade-in space-y-4">
             <div className="flex items-center gap-2 px-1">
                <MonitorPlay className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-black uppercase tracking-tight">Search Results</h2>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
               {searchResults.map(v => <VideoCard key={v.id} video={v} showPath={true} />)}
               {searchResults.length === 0 && !isSearching && (
                 <Card className="col-span-full py-16 text-center rounded-3xl border-2 border-dashed">
                    <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-slate-400 font-black uppercase tracking-widest">No matching videos found</p>
                 </Card>
               )}
             </div>
          </section>
        ) : (
          <div className="space-y-12">
            <section className="animate-in fade-in duration-700">
                <div className="flex items-center gap-2 mb-6 px-1">
                    <Layers className="h-5 w-5 text-primary" />
                    <h2 className="text-sm font-black uppercase tracking-tight">Browse by Specialty</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {groups.map((group) => {
                    const totalVideos = counts.groups[group.id] || 0;
                    return (
                        <Card 
                            key={group.id} 
                            className={cn(
                                "group flex flex-col cursor-pointer overflow-hidden transition-all duration-300 border-2 rounded-3xl hover:shadow-2xl",
                                activeGroupId === group.id ? "border-primary shadow-xl bg-primary/5" : "border-transparent bg-white hover:border-primary/20"
                            )}
                            onClick={() => handleGroupClick(group.id)}
                        >
                            <div className="relative aspect-video w-full overflow-hidden bg-slate-100 border-b">
                            {group.image_url ? (
                                <img src={group.image_url} alt={group.name} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center opacity-20">
                                    <ImageIcon className="h-12 w-12" />
                                </div>
                            )}
                            <div className="absolute top-3 right-3">
                                <Badge className="font-black text-[10px] h-7 px-4 rounded-full shadow-lg bg-slate-900/80 backdrop-blur-md text-white border-white/20">
                                    {totalVideos} LESSONS
                                </Badge>
                            </div>
                            </div>
                            <CardHeader className="p-6 flex-grow space-y-2">
                            <CardTitle className="text-lg font-black uppercase tracking-tighter leading-tight whitespace-normal text-slate-900 group-hover:text-primary transition-colors">
                                {group.name}
                            </CardTitle>
                            <CardDescription className="text-xs font-medium leading-relaxed italic line-clamp-2 h-8">
                                {group.description || "Master core concepts and high-yield topics for this specialty."}
                            </CardDescription>
                            </CardHeader>
                            <CardFooter className="px-6 py-4 bg-slate-50/50 border-t border-slate-50 flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary/60">Study Now</span>
                                <ChevronRight className="h-5 w-5 text-primary group-hover:translate-x-1 transition-transform" />
                            </CardFooter>
                        </Card>
                    );
                    })}
                </div>
            </section>

            {activeGroupId && (
                <div ref={contentRef} className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pt-8 border-t">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b pb-6">
                        <div>
                            <h2 className="text-3xl font-black uppercase tracking-tighter leading-tight whitespace-normal max-w-3xl">
                                {groups.find(g => g.id === activeGroupId)?.name}
                            </h2>
                            <div className="flex items-center gap-2 mt-2">
                                <Badge variant="secondary" className="font-black text-[10px]">{counts.groups[activeGroupId]} Lessons Total</Badge>
                            </div>
                        </div>
                        <Button 
                            variant="ghost" 
                            onClick={() => setActiveGroupId(null)}
                            className="font-black uppercase tracking-widest text-[10px] gap-2 hover:bg-primary/5 h-8"
                        >
                            <ArrowLeft className="h-4 w-4" /> Close specialty
                        </Button>
                    </div>

                    <div className="space-y-8">
                        {/* Group-level Videos */}
                        {loadingState[activeGroupId] ? (
                        <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary/20" /></div>
                        ) : loadedVideos[activeGroupId]?.length > 0 && (
                        <section className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/40 px-1">Foundation Lessons</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                {loadedVideos[activeGroupId].map(v => <VideoCard key={v.id} video={v} />)}
                            </div>
                        </section>
                        )}

                        {/* Sub-groups (Chapters) */}
                        <section className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary/40 px-1">Specialty Topics</h3>
                            <Accordion type="multiple" className="space-y-3">
                                {subgroups.filter(sg => sg.group_id === activeGroupId).map(sg => (
                                    <AccordionItem 
                                        key={sg.id} 
                                        value={sg.id} 
                                        className="border rounded-2xl bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                                        onClick={() => loadVideosForId(sg.id, 'subgroup')}
                                    >
                                        <AccordionTrigger className="px-6 py-4 hover:bg-slate-50/50 hover:no-underline">
                                            <div className="flex items-center justify-between w-full pr-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-8 w-8 rounded-full border-2 border-primary/20 flex items-center justify-center font-black text-xs text-primary">
                                                        {sg.order}
                                                    </div>
                                                    <span className="font-bold text-sm uppercase tracking-tight text-left leading-tight whitespace-normal">{sg.name}</span>
                                                </div>
                                                <Badge variant="outline" className="font-black text-[10px] h-6 px-3">{counts.subgroups[sg.id]} Lessons</Badge>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="px-4 pb-4 pt-1 bg-slate-50/20 border-t border-slate-50">
                                            {loadingState[sg.id] ? (
                                                <div className="flex justify-center py-8"><Loader2 className="animate-spin h-6 w-6 text-primary/20" /></div>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                                    {loadedVideos[sg.id]?.map(v => <VideoCard key={v.id} video={v} />)}
                                                </div>
                                            )}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        </section>
                    </div>
                </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background border-none rounded-2xl shadow-2xl">
          <DialogHeader className="p-4 bg-white border-b flex flex-row items-center justify-between space-y-0">
             <div className="flex items-center gap-3 overflow-hidden">
                 <div className="h-8 w-8 bg-primary rounded-xl flex items-center justify-center text-white font-black text-xs shrink-0 shadow-lg">
                    {selectedVideo?.order}
                 </div>
                 <div className="min-w-0">
                    <DialogTitle className="font-black text-xs sm:text-base uppercase tracking-tight text-slate-900 leading-tight truncate">
                        {selectedVideo?.title}
                    </DialogTitle>
                 </div>
             </div>
             <Button 
               variant={progressMap.get(selectedVideo?.id || '') ? "secondary" : "default"} 
               size="sm" onClick={() => selectedVideo && toggleWatched(selectedVideo.id)}
               className="rounded-full px-4 font-black uppercase text-[10px] h-9 shadow-md shrink-0 ml-4"
             >
               {progressMap.get(selectedVideo?.id || '') ? <><CheckCircle2 className="h-3 w-3 mr-2" /> Done</> : "Mark Finished"}
             </Button>
          </DialogHeader>
          
          <div className="aspect-video w-full bg-black relative">
            {selectedVideo && (
              <iframe 
                src={`https://player.vimeo.com/video/${getCleanVimeoId(selectedVideo.youtube_video_id)}?autoplay=1&badge=0&autopause=0`}
                width="100%"
                height="100%"
                frameBorder="0" 
                allow="autoplay; fullscreen; picture-in-picture" 
                allowFullScreen
                className="absolute inset-0"
              ></iframe>
            )}
          </div>
          
          {selectedVideo?.description && (
            <div className="p-6 bg-white border-t">
               <div className="prose dark:prose-invert max-w-none">
                <div className="flex items-center gap-2 mb-3">
                   <VideoIcon className="h-4 w-4 text-primary opacity-30" />
                   <h5 className="font-black uppercase text-[10px] tracking-[0.2em] text-slate-400">Lesson Summary</h5>
                </div>
                <p className="text-sm font-medium text-slate-700 leading-relaxed italic border-l-4 border-primary/10 pl-4 py-1">
                    {selectedVideo.description}
                </p>
               </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <SubscribePromptDialog 
        open={isUpgradeDialogOpen} 
        onOpenChange={setIsUpgradeDialogOpen} 
        featureName="Video Masterclass" 
        description="Detailed video modules are reserved for our premium students. Upgrade your plan to unlock the full clinical curriculum."
      />
      
      <MadeWithDyad />
    </div>
  );
};

export default UserVideosPage;