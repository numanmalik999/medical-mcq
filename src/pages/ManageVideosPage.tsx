"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Trash2, 
  Edit, 
  Layers, 
  FolderTree, 
  Video as VideoIcon,
  Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import EditVideoDialog from '@/components/EditVideoDialog';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import LoadingBar from '@/components/LoadingBar';
import { MadeWithDyad } from '@/components/made-with-dyad';

interface Video {
  id: string;
  title: string;
  description: string | null;
  youtube_video_id: string;
  platform: string;
  group_id: string | null;
  subgroup_id: string | null;
  order: number;
  created_at: string;
}

interface StructuredLibrary {
  id: string;
  name: string;
  standaloneVideos: Video[];
  subgroups: {
    id: string;
    name: string;
    videos: Video[];
  }[];
}

const ManageVideosPage = () => {
  const { toast } = useToast();
  const [library, setLibrary] = useState<StructuredLibrary[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const fetchStructuredData = useCallback(async () => {
    setIsPageLoading(true);
    try {
      const [groupsRes, subRes, videoRes] = await Promise.all([
        supabase.from('video_groups').select('*').order('order'),
        supabase.from('video_subgroups').select('*').order('order'),
        supabase.from('videos').select('*').order('order', { ascending: true })
      ]);

      if (groupsRes.error) throw groupsRes.error;
      if (subRes.error) throw subRes.error;
      if (videoRes.error) throw videoRes.error;

      const allVideos = videoRes.data || [];
      const allSubgroups = subRes.data || [];
      
      const structured: StructuredLibrary[] = (groupsRes.data || []).map(g => {
        const groupSubgroups = allSubgroups
          .filter(sg => sg.group_id === g.id)
          .map(sg => ({
            id: sg.id,
            name: sg.name,
            videos: allVideos.filter(v => v.subgroup_id === sg.id)
          }));

        return {
          id: g.id,
          name: g.name,
          subgroups: groupSubgroups,
          standaloneVideos: allVideos.filter(v => v.group_id === g.id && !v.subgroup_id)
        };
      });

      // Handle videos with no group at all
      const uncategorized = allVideos.filter(v => !v.group_id);
      if (uncategorized.length > 0) {
        structured.push({
          id: 'uncategorized',
          name: 'Uncategorized / General',
          subgroups: [],
          standaloneVideos: uncategorized
        });
      }

      setLibrary(structured);
    } catch (error: any) {
      console.error("Error fetching video data:", error);
      toast({ title: "Error", description: "Failed to load video structure.", variant: "destructive" });
    } finally {
      setIsPageLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchStructuredData();
  }, [fetchStructuredData]);

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this video?")) return;
    const { error } = await supabase.from('videos').delete().eq('id', id);
    if (!error) {
      toast({ title: "Deleted", description: "Video removed from library." });
      fetchStructuredData();
    } else {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const VideoRow = ({ video }: { video: Video }) => (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-background hover:bg-muted/30 transition-colors group">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex flex-col items-center justify-center bg-muted px-2 py-1 rounded text-[10px] font-bold min-w-[32px]">
          {video.order}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{video.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="secondary" className="text-[9px] h-4 uppercase tracking-tighter">
              {video.platform}
            </Badge>
            <span className="text-[10px] text-muted-foreground font-mono truncate">{video.youtube_video_id}</span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedVideo(video); setIsDialogOpen(true); }}>
          <Edit className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(video.id)}>
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
          <h1 className="text-3xl font-bold tracking-tight">Video Content Manager</h1>
          <p className="text-muted-foreground text-sm">Organize and number your medical lessons by category.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/manage-video-groups">
            <Button variant="outline" size="sm"><Layers className="h-4 w-4 mr-2" /> Groups</Button>
          </Link>
          <Link to="/admin/manage-video-subgroups">
            <Button variant="outline" size="sm"><FolderTree className="h-4 w-4 mr-2" /> Sub-groups</Button>
          </Link>
          <Button size="sm" onClick={() => { setSelectedVideo(null); setIsDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Add Video
          </Button>
        </div>
      </div>

      {library.length === 0 ? (
        <Card className="border-dashed py-20">
          <div className="flex flex-col items-center justify-center text-center px-4">
            <div className="p-4 bg-muted rounded-full mb-4">
              <VideoIcon className="h-10 w-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold">No Videos Found</h3>
            <p className="text-muted-foreground max-w-xs mt-2">Start by creating a group and adding your first educational video.</p>
          </div>
        </Card>
      ) : (
        <Accordion type="multiple" defaultValue={[library[0]?.id]} className="space-y-4">
          {library.map((group) => (
            <AccordionItem key={group.id} value={group.id} className="border rounded-xl bg-card overflow-hidden shadow-sm">
              <AccordionTrigger className="px-6 py-4 hover:bg-muted/30 hover:no-underline">
                <div className="flex items-center gap-3 text-left">
                  <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none px-2 py-0.5">
                    {group.standaloneVideos.length + group.subgroups.reduce((acc, sg) => acc + sg.videos.length, 0)} Lessons
                  </Badge>
                  <span className="font-bold text-lg">{group.name}</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="p-6 bg-muted/5 border-t">
                
                {/* Standalone Videos */}
                {group.standaloneVideos.length > 0 && (
                  <div className="space-y-3 mb-8">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Foundation Lessons</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.standaloneVideos.map(v => <VideoRow key={v.id} video={v} />)}
                    </div>
                  </div>
                )}

                {/* Subgroups */}
                <div className="space-y-6">
                  {group.subgroups.map(sg => (
                    <div key={sg.id} className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <FolderTree className="h-3 w-3 text-primary" />
                        <h4 className="text-xs font-bold uppercase tracking-tight">{sg.name}</h4>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {sg.videos.map(v => <VideoRow key={v.id} video={v} />)}
                        {sg.videos.length === 0 && (
                          <div className="md:col-span-2 py-4 border border-dashed rounded-lg text-center text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
                            No lessons in this sub-group
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {group.standaloneVideos.length === 0 && group.subgroups.length === 0 && (
                  <p className="text-center py-4 text-sm text-muted-foreground">This group is empty.</p>
                )}

              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      <EditVideoDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        video={selectedVideo} 
        onSave={fetchStructuredData} 
      />
      <MadeWithDyad />
    </div>
  );
};

export default ManageVideosPage;