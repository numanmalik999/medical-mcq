"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, PlayCircle, Lock, Loader2, CheckCircle2, Circle, Layers, FolderTree } from 'lucide-react';
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
  subgroup_id: string | null;
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
  standaloneVideos: Video[]; // Videos in the group but not in a subgroup
}

const UserVideosPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [library, setLibrary] = useState<VideoGroup[]>([]);
  const [progressMap, setProgressMap] = useState<Map<string, boolean>>(new Map());
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const fetchLibrary = useCallback(async () => {
    if (!user?.has_active_subscription) {
      setIsLoading(false);
      return;
    }

    try {
      const [groupsRes, subRes, videoRes, progRes] = await Promise.all([
        supabase.from('video_groups').select('*').order('order'),
        supabase.from('video_subgroups').select('*').order('order'),
        supabase.from('videos').select('*').order('created_at', { ascending: false }),
        supabase.from('user_video_progress').select('video_id, is_watched').eq('user_id', user.id)
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
    const newStatus = !(progressMap.get(videoId) || false);
    try {
      await supabase.from('user_video_progress').upsert({ user_id: user?.id, video_id: videoId, is_watched: newStatus }, { onConflict: 'user_id,video_id' });
      setProgressMap(prev => new Map(prev).set(videoId, newStatus));
      toast({ title: newStatus ? "Lesson Completed!" : "Progress updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const VideoCard = ({ video }: { video: Video }) => {
    const isWatched = progressMap.get(video.id) || false;
    const thumb = `https://img.youtube.com/vi/${video.youtube_video_id}/mqdefault.jpg`;
    
    return (
      <Card 
        className={cn("overflow-hidden cursor-pointer hover:shadow-md transition-all border-2", isWatched ? "border-green-500/20 bg-green-50/5" : "border-transparent")}
        onClick={() => setSelectedVideo(video)}
      >
        <div className="relative aspect-video bg-muted group">
          <img src={thumb} className="w-full h-full object-cover" alt={video.title} />
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayCircle className="h-10 w-10 text-white" />
          </div>
          {isWatched && <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-lg"><CheckCircle2 className="h-4 w-4" /></div>}
        </div>
        <div className="p-3">
          <div className="flex justify-between items-start gap-2">
            <h4 className="text-sm font-bold line-clamp-2 leading-tight">{video.title}</h4>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => toggleWatched(video.id, e)}>
              {isWatched ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  if (!hasCheckedInitialSession || isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  if (!user?.has_active_subscription) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Card className="border-primary/20 shadow-xl py-8">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4"><Lock className="h-10 w-10 text-primary" /></div>
            <CardTitle className="text-3xl">Premium Video Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Unlock high-yield tutorials organized by medical specialty and topic.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link to="/user/subscriptions"><Button size="lg" className="w-full">Explore Plans</Button></Link>
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
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Resource Library</h1>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search high-yield lessons..." className="pl-10 rounded-full" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
      </div>

      <Accordion type="multiple" defaultValue={library.map(g => g.id)} className="space-y-6">
        {library.map((group) => {
          const hasStandalone = group.standaloneVideos.length > 0;
          const hasSubgroups = group.subgroups.length > 0;
          if (!hasStandalone && !hasSubgroups) return null;

          return (
            <AccordionItem key={group.id} value={group.id} className="border rounded-2xl overflow-hidden shadow-sm bg-card">
              <AccordionTrigger className="px-6 py-4 hover:bg-muted/30 hover:no-underline">
                <div className="flex items-center gap-4 text-left">
                  <div className="p-2 bg-primary/5 rounded-lg text-primary"><Layers className="h-6 w-6" /></div>
                  <h2 className="text-xl font-bold">{group.name}</h2>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-muted/5 border-t space-y-6">
                {group.standaloneVideos.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.standaloneVideos.map(v => <VideoCard key={v.id} video={v} />)}
                  </div>
                )}

                {group.subgroups.map(sg => (
                  <div key={sg.id} className="space-y-3 bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-dashed">
                    <h3 className="text-md font-bold flex items-center gap-2 text-primary">
                      <FolderTree className="h-4 w-4" /> {sg.name}
                      <Badge variant="outline" className="text-[10px] uppercase">{sg.videos.length} Videos</Badge>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {sg.videos.map(v => <VideoCard key={v.id} video={v} />)}
                    </div>
                  </div>
                ))}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* Video Player Modal */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-black border-none rounded-3xl">
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
                src={`https://www.youtube.com/embed/${selectedVideo.youtube_video_id}?autoplay=1`}
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
      <MadeWithDyad />
    </div>
  );
};

export default UserVideosPage;