"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, PlayCircle, Lock, Loader2, CheckCircle2, Circle, Youtube, Globe, Music2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/components/SessionContextProvider';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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
      // Fetch Groups
      const { data: groupsData } = await supabase.from('video_groups').select('*').order('order');
      
      // Fetch videos
      const { data: videosData } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      // Fetch user progress
      const { data: progressData } = await supabase
        .from('user_video_progress')
        .select('video_id, is_watched')
        .eq('user_id', user.id);

      const newProgressMap = new Map();
      progressData?.forEach(p => newProgressMap.set(p.video_id, p.is_watched));
      setProgressMap(newProgressMap);

      // Group videos
      const groups: VideoGroup[] = (groupsData || []).map(g => ({
        ...g,
        videos: (videosData || []).filter(v => v.group_id === g.id)
      }));

      // Add uncategorized
      const uncategorized = (videosData || []).filter(v => !v.group_id);
      if (uncategorized.length > 0) {
        groups.push({ id: 'uncategorized', name: 'Other Lessons', description: 'General clinical tutorials.', videos: uncategorized });
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

      toast({ title: newStatus ? "Completed!" : "Status updated" });
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
            <CardTitle className="text-3xl">Premium Video Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Gain access to the best tutorials from Ninja Nerd, Osmosis, and more, all organized by specialty.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link to="/user/subscriptions"><Button size="lg" className="w-full">View Plans</Button></Link>
              <Link to="/user/dashboard"><Button variant="outline" size="lg" className="w-full">Back</Button></Link>
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
        <h1 className="text-3xl font-bold">Video Library</h1>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search tutorials..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Loading library...</div>
      ) : (
        <div className="space-y-12">
          {groupedVideos.map((group) => {
            const groupVideos = group.videos.filter(v => 
              v.title.toLowerCase().includes(searchTerm.toLowerCase())
            );
            if (groupVideos.length === 0) return null;

            return (
              <div key={group.id} className="space-y-6">
                <div className="border-b pb-2">
                  <h2 className="text-2xl font-bold flex items-center gap-2">{group.name} <Badge variant="secondary" className="rounded-full">{groupVideos.length}</Badge></h2>
                  {group.description && <p className="text-sm text-muted-foreground mt-1">{group.description}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {groupVideos.map((video) => {
                    const isWatched = progressMap.get(video.id) || false;
                    return (
                      <Card 
                        key={video.id} 
                        className={cn(
                          "overflow-hidden cursor-pointer hover:shadow-md transition-all group border-2",
                          isWatched ? "border-green-500/30 bg-green-50/10" : "border-transparent"
                        )}
                        onClick={() => setSelectedVideo(video)}
                      >
                        <div className="relative aspect-video bg-muted">
                          <img 
                            src={getThumbnail(video)} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            alt={video.title}
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                            <PlayCircle className="h-12 w-12 text-white opacity-80 group-hover:opacity-100" />
                          </div>
                          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">
                            {getPlatformIcon(video.platform)}
                            {video.platform.toUpperCase()}
                          </div>
                          {isWatched && (
                            <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-lg">
                              <CheckCircle2 className="h-5 w-5" />
                            </div>
                          )}
                        </div>
                        <CardHeader className="p-4">
                          <div className="flex justify-between items-start gap-2">
                            <CardTitle className="text-lg line-clamp-1 flex-1">{video.title}</CardTitle>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className={cn("h-8 w-8 shrink-0", isWatched ? "text-green-600" : "text-gray-300")}
                              onClick={(e) => toggleWatchedStatus(video.id, e)}
                              disabled={isToggling}
                            >
                              {isWatched ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
                            </Button>
                          </div>
                          <CardDescription className="line-clamp-2 text-xs">{video.description}</CardDescription>
                        </CardHeader>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
          <DialogHeader className="p-4 bg-background border-b flex-row items-center justify-between space-y-0">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">{selectedVideo?.title} {selectedVideo && getPlatformIcon(selectedVideo.platform)}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {progressMap.get(selectedVideo?.id || '') ? "Completed" : "In Progress"}
              </p>
            </div>
            <Button 
              variant={progressMap.get(selectedVideo?.id || '') ? "default" : "outline"} 
              size="sm"
              onClick={() => selectedVideo && toggleWatchedStatus(selectedVideo.id)}
              disabled={isToggling}
              className="ml-4"
            >
              {progressMap.get(selectedVideo?.id || '') ? <><CheckCircle2 className="mr-2 h-4 w-4" /> Watched</> : "Mark as Watched"}
            </Button>
          </DialogHeader>
          <div className="aspect-video">
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
          <div className="p-4 bg-background text-sm text-foreground">
            {selectedVideo?.description}
          </div>
        </DialogContent>
      </Dialog>
      <MadeWithDyad />
    </div>
  );
};

export default UserVideosPage;