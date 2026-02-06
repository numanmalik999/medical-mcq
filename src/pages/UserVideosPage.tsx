"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { 
  Search, 
  PlayCircle, 
  Loader2, 
  CheckCircle2, 
  Circle, 
  Layers, 
  FolderTree, 
  AlertCircle,
  ChevronRight,
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
          "group relative overflow-hidden cursor-pointer transition-all duration-300 border-2 hover:shadow-xl hover:-translate-y-1", 
          isWatched ? "border-green-500/30 bg-green-50/10 shadow-inner" : "border-slate-200 bg-white"
        )}
        onClick={() => handleVideoClick(video)}
      >
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
                <div className={cn(
                    "h-10 w-10 shrink-0 rounded-xl flex items-center justify-center font-black text-sm shadow-sm transition-colors",
                    isWatched ? "bg-green-600 text-white" : "bg-primary text-primary-foreground"
                )}>
                    {video.order}
                </div>
                <h4 className="font-bold text-[15px] leading-snug text-slate-800 line-clamp-2">
                    {video.title}
                </h4>
            </div>
            
            <div className="flex flex-col items-end gap-2">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full hover:bg-slate-100 shrink-0" 
                    onClick={(e) => toggleWatched(video.id, e)}
                    disabled={!user}
                >
                  {isWatched ? <CheckCircle2 className="h-6 w-6 text-green-600" /> : <Circle className="h-6 w-6 text-slate-300" />}
                </Button>
            </div>
          </div>

          <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-50">
             <Badge variant="outline" className="text-[9px] uppercase font-black tracking-widest px-2 bg-slate-50 text-slate-500 border-slate-200">
                {video.platform} lesson
             </Badge>
             <div className="flex items-center gap-1.5 text-primary group-hover:gap-2 transition-all">
                <span className="text-[10px] font-black uppercase tracking-tighter">Watch Now</span>
                <PlayCircle className="h-4 w-4" />
             </div>
          </div>
        </div>

        {isWatched && (
            <div className="absolute top-0 left-0 w-1 h-full bg-green-500" />
        )}
      </Card>
    );
  };

  if (!hasCheckedInitialSession || isLoading) return <div className="flex justify-center py-20 pt-24"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-12 pb-20">
      <section className="relative overflow-hidden bg-primary rounded-3xl p-8 md:p-12 text-primary-foreground shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-8">
          <div className="text-center lg:text-left space-y-3">
            <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase italic leading-none">
                Clinical Masterclass
            </h1>
            <p className="text-primary-foreground/70 font-medium max-w-md">
                Master complex clinical concepts with our structured video roadmap, led by top-tier medical faculty.
            </p>
          </div>

          <div className="relative w-full max-w-lg">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-primary" />
            <Input 
              placeholder="Search by topic, symptom, or diagnosis..." 
              className="h-16 pl-14 pr-16 rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 text-lg font-bold shadow-2xl border-none focus-visible:ring-offset-0 focus-visible:ring-4 focus-visible:ring-white/20" 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
            />
            {isSearching && (
                <div className="absolute right-5 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            )}
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto px-0">
        {searchTerm.trim() ? (
          <section className="animate-in fade-in slide-in-from-bottom-4 space-y-8 px-4">
             <div className="flex items-center gap-4">
               <div className="p-2 bg-primary/10 rounded-xl text-primary"><MonitorPlay className="h-6 w-6" /></div>
               <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">Instant Search Results</h2>
                  <p className="text-sm text-muted-foreground font-medium">Showing top matches for "{searchTerm}"</p>
               </div>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
               {searchResults.map(v => <VideoCard key={v.id} video={v} />)}
               {searchResults.length === 0 && !isSearching && (
                 <Card className="col-span-full py-24 bg-slate-50 border-2 border-dashed border-slate-200 text-center flex flex-col items-center gap-4 rounded-3xl">
                    <div className="p-6 bg-white rounded-full shadow-sm"><AlertCircle className="h-12 w-12 text-slate-300" /></div>
                    <div className="space-y-1">
                        <p className="text-2xl font-black text-slate-400 uppercase tracking-tighter">No Lessons Found</p>
                        <p className="text-slate-400 font-medium">Try adjusting your search terms or browse categories below.</p>
                    </div>
                 </Card>
               )}
             </div>
          </section>
        ) : (
          <Accordion type="multiple" className="space-y-8">
            {groups.map((group) => {
              const groupSubgroups = subgroups.filter(sg => sg.group_id === group.id);
              return (
                <AccordionItem 
                  key={group.id} 
                  value={group.id} 
                  className="border-none bg-white rounded-3xl overflow-hidden shadow-xl border border-slate-100"
                  onClick={() => loadVideosForId(group.id, 'group')}
                >
                  <AccordionTrigger className="px-8 py-8 hover:bg-slate-50/50 hover:no-underline border-b transition-all">
                    <div className="flex items-center gap-6 text-left">
                      <div className="p-4 bg-primary text-primary-foreground rounded-2xl shadow-lg ring-4 ring-primary/5">
                        <Layers className="h-8 w-8" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 leading-none">{group.name}</h2>
                        <div className="flex items-center gap-3 mt-2">
                             <Badge className="bg-primary/10 text-primary hover:bg-primary/10 border-none font-black text-[10px] uppercase tracking-widest px-3 py-1">
                                Complete Syllabus
                             </Badge>
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-10 bg-slate-50/30 space-y-16">
                    
                    <div className="space-y-6">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Foundation Curriculum</h3>
                      </div>
                      {loadingState[group.id] ? (
                        <div className="flex justify-center py-16"><Loader2 className="animate-spin h-10 w-10 text-primary/20" /></div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                          {loadedVideos[group.id]?.map((v) => <VideoCard key={v.id} video={v} />)}
                          {loadedVideos[group.id]?.length === 0 && (
                            <div className="col-span-full py-8 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                                <p className="text-sm text-slate-400 font-medium">Core lessons are grouped by specialty below.</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {groupSubgroups.length > 0 && (
                      <div className="space-y-8 pt-4">
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            <h3 className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Specialty Sub-groups</h3>
                        </div>
                        <div className="grid grid-cols-1 gap-10">
                          {groupSubgroups.map(sg => (
                            <div key={sg.id} className="relative animate-in fade-in duration-700">
                              <button 
                                className="flex items-center gap-4 mb-6 group"
                                onClick={() => loadVideosForId(sg.id, 'subgroup')}
                              >
                                <div className="p-2.5 bg-white rounded-xl shadow-md border group-hover:border-primary group-hover:scale-105 transition-all">
                                    <FolderTree className="h-5 w-5 text-primary" />
                                </div>
                                <div className="text-left">
                                    <span className="font-black text-xl uppercase tracking-tighter text-slate-800 flex items-center gap-2">
                                        {sg.name} 
                                        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                                    </span>
                                    {sg.description && <p className="text-xs text-slate-400 font-medium mt-0.5">{sg.description}</p>}
                                </div>
                              </button>

                              <div className="pl-2 border-l-2 border-slate-100 ml-5 pt-2">
                                {loadingState[sg.id] ? (
                                    <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-primary/20" /></div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {loadedVideos[sg.id]?.map((v) => <VideoCard key={v.id} video={v} />)}
                                    {(!loadedVideos[sg.id] || loadedVideos[sg.id].length === 0) && (
                                        <div 
                                            className="col-span-full py-10 bg-white/50 rounded-2xl border border-dashed text-center cursor-pointer hover:bg-white transition-colors"
                                            onClick={() => loadVideosForId(sg.id, 'subgroup')}
                                        >
                                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Click to Expand Topics</p>
                                        </div>
                                    )}
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
      </div>

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-black border-none rounded-[2rem] shadow-2xl">
          <DialogHeader className="p-8 bg-white border-b flex-row items-center justify-between space-y-0">
             <div className="flex items-center gap-4">
                 <div className="h-12 w-12 bg-primary rounded-2xl flex items-center justify-center text-white font-black shadow-lg">
                    {selectedVideo?.order}
                 </div>
                 <div>
                    <DialogTitle className="font-black text-2xl uppercase tracking-tighter text-slate-900 leading-none">
                        {selectedVideo?.title}
                    </DialogTitle>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-1.5">Masterclass Lesson</p>
                 </div>
             </div>
             <Button 
               variant={progressMap.get(selectedVideo?.id || '') ? "secondary" : "default"} 
               size="lg" onClick={() => selectedVideo && toggleWatched(selectedVideo.id)}
               className="ml-8 rounded-2xl px-10 font-black uppercase tracking-widest text-xs h-14 shadow-xl active:scale-95 transition-transform"
             >
               {progressMap.get(selectedVideo?.id || '') ? (
                   <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> Lesson Finished</span>
               ) : "Mark as Completed"}
             </Button>
          </DialogHeader>
          
          <div className="aspect-video bg-zinc-900 shadow-2xl relative">
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
            <div className="p-12 bg-white border-t">
               <h4 className="font-black text-xs uppercase tracking-[0.25em] text-primary/40 mb-6 flex items-center gap-2">
                 <div className="h-1 w-8 bg-primary/20 rounded-full" /> Clinical Synopsis
               </h4>
               <div className="prose dark:prose-invert max-w-none">
                <p className="text-xl font-medium text-slate-700 leading-relaxed italic border-l-4 border-primary/10 pl-6">
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
        featureName="Video Masterclass Series" 
        description="Our high-yield clinical video library is reserved for premium subscribers. Upgrade your plan to master medical licensing concepts with our expert faculty."
      />
      
      <MadeWithDyad />
    </div>
  );
};

export default UserVideosPage;