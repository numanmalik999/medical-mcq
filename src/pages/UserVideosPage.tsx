"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, PlayCircle, Lock, Loader2, CheckCircle2, Circle, Youtube, Globe, Music2, Layers } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/components/SessionContextProvider';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface Video {
  id: string;
  title: string;
  description: string | null;
  youtube_video_id: string;
  platform: string;
  group_id: string | null;
  created_at: string;
}

interface VideoGroup {
  id: string;
  name: string;
  description: string | null;
  videos: Video[];
}

const UserVideosPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [groupedVideos, setGroupedVideos] = useState<VideoGroup[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, boolean>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const fetchVideosAndProgress = useCallback(async () => {
    if (!user?.has_active_subscription) {
      setIsLoading(false);
      return;
    }

    try {
      const [{ data: groupsData }, { data: videosData }, { data: progressData }] = await Promise.all([
        supabase.from('video_groups').select('*').order('order'),
        supabase.from('videos').select('*').order('created_at', { ascending: false }),
        supabase.from('user_video_progress').select('video_id, is_watched').eq('user_id', user.id)
      ]);

      const newProgressMap = new Map();
      progressData?.forEach(p => newProgressMap.set(p.video_id, p.is_watched));
      setProgressMap(newProgressMap);

      const groups: VideoGroup[] = (groupsData || []).map(g => ({
        ...g,
        videos: (videosData || []).filter(v => v.group_id === g.id)
      }));

      const uncategorized = (videosData || []).filter(v => !v.group_id);
      if (uncategorized.length > 0) {
        groups.push({ id: 'uncategorized', name: 'General Medical Tutorials', description: 'Core clinical lessons and exam overviews.', videos: uncategorized });
      }

      setGroupedVideos(groups);
    } catch (error: any) {
      console.error("Error fetching library:", error);
      toast({ title: "Error", description: "Failed to load video library.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchVideosAndProgress();
    }
  }, [hasCheckedInitialSession, fetchVideosAndProgress]);

  const toggleWatchedStatus = async (videoId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!user) return;

    setIsToggling(true);
    const currentStatus = progressMap.get(videoId) || false;
    const newStatus = !currentStatus;

    try {
      const { error } = await supabase
        .from('user_video_progress')
        .upsert({
          user_id: user.id,
          video_id: videoId,
          is_watched: newStatus,
          last_watched_at: new Date().toISOString()
        }, { onConflict: 'user_id,video_id' });

      if (error) throw error;

      setProgressMap(prev => {
        const next = new Map(prev);
        next.set(videoId, newStatus);
        return next;
      });

      toast({ title: newStatus ? "Lesson Completed!" : "Progress updated" });
    } catch (error: any) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } finally {
      setIsToggling(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'youtube': return <Youtube className="h-4 w-4 text-red-500" />;
      case 'vimeo': return <Globe className="h-4 w-4 text-blue-400" />;
      case 'dailymotion': return <Music2 className="h-4 w-4 text-blue-700" />;
      default: return null;
    }
  };

  const getThumbnail = (video: Video) => {
    if (video.platform === 'youtube') return `https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`;
    if (video.platform === 'vimeo') return `https://vumbnail.com/${video.youtube_video_id}.jpg`;
    if (video.platform === 'dailymotion') return `https://www.dailymotion.com/thumbnail/video/${video.youtube_video_id}`;
    return '/placeholder.svg';
  };

  const getEmbedUrl = (video: Video) => {
    if (video.platform === 'youtube') return `https://www.youtube.com/embed/${video.youtube_video_id}?autoplay=1`;
    if (video.platform === 'vimeo') return `https://player.vimeo.com/video/${video.youtube_video_id}?autoplay=1`;
    if (video.platform === 'dailymotion') return `https://www.dailymotion.com/embed/video/${video.youtube_video_id}?autoplay=1`;
    return '';
  };

  if (!hasCheckedInitialSession) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  }

  if (!user?.has_active_subscription) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Card className="border-primary/20 shadow-xl py-8">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4"><Lock className="h-10 w-10 text-primary" /></div>
            <CardTitle className="text-3xl">Premium Video Lessons</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Gain full access to high-yield clinical videos from world-class educators, organized by medical specialty.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link to="/user/subscriptions"><Button size="lg" className="w-full">Explore Plans</Button></Link>
              <Link to="/user/dashboard"><Button variant="outline" size="lg" className="w-full">Back to Dashboard</Button></Link>
            </div>
          </CardContent>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Video Resource Center</h1>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search high-yield lessons..." className="pl-10 h-10 rounded-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Opening library...</div>
      ) : (
        <Accordion type="multiple" defaultValue={groupedVideos.map(g => g.id)} className="space-y-6">
          {groupedVideos.map((group) => {
            const groupVideos = group.videos.filter(v => 
              v.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (groupVideos.length === 0) return null;

            const completedCount = groupVideos.filter(v => progressMap.get(v.id)).length;

            return (
              <AccordionItem key={group.id} value={group.id} className="border rounded-2xl overflow-hidden shadow-sm bg-card">
                <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-4 text-left">
                    <div className="p-2 bg-primary/5 rounded-lg text-primary"><Layers className="h-6 w-6" /></div>
                    <div>
                      <h2 className="text-xl font-bold">{group.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="rounded-full text-[10px] uppercase font-bold">{groupVideos.length} Lessons</Badge>
                        {completedCount > 0 && <span className="text-xs text-green-600 font-medium">{completedCount} Completed</span>}
                      </div>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-6 bg-muted/10 border-t">
                  {group.description && <p className="text-sm text-muted-foreground mb-6 leading-relaxed italic border-l-4 border-primary/20 pl-4">{group.description}</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groupVideos.map((video) => {
                      const isWatched = progressMap.get(video.id) || false;
                      return (
                        <Card 
                          key={video.id} 
                          className={cn(
                            "overflow-hidden cursor-pointer hover:shadow-lg transition-all group border-2",
                            isWatched ? "border-green-500/20" : "border-transparent"
                          )}
                          onClick={() => setSelectedVideo(video)}
                        >
                          <div className="relative aspect-video bg-muted">
                            <img 
                              src={getThumbnail(video)} 
                              className="w-full h-full object-cover transition-transform group-hover:scale-110"
                              alt={video.title}
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 flex items-center justify-center transition-colors">
                              <PlayCircle className="h-14 w-14 text-white opacity-80 group-hover:opacity-100 transition-transform group-hover:scale-110" />
                            </div>
                            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                              {getPlatformIcon(video.platform)}
                              {video.platform.toUpperCase()}
                            </div>
                            {isWatched && (
                              <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-lg border-2 border-white">
                                <CheckCircle2 className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <CardHeader className="p-4 space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <CardTitle className="text-base line-clamp-2 leading-tight group-hover:text-primary transition-colors">{video.title}</CardTitle>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className={cn("h-8 w-8 shrink-0 rounded-full", isWatched ? "text-green-600 bg-green-50" : "text-gray-300 hover:text-primary hover:bg-primary/10")}
                                onClick={(e) => toggleWatchedStatus(video.id, e)}
                                disabled={isToggling}
                              >
                                {isWatched ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                              </Button>
                            </div>
                            <CardDescription className="line-clamp-2 text-xs leading-relaxed">{video.description}</CardDescription>
                          </CardHeader>
                        </Card>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-black border-none rounded-3xl">
          <DialogHeader className="p-6 bg-background border-b flex-row items-center justify-between space-y-0">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-3 text-xl font-bold">
                {getPlatformIcon(selectedVideo?.platform || '')}
                {selectedVideo?.title}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 font-medium">
                {progressMap.get(selectedVideo?.id || '') ? (
                  <><span className="w-2 h-2 rounded-full bg-green-500" /> Lesson Mastered</>
                ) : (
                  <><span className="w-2 h-2 rounded-full bg-orange-500" /> Continuing Education</>
                )}
              </p>
            </div>
            <Button 
              variant={progressMap.get(selectedVideo?.id || '') ? "secondary" : "default"} 
              size="sm"
              onClick={() => selectedVideo && toggleWatchedStatus(selectedVideo.id)}
              disabled={isToggling}
              className="ml-4 rounded-full px-6 font-bold"
            >
              {progressMap.get(selectedVideo?.id || '') ? <><CheckCircle2 className="mr-2 h-4 w-4" /> Finished</> : "Mark Finished"}
            </Button>
          </DialogHeader>
          <div className="aspect-video bg-black shadow-inner">
            {selectedVideo && (
              <iframe 
                width="100%" 
                height="100%" 
                src={getEmbedUrl(selectedVideo)} 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              ></iframe>
            )}
          </div>
          <div className="p-8 bg-background">
             <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground mb-3">Clinical Breakdown</h4>
             <p className="text-sm text-foreground/90 leading-relaxed max-w-3xl">{selectedVideo?.description}</p>
          </div>
        </DialogContent>
      </Dialog>
      <MadeWithDyad />
    </div>
  );
};

export default UserVideosPage;