"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { useToast } from '@/hooks/use-toast';

export const useBookmark = (mcqId: string | null) => {
  const { user } = useSession();
  const { toast } = useToast();
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const checkBookmarkStatus = useCallback(async () => {
    if (!user || !mcqId) {
      setIsBookmarked(false);
      return;
    }
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_bookmarked_mcqs')
        .select('id')
        .eq('user_id', user.id)
        .eq('mcq_id', mcqId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
        throw error;
      }
      setIsBookmarked(!!data);
    } catch (error: any) {
      console.error("Error checking bookmark status:", error);
      toast({
        title: "Error",
        description: `Failed to check bookmark status: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, mcqId, toast]);

  useEffect(() => {
    checkBookmarkStatus();
  }, [checkBookmarkStatus]);

  const toggleBookmark = useCallback(async () => {
    if (!user || !mcqId) {
      toast({
        title: "Login Required",
        description: "You must be logged in to bookmark MCQs.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    try {
      if (isBookmarked) {
        // Remove bookmark
        const { error } = await supabase
          .from('user_bookmarked_mcqs')
          .delete()
          .eq('user_id', user.id)
          .eq('mcq_id', mcqId);

        if (error) throw error;
        setIsBookmarked(false);
        toast({ title: "Removed", description: "MCQ removed from bookmarks." });
      } else {
        // Add bookmark
        const { error } = await supabase
          .from('user_bookmarked_mcqs')
          .insert({ user_id: user.id, mcq_id: mcqId });

        if (error) throw error;
        setIsBookmarked(true);
        toast({ title: "Bookmarked", description: "MCQ added to bookmarks." });
      }
    } catch (error: any) {
      console.error("Error toggling bookmark:", error);
      toast({
        title: "Error",
        description: `Failed to toggle bookmark: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user, mcqId, isBookmarked, toast]);

  return { isBookmarked, toggleBookmark, isLoading };
};