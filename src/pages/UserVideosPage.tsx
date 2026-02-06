"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, PlayCircle, Loader2, CheckCircle2, Circle, Layers, FolderTree, Info, AlertCircle } from 'lucide-react';
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

const UserVideosPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  
  const [isLoading, setIsLoading] = useState(true);
  const [groups, setGroups] = useState<any[]>([]);
  const [subgroups, setSubgroups] = useState<any[]>([]);
  
  const [loadedVideos, setLoadedVideos] = useState<Record<string, Video[]>>({});
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({});
  const [progressMap, setProgressMap] = useState<Map<string, boolean>>(new Map());

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);

  const fetchMetadata = useCallback(async () => {
    try {
      const [groupsRes, subRes, progRes] = await Promise.all([
        supabase.from('video_groups').select('*').order('order'),
        supabase.from('video_subgroups').select('*').order('order'),
        user ? supabase.from('user_video_progress').select('video_id, is_watched').eq('user_id', user.id) : Promise.resolve({ data: [] })
      ]);

      const newProgressMap = new Map();
      progRes.data?.forEach(p => newProgressMap.set(p.video_id, p.is_watched));
      setProgressMap(newProgressMap);
      setGroups(groupsRes.data || []);
      setSubgroups(subRes.data || []);
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
    try {
      const query = supabase.from('videos').select('*').order('order', { ascending: true });
      if (type === 'subgroup') query.eq('subgroup_id', id);
      else query.eq('group_id', id).is('subgroup_id', null);

      const { data, error } = await query;
      if (error) throw error;
      setLoadedVideos(prev => ({ ...prev, [id]: data || [] }));
    } catch (e: any) {
      console.error(e);
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
      const { data } = await supabase.from('videos').select('*').ilike('title', `%${searchTerm}%`).limit(30);
      setSearchResults(data || []);
      setIsSearching(false);
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
      toast({ title: newStatus ? "Lesson Completed!" : "Progress updated" });
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

  const getEmbedUrl = (video: Video) => {
    return `https://player.vimeo.com/video/${video.youtube_video_id}?autoplay=1&badge=0&autopause=0&player_id=0&app_id=58479`;
  };

  const VideoCard = ({ video }: { video: Video }) => {
    const isWatched = progressMap.get(video.id) || false;
    return (
      <Card 
        className={cn(
          "overflow-hidden cursor-pointer hover:shadow-lg transition-all border-2 relative group flex flex-col justify-center min-h-[140px]", 
          isWatched ? "border-green-500/20 bg-green-50/5" : "border-transparent bg-muted/20 shadow-sm"
        )}
        onClick={() => handleVideoClick(video)}
      >
        <div className="p-6 text-center flex flex-col items-center justify-center gap-2">
          <h4 className="text-sm font-extrabold leading-relaxed text-foreground px-4">
            <span className="text-primary mr-1 opacity-40">{video.order}.</span> {video.title}
          </h4>
          <div className="absolute inset-0 bg-primary/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayCircle className="h-10 w-10 text-primary/30" />
          </div>
          <div className="absolute top-2 right-2">
            <Button 
                variant="ghost" 
                size="icon" 
                className="h-7 w-7 rounded-full hover:bg-background/80 shadow-sm" 
                onClick={(e) => toggleWatched(video.id, e)}
                disabled={!user}
            >
              {isWatched ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <Circle className="h-5 w-5 text-muted-foreground/40" />}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  if (!hasCheckedInitialSession || isLoading) return <div className="flex justify-center py-20 pt-24"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-foreground uppercase">Education Library</h1>
          <p className="text-muted-foreground text-sm font-medium">Master medical concepts with our expert-led clinical series.</p>
        </div>
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
          <Input 
            placeholder="Search thousands of lessons..." 
            className="pl-12 rounded-2xl h-12 shadow-inner bg-muted/30 border-none text-lg" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
          {isSearching && <Loader2 className="absolute right-4 top-3.5 h-5 w-5 animate-spin text-primary" />}
        </div>
      </div>

      {searchTerm.trim() ? (
        <section className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
           <div className="flex items-center gap-2">
             <Badge variant="secondary" className="px-3 py-1 text-xs font-black uppercase tracking-widest">Search Results</Badge>
           </div>
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
             {searchResults.map(v => <VideoCard key={v.id} video={v} />)}
             {searchResults.length === 0 && !isSearching && (
               <Card className="col-span-full py-20 bg-muted/10 border-dashed border-2 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-xl font-bold text-muted-foreground">No matches for "{searchTerm}"</p>
               </Card>
             )}
           </div>
        </section>
      ) : (
        <Accordion type="multiple" className="space-y-6">
          {groups.map((group) => {
            const groupSubgroups = subgroups.filter(sg => sg.group_id === group.id);
            return (
              <AccordionItem 
                key={group.id} 
                value={group.id} 
                className="border rounded-3xl overflow-hidden shadow-md bg-card border-border/40"
                onClick={() => loadVideosForId(group.id, 'group')}
              >
                <AccordionTrigger className="px-8 py-6 hover:bg-muted/30 hover:no-underline">
                  <div className="flex items-center gap-5 text-left">
                    <div className="p-3 bg-primary/5 rounded-2xl text-primary shadow-inner"><Layers className="h-8 w-8" /></div>
                    <div>
                      <h2 className="text-2xl font-black uppercase tracking-tight">{group.name}</h2>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Core Modules Available</p>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-8 bg-muted/5 border-t space-y-12">
                  
                  <div className="space-y-4">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60 px-2 flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full" /> Foundation Lessons
                    </h3>
                    {loadingState[group.id] ? (
                      <div className="flex justify-center py-10"><Loader2 className="animate-spin h-8 w-8 text-primary/20" /></div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {loadedVideos[group.id]?.map((v) => <VideoCard key={v.id} video={v} />)}
                        {loadedVideos[group.id]?.length === 0 && <p className="text-sm text-muted-foreground italic px-2">No individual lessons here.</p>}
                      </div>
                    )}
                  </div>

                  {groupSubgroups.length > 0 && (
                    <div className="space-y-6">
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-primary/60 px-2 flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full" /> Specialty Sub-groups
                      </h3>
                      <div className="grid grid-cols-1 gap-6">
                        {groupSubgroups.map(sg => (
                          <div key={sg.id} className="bg-background rounded-3xl border border-border/60 shadow-sm overflow-hidden transition-all hover:shadow-md">
                            <button 
                              className="w-full px-6 py-5 flex items-center justify-between group hover:bg-muted/20 transition-colors border-b"
                              onClick={() => loadVideosForId(sg.id, 'subgroup')}
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-muted rounded-xl"><FolderTree className="h-5 w-5 text-primary/40" /></div>
                                <span className="font-extrabold text-lg uppercase tracking-tight text-foreground/80">{sg.name}</span>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                            </button>
                            <div className="p-6">
                              {loadingState[sg.id] ? (
                                <div className="flex justify-center py-10"><Loader2 className="animate-spin h-6 w-6 text-primary/20" /></div>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                  {loadedVideos[sg.id]?.map((v) => <VideoCard key={v.id} video={v} />)}
                                  {loadedVideos[sg.id]?.length === 0 && <p className="text-xs text-muted-foreground italic text-center py-4 w-full col-span-full">Expand to load lessons for this topic.</p>}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black border-none rounded-3xl shadow-2xl">
          <DialogHeader className="p-6 bg-background border-b flex-row items-center justify-between space-y-0">
             <DialogTitle className="flex-1 font-black text-2xl uppercase tracking-tighter">{selectedVideo?.title}</DialogTitle>
             <Button 
               variant={progressMap.get(selectedVideo?.id || '') ? "secondary" : "default"} 
               size="sm" onClick={() => selectedVideo && toggleWatched(selectedVideo.id)}
               className="ml-4 rounded-full px-8 font-black uppercase tracking-widest text-xs h-10"
             >
               {progressMap.get(selectedVideo?.id || '') ? "Completed" : "Mark Finished"}
             </Button>
          </DialogHeader>
          <div className="aspect-video bg-zinc-900">
            {selectedVideo && (
              <iframe 
                width="100%" height="100%" 
                src={getEmbedUrl(selectedVideo)}
                frameBorder="0" allowFullScreen
                className="w-full h-full"
              ></iframe>
            )}
          </div>
          {selectedVideo?.description && (
            <div className="p-10 bg-background border-t">
               <h4 className="font-black text-xs uppercase tracking-[0.2em] text-primary/40 mb-4 flex items-center gap-2">
                 <Info className="h-4 w-4" /> Lesson Briefing
               </h4>
               <p className="text-lg font-medium text-foreground/80 leading-relaxed max-w-4xl">{selectedVideo.description}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      <SubscribePromptDialog 
        open={isUpgradeDialogOpen} 
        onOpenChange={setIsUpgradeDialogOpen} 
        featureName="Video Education Series" 
        description="Our clinical video library is a premium resource. Upgrade your plan to watch high-yield lessons and master complex medical concepts with our expert faculty."
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