"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, PlayCircle, Loader2, CheckCircle2, Circle, Layers, FolderTree } from 'lucide-react';
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

interface VideoSubgroup {
  id: string;
  name: string;
  description: string | null;
  videos: Video[];
}

interface VideoGroup {
  id: string;
  name: string;
  description: string | null;
  subgroups: VideoSubgroup[];
  standaloneVideos: Video[];
}

const UserVideosPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [library, setLibrary] = useState<VideoGroup[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, boolean>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);

  const fetchLibrary = useCallback(async () => {
    try {
      const [groupsRes, subRes, videoRes, progRes] = await Promise.all([
        supabase.from('video_groups').select('*').order('order'),
        supabase.from('video_subgroups').select('*').order('order'),
        supabase.from('videos').select('*').order('order', { ascending: true }),
        user ? supabase.from('user_video_progress').select('video_id, is_watched').eq('user_id', user.id) : Promise.resolve({ data: [] })
      ]);

      const newProgressMap = new Map();
      progRes.data?.forEach(p => newProgressMap.set(p.video_id, p.is_watched));
      setProgressMap(newProgressMap);

      const allVideos = videoRes.data || [];
      const allSubgroups = subRes.data || [];
      
      const structuredLibrary: VideoGroup[] = (groupsRes.data || []).map(g => {
        const groupSubgroups = allSubgroups
          .filter(sg => sg.group_id === g.id)
          .map(sg => ({
            ...sg,
            videos: allVideos.filter(v => v.subgroup_id === sg.id)
          }));

        return {
          ...g,
          subgroups: groupSubgroups,
          standaloneVideos: allVideos.filter(v => v.group_id === g.id && !v.subgroup_id)
        };
      });

      const uncategorized = allVideos.filter(v => !v.group_id && !v.subgroup_id);
      if (uncategorized.length > 0) {
        structuredLibrary.push({ id: 'none', name: 'Other Content', description: 'Miscellaneous lessons.', subgroups: [], standaloneVideos: uncategorized });
      }

      setLibrary(structuredLibrary);
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to load library.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (hasCheckedInitialSession) fetchLibrary();
  }, [hasCheckedInitialSession, fetchLibrary]);

  const toggleWatched = async (videoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) return;
    const newStatus = !(progressMap.get(videoId) || false);
    try {
      await supabase.from('user_video_progress').upsert({ user_id: user?.id, video_id: videoId, is_watched: newStatus }, { onConflict: 'user_id,video_id' });
      setProgressMap(prev => new Map(prev).set(videoId, newStatus));
      toast({ title: newStatus ? "Lesson Completed!" : "Progress updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleVideoClick = (video: Video) => {
    // BLOCK TRIAL USERS FROM WATCHING
    const isPaid = user?.has_active_subscription && user?.subscription_end_date && differenceInDays(parseISO(user.subscription_end_date), new Date()) > 3;
    
    if (!isPaid) {
      setIsUpgradeDialogOpen(true);
      return;
    }
    setSelectedVideo(video);
  };

  const getEmbedUrl = (video: Video) => {
    // Exclusively use Vimeo embed
    return `https://player.vimeo.com/video/${video.youtube_video_id}?autoplay=1&badge=0&autopause=0&player_id=0&app_id=58479`;
  };

  const VideoCard = ({ video }: { video: Video }) => {
    const isWatched = progressMap.get(video.id) || false;
    
    return (
      <Card 
        className={cn(
          "overflow-hidden cursor-pointer hover:shadow-lg transition-all border-2 relative group flex flex-col justify-center min-h-[140px]", 
          isWatched ? "border-green-500/20 bg-green-50/5" : "border-transparent bg-muted/20"
        )}
        onClick={() => handleVideoClick(video)}
      >
        <div className="p-6 text-center flex flex-col items-center justify-center gap-2">
          <h4 className="text-sm font-extrabold leading-relaxed text-foreground px-4">
            <span className="text-primary mr-1 opacity-40">{video.order}.</span> {video.title}
          </h4>

          <div className="absolute inset-0 bg-primary/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayCircle className="h-12 w-12 text-primary/40" />
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

  const filteredLibrary = library.map(group => {
    const matchingStandalone = group.standaloneVideos.filter(v => v.title.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchingSubgroups = group.subgroups.map(sg => ({
      ...sg,
      videos: sg.videos.filter(v => v.title.toLowerCase().includes(searchTerm.toLowerCase()))
    })).filter(sg => sg.videos.length > 0);

    return { ...group, standaloneVideos: matchingStandalone, subgroups: matchingSubgroups };
  }).filter(group => group.standaloneVideos.length > 0 || group.subgroups.length > 0);

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Vimeo Study Library</h1>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search topics..." 
            className="pl-10 rounded-full h-11" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      <Accordion type="multiple" defaultValue={library.map(g => g.id)} className="space-y-6">
        {filteredLibrary.map((group) => (
          <AccordionItem key={group.id} value={group.id} className="border rounded-2xl overflow-hidden shadow-sm bg-card">
            <AccordionTrigger className="px-6 py-5 hover:bg-muted/30 hover:no-underline">
              <div className="flex items-center gap-4 text-left">
                <div className="p-2 bg-primary/5 rounded-lg text-primary"><Layers className="h-6 w-6" /></div>
                <h2 className="text-xl font-bold">{group.name}</h2>
              </div>
            </AccordionTrigger>
            <AccordionContent className="p-6 bg-muted/5 border-t space-y-8">
              
              {group.standaloneVideos.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary/60 px-2">Core Foundation Lessons</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.standaloneVideos.map((v) => <VideoCard key={v.id} video={v} />)}
                  </div>
                </div>
              )}

              {group.subgroups.length > 0 && (
                <div className="space-y-4">
                  <Accordion type="multiple" className="space-y-4">
                    {group.subgroups.map(sg => (
                      <AccordionItem key={sg.id} value={sg.id} className="border rounded-xl bg-background shadow-sm">
                        <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/20">
                          <div className="flex items-center gap-2 text-left">
                            <FolderTree className="h-4 w-4 text-primary/60" />
                            <span className="font-bold text-sm uppercase tracking-tight">{sg.name}</span>
                            <Badge variant="outline" className="ml-2 text-[10px] font-bold">{sg.videos.length} lessons</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="p-4 bg-muted/5 border-t">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {sg.videos.map((v) => <VideoCard key={v.id} video={v} />)}
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

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-black border-none rounded-3xl">
          <DialogHeader className="p-6 bg-background border-b flex-row items-center justify-between space-y-0">
             <DialogTitle className="flex-1 font-bold text-xl">{selectedVideo?.title}</DialogTitle>
             <Button 
               variant={progressMap.get(selectedVideo?.id || '') ? "secondary" : "default"} 
               size="sm" onClick={() => selectedVideo && toggleWatched(selectedVideo.id)}
               className="ml-4 rounded-full px-6 font-bold"
             >
               {progressMap.get(selectedVideo?.id || '') ? "Mark Incomplete" : "Mark Finished"}
             </Button>
          </DialogHeader>
          <div className="aspect-video">
            {selectedVideo && (
              <iframe 
                width="100%" height="100%" 
                src={getEmbedUrl(selectedVideo)}
                frameBorder="0" allowFullScreen
              ></iframe>
            )}
          </div>
          {selectedVideo?.description && (
            <div className="p-8 bg-background">
               <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground mb-3">Lesson Summary</h4>
               <p className="text-sm text-foreground/90 leading-relaxed max-w-3xl">{selectedVideo.description}</p>
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

export default UserVideosPage;