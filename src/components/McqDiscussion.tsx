"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useSession } from '@/components/SessionContextProvider';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, Send, Trash2, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
}

interface McqDiscussionProps {
  mcqId: string;
}

const McqDiscussion = ({ mcqId }: McqDiscussionProps) => {
  const { user } = useSession();
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchComments = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('mcq_discussions')
        .select(`
          id,
          user_id,
          content,
          created_at,
          profiles (first_name, last_name, avatar_url)
        `)
        .eq('mcq_id', mcqId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data as any || []);
    } catch (error: any) {
      console.error("Error fetching discussions:", error);
    } finally {
      setIsLoading(false);
    }
  }, [mcqId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: "Login Required", description: "Please log in to join the discussion.", variant: "destructive" });
      return;
    }
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('mcq_discussions')
        .insert({
          mcq_id: mcqId,
          user_id: user.id,
          content: newComment.trim(),
        });

      if (error) throw error;

      setNewComment('');
      fetchComments();
      toast({ title: "Comment Posted", description: "Your clinical insight has been shared." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!window.confirm("Delete your comment?")) return;
    try {
      const { error } = await supabase.from('mcq_discussions').delete().eq('id', commentId);
      if (error) throw error;
      setComments(comments.filter(c => c.id !== commentId));
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 border-b pb-4">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="font-bold uppercase tracking-tight text-sm">Community Discussion</h3>
        <Badge variant="secondary" className="ml-auto text-[10px] font-black">{comments.length}</Badge>
      </div>

      <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary/20" /></div>
        ) : comments.length === 0 ? (
          <div className="text-center py-10 bg-muted/20 rounded-2xl border-2 border-dashed">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No thoughts shared yet</p>
            <p className="text-[10px] text-muted-foreground mt-1">Be the first to share a mnemonic or clinical pearl!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className={cn("flex gap-3 group", comment.user_id === user?.id && "flex-row-reverse")}>
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={comment.profiles?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/5 text-[10px] font-bold"><User className="h-4 w-4" /></AvatarFallback>
              </Avatar>
              <div className={cn("flex-grow space-y-1", comment.user_id === user?.id ? "text-right" : "text-left")}>
                <div className={cn("flex items-center gap-2 mb-1", comment.user_id === user?.id && "justify-end")}>
                  <span className="text-[10px] font-black uppercase text-slate-800">
                    {comment.profiles?.first_name ? `${comment.profiles.first_name} ${comment.profiles.last_name || ''}` : 'Anonymous User'}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-medium">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                  {comment.user_id === user?.id && (
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive opacity-0 group-hover:opacity-100" onClick={() => handleDelete(comment.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <div className={cn(
                    "p-3 rounded-2xl text-sm font-medium leading-relaxed inline-block max-w-[90%]",
                    comment.user_id === user?.id ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted/50 rounded-tl-none text-slate-800"
                )}>
                  {comment.content}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3 pt-4 border-t">
        <Textarea 
          placeholder={user ? "Share a mnemonic, strategy, or doubt..." : "Please log in to join the discussion."}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          disabled={isSubmitting || !user}
          className="rounded-xl bg-muted/20 border-none shadow-inner resize-none text-sm min-h-[80px]"
        />
        <Button 
          type="submit" 
          disabled={isSubmitting || !newComment.trim() || !user} 
          className="w-full rounded-xl h-10 font-bold uppercase tracking-tight text-xs"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Post Thought
        </Button>
      </form>
    </div>
  );
};

// Internal Badge helper
const Badge = ({ children, className, variant }: { children: React.ReactNode, className?: string, variant?: "default" | "secondary" }) => (
    <span className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
        variant === "secondary" ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground",
        className
    )}>
        {children}
    </span>
);

export default McqDiscussion;