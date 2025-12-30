"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, PlayCircle, Lock, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useSession } from '@/components/SessionContextProvider';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MadeWithDyad } from '@/components/made-with-dyad';

interface Video {
  id: string;
  title: string;
  description: string | null;
  youtube_video_id: string;
  created_at: string;
}

const UserVideosPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const [videos, setVideos] = useState<Video[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  useEffect(() => {
    if (user?.has_active_subscription) {
      const fetchVideos = async () => {
        const { data } = await supabase.from('videos').select('*').order('created_at', { ascending: false });
        setVideos(data || []);
        setIsLoading(false);
      };
      fetchVideos();
    } else if (hasCheckedInitialSession) {
      setIsLoading(false);
    }
  }, [user, hasCheckedInitialSession]);

  if (!hasCheckedInitialSession) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;
  }

  if (!user?.has_active_subscription) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Card className="border-primary/20 shadow-xl py-8">
          <CardHeader>
            <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
              <Lock className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-3xl">Premium Video Library</CardTitle>
            <CardDescription className="text-lg">
              Our curated library of high-quality medical educational videos is for subscribers only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Gain access to the best tutorials from Ninja Nerd, Osmosis, and more, all organized by topic.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Link to="/user/subscriptions">
                <Button size="lg" className="w-full">View Subscription Plans</Button>
              </Link>
              <Link to="/user/dashboard">
                <Button variant="outline" size="lg" className="w-full">Back to Dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  const filteredVideos = videos.filter(v => 
    v.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold">Video Library</h1>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search videos..." 
            className="pl-8" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-muted-foreground">Loading videos...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVideos.map((video) => (
            <Card 
              key={video.id} 
              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => setSelectedVideo(video)}
            >
              <div className="relative aspect-video">
                <img 
                  src={`https://img.youtube.com/vi/${video.youtube_video_id}/maxresdefault.jpg`} 
                  className="w-full h-full object-cover"
                  alt={video.title}
                />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                  <PlayCircle className="h-12 w-12 text-white opacity-80 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              <CardHeader className="p-4">
                <CardTitle className="text-lg line-clamp-1">{video.title}</CardTitle>
                <CardDescription className="line-clamp-2 text-sm">{video.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {filteredVideos.length === 0 && !isLoading && (
        <div className="text-center py-20 text-muted-foreground">No videos found.</div>
      )}

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-black">
          <DialogHeader className="p-4 bg-background border-b">
            <DialogTitle>{selectedVideo?.title}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video">
            {selectedVideo && (
              <iframe 
                width="100%" 
                height="100%" 
                src={`https://www.youtube.com/embed/${selectedVideo.youtube_video_id}?autoplay=1`} 
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