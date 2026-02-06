"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  Loader2, 
  CheckCircle2, 
  Circle, 
  Layers, 
  FolderTree, 
  AlertCircle,
  MonitorPlay
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
import { differenceInDays, parseISO } from 'date-fns';

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

const UserVideosPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [subgroups, setSubgroups] = useState<any[]>([]);
  const [counts, setCounts] = useState<VideoCounts>({ groups: {}, subgroups: {} });
  
  const [loadedVideos, setLoadedVideos] = useState<Record<string, Video[]>>({});
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({});
  const [progressMap, setProgressMap] = useState<Map<string, boolean>>(new Map());

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);

  // 1. Fetch Hierarchy Metadata and calculate counts
  const fetchMetadata = useCallback(async () => {
    try {
      const [groupsRes, subRes, progRes, allVideosRes] = await Promise.all([
        supabase.from('video_groups').select('*').order('order'),
        supabase.from('video_subgroups').select('*').order('order'),
        user ? supabase.from('user_video_progress').select('video_id, is_watched').eq('user_id', user.id) : Promise.resolve({ data: [] }),
        supabase.from('videos').select('group_id, subgroup_id')
      ]);

      const newProgressMap = new Map();
      progRes.data?.forEach(p => newProgressMap.set(p.video_id, p.is_watched));
      setProgressMap(newProgressMap);
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
      toast({ title: "Sync Error", description: "Failed to load complete video list." });
    } finally {
      setLoadingState(prev => ({ ...prev, [id]: false }));
    }
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
          const { data, error } = await supabase
            .from('videos')
            .select('*')
            .ilike('title', `%${searchTerm}%`)
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
    const isPaid = user?.has_active_subscription && user?.subscription_end_date && differenceInDays(parseISO(user.subscription_end_date), new Date()) > 3;
    if (!isPaid) {
      setIsUpgradeDialogOpen(true);
      return;
    }
    setSelectedVideo(video);
  };

  const VideoCard = ({ video }: { video: Video }) => {
    const isWatched = progressMap.get(video.id) || false;
    
    return (
      <Card 
        className={cn(
          "group relative overflow-hidden cursor-pointer transition-all border-2 flex flex-col justify-between", 
          isWatched ? "border-green-500/20 bg-green-50/5" : "border-slate-100 bg-white"
        )}
        onClick={() => handleVideoClick(video)}
      >
        <div className="p-3 flex items-center gap-3">
            <div className={cn(
                "h-8 w-8 shrink-0 rounded-lg flex items-center justify-center font-black text-xs transition-colors",
                isWatched ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
            )}>
                {video.order}
            </div>
            <h4 className="font-bold text-[13px] leading-tight text-slate-800 line-clamp-2 flex-grow">
                {video.title}
            </h4>
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-full shrink-0" 
                onClick={(e) => toggleWatched(video.id, e)}
                disabled={!user}
            >
              {isWatched ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-slate-300" />}
            </Button>
        </div>
      </Card>
    );
  };

  if (!hasCheckedInitialSession || isLoading) return <div className="flex justify-center py-20 pt-24"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 pb-12">
      <section className="relative overflow-hidden bg-primary rounded-2xl p-6 md:p-8 text-primary-foreground shadow-lg">
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="text-center lg:text-left">
            <h1 className="text-2xl md:text-4xl font-black tracking-tight uppercase italic leading-none">Education Library</h1>
          </div>
          <div className="relative w-full max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
            <Input 
              placeholder="Quick search..." 
              className="h-12 pl-12 rounded-xl bg-white text-slate-900 font-bold border-none shadow-xl" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
            {isSearching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 animate-spin text-primary" />}
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto px-0">
        {searchTerm.trim() ? (
          <section className="animate-in fade-in space-y-4 px-2">
             <div className="flex items-center gap-2">
                <MonitorPlay className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-black uppercase">Search Results</h2>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
               {searchResults.map(v => <VideoCard key={v.id} video={v} />)}
               {searchResults.length === 0 && !isSearching && (
                 <Card className="col-span-full py-12 text-center rounded-2xl">
                    <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400 font-bold uppercase text-xs">No matches found</p>
                 </Card>
               )}
             </div>
          </section>
        ) : (
          <Accordion type="multiple" className="space-y-4">
            {groups.map((group) => {
              const groupSubgroups = subgroups.filter(sg => sg.group_id === group.id);
              const totalVideosInGroup = counts.groups[group.id] || 0;

              return (
                <AccordionItem 
                  key={group.id} 
                  value={group.id} 
                  className="border-none bg-white rounded-2xl overflow-hidden shadow-md"
                  onClick={() => loadVideosForId(group.id, 'group')}
                >
                  <AccordionTrigger className="px-6 py-5 hover:bg-slate-50/50 hover:no-underline border-b transition-all">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="flex items-center gap-4 text-left">
                        <div className="p-2.5 bg-primary text-primary-foreground rounded-xl shadow-md">
                          <Layers className="h-6 w-6" />
                        </div>
                        <div>
                          <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900 leading-none">{group.name}</h2>
                        </div>
                      </div>
                      <Badge className="h-8 px-3 rounded-lg bg-slate-900 text-white font-black text-xs">
                        {totalVideosInGroup}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 bg-slate-50/20 space-y-8">
                    
                    {loadingState[group.id] ? (
                      <div className="flex justify-center py-8"><Loader2 className="animate-spin h-8 w-8 text-primary/20" /></div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {loadedVideos[group.id]?.map((v) => <VideoCard key={v.id} video={v} />)}
                      </div>
                    )}

                    {groupSubgroups.length > 0 && (
                      <div className="space-y-4 pt-2">
                        {groupSubgroups.map(sg => {
                          const videosInSubgroup = counts.subgroups[sg.id] || 0;
                          return (
                            <div key={sg.id} className="relative">
                              <button 
                                className="flex items-center justify-between w-full mb-3 group bg-white p-3 rounded-xl border shadow-sm hover:shadow-md transition-all"
                                onClick={() => loadVideosForId(sg.id, 'subgroup')}
                              >
                                <div className="flex items-center gap-3">
                                    <FolderTree className="h-4 w-4 text-primary opacity-40" />
                                    <span className="font-black text-sm uppercase text-slate-800">
                                        {sg.name} 
                                    </span>
                                </div>
                                <Badge variant="outline" className="h-6 px-2 rounded font-black text-[10px] uppercase">
                                   {videosInSubgroup}
                                </Badge>
                              </button>

                              <div className="pl-4 border-l-2 border-slate-100 ml-3">
                                {loadingState[sg.id] ? (
                                    <div className="flex justify-center py-6"><Loader2 className="animate-spin h-6 w-6 text-primary/20" /></div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                      {loadedVideos[sg.id]?.map((v) => <VideoCard key={v.id} video={v} />)}
                                    </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none rounded-2xl shadow-2xl">
          <DialogHeader className="p-4 bg-white border-b flex-row items-center justify-between space-y-0">
             <div className="flex items-center gap-3">
                 <div className="h-8 w-8 bg-primary rounded-lg flex items-center justify-center text-white font-black text-xs">
                    {selectedVideo?.order}
                 </div>
                 <DialogTitle className="font-black text-lg uppercase tracking-tight text-slate-900 leading-none">
                    {selectedVideo?.title}
                 </DialogTitle>
             </div>
             <Button 
               variant={progressMap.get(selectedVideo?.id || '') ? "secondary" : "default"} 
               size="sm" onClick={() => selectedVideo && toggleWatched(selectedVideo.id)}
               className="rounded-xl px-6 font-black uppercase text-[10px] h-10 shadow-md"
             >
               {progressMap.get(selectedVideo?.id || '') ? "Completed" : "Complete Lesson"}
             </Button>
          </DialogHeader>
          
          <div className="aspect-video bg-zinc-900 relative">
            {selectedVideo && (
              <iframe 
                width="100%" height="100%" 
                src={`https://player.vimeo.com/video/\${selectedVideo.youtube_video_id}?autoplay=1`}
                frameBorder="0" allowFullScreen
                className="w-full h-full"
              ></iframe>
            )}
          </div>
          
          {selectedVideo?.description && (
            <div className="p-6 bg-white border-t">
               <div className="prose dark:prose-invert max-w-none">
                <p className="text-sm font-medium text-slate-700 leading-relaxed italic border-l-2 border-primary/20 pl-4">
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
        description="This lesson requires a premium subscription. Upgrade your plan to master medical concepts with our expert faculty."
      />
      
      <MadeWithDyad />
    </div>
  );
};

// Internal Helper for User Side
const ChevronRight = ({ className }: { className?: string }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
);

export default UserVideosPage;