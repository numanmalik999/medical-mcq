"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns'; // Added missing date-fns imports
import { MCQ } from '@/components/mcq-columns';
import { useBookmark } from '@/hooks/use-bookmark';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface MCQExplanation {
  id: string;
  explanation_text: string;
  image_url: string | null;
}

const BookmarkedMcqsPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [bookmarkedMcqs, setBookmarkedMcqs] = useState<MCQ[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());

  const currentMcq = bookmarkedMcqs[currentMcqIndex];
  const { isBookmarked, toggleBookmark, isLoading: isBookmarkLoading } = useBookmark(currentMcq?.id || null);

  const fetchExplanation = useCallback(async (explanationId: string): Promise<MCQExplanation | null> => {
    if (explanations.has(explanationId)) {
      return explanations.get(explanationId)!;
    }
    const { data, error } = await supabase
      .from('mcq_explanations')
      .select('*')
      .eq('id', explanationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Supabase Error fetching explanation:', error);
      toast({
        title: "Error",
        description: `Failed to load explanation: ${error.message || 'Unknown error'}.`,
        variant: "destructive",
      });
      return null;
    } else if (data) {
      setExplanations(prev => new Map(prev).set(explanationId, data));
      return data;
    }
    return null;
  }, [explanations, toast]);

  const fetchBookmarkedMcqs = useCallback(async () => {
    if (!user) {
      setBookmarkedMcqs([]);
      setIsPageLoading(false);
      return;
    }

    setIsPageLoading(true);
    try {
      const { data: bookmarkedLinks, error: linksError } = await supabase
        .from('user_bookmarked_mcqs')
        .select('mcq_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (linksError) throw linksError;

      const mcqIds = bookmarkedLinks.map(link => link.mcq_id);

      if (mcqIds.length === 0) {
        setBookmarkedMcqs([]);
        setIsPageLoading(false);
        return;
      }

      // Fetch MCQs and their category links
      const { data: mcqsData, error: mcqsError } = await supabase
        .from('mcqs')
        .select(`
          *,
          mcq_category_links (
            category_id,
            categories (name)
          )
        `)
        .in('id', mcqIds);

      if (mcqsError) throw mcqsError;

      // Order MCQs based on the order of mcqIds from bookmarkedLinks
      const orderedMcqs = mcqIds.map(id => mcqsData.find(mcq => mcq.id === id)).filter((mcq): mcq is any => mcq !== undefined);

      const formattedMcqs: MCQ[] = orderedMcqs.map((mcq: any) => ({
        ...mcq,
        category_links: mcq.mcq_category_links.map((link: any) => ({
          category_id: link.category_id,
          category_name: link.categories?.name || null,
        })),
      }));

      setBookmarkedMcqs(formattedMcqs);
      setCurrentMcqIndex(0); // Reset to first MCQ when bookmarks are fetched
      setShowExplanation(false); // Hide explanation initially
    } catch (error: any) {
      console.error("Error fetching bookmarked MCQs:", error);
      toast({
        title: "Error",
        description: `Failed to load bookmarked MCQs: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      setBookmarkedMcqs([]);
    } finally {
      setIsPageLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (hasCheckedInitialSession && user) {
      fetchBookmarkedMcqs();
    } else if (hasCheckedInitialSession && !user) {
      setIsPageLoading(false); // Not logged in, no bookmarks to show
    }
  }, [user, hasCheckedInitialSession, fetchBookmarkedMcqs]);

  // Effect to fetch explanation when currentMcq changes and explanation is needed
  useEffect(() => {
    if (currentMcq && showExplanation && currentMcq.explanation_id) {
      fetchExplanation(currentMcq.explanation_id);
    }
  }, [currentMcq, showExplanation, fetchExplanation]);

  const handleNextMcq = () => {
    if (currentMcqIndex < bookmarkedMcqs.length - 1) {
      setCurrentMcqIndex(prev => prev + 1);
      setShowExplanation(false);
    }
  };

  const handlePreviousMcq = () => {
    if (currentMcqIndex > 0) {
      setCurrentMcqIndex(prev => prev - 1);
      setShowExplanation(false);
    }
  };

  const handleToggleExplanation = () => {
    setShowExplanation(prev => !prev);
  };

  const handleBookmarkToggle = async () => {
    if (currentMcq) {
      await toggleBookmark();
      // After toggling, re-fetch bookmarks to update the list if it was removed
      if (isBookmarked) { // If it was bookmarked and now removed
        // Use a slight delay to allow DB to update before refetching
        setTimeout(() => fetchBookmarkedMcqs(), 300);
      } else { // If it was not bookmarked and now added
        // No need to refetch the whole list if we just added one, but we do it for simplicity here
        // In a real app, you might just update the local state if the list order doesn't matter.
        // Since we rely on the fetched order, we refetch.
        setTimeout(() => fetchBookmarkedMcqs(), 300);
      }
    }
  };

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 pt-16">
        <p className="text-gray-700 dark:text-gray-300">Loading bookmarked MCQs...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
        <Card className="w-full max-w-2xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Login Required</CardTitle>
            <CardDescription>
              You need to be logged in to view your bookmarked MCQs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">Please log in or sign up to save and review your favorite questions.</p>
            <Link to="/login">
              <Button className="w-full sm:w-auto">Go to Login</Button>
            </Link>
          </CardContent>
          <MadeWithDyad />
        </Card>
      </div>
    );
  }

  if (bookmarkedMcqs.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
        <Card className="w-full max-w-2xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl">No Bookmarked MCQs</CardTitle>
            <CardDescription>
              You haven't bookmarked any questions yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">Start a quiz and use the bookmark icon to save questions for later review!</p>
            <Link to="/quiz">
              <Button className="w-full sm:w-auto">Start a Quiz</Button>
            </Link>
          </CardContent>
          <MadeWithDyad />
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
      <Card className="w-full max-w-3xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-xl">Bookmarked MCQ {currentMcqIndex + 1} / {bookmarkedMcqs.length}</CardTitle>
            {currentMcq?.difficulty && (
              <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                Difficulty: {currentMcq.difficulty}
              </CardDescription>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleBookmarkToggle}
            disabled={isBookmarkLoading}
            className="text-primary hover:text-primary-foreground/90"
          >
            {isBookmarked ? <BookmarkCheck className="h-6 w-6 fill-current" /> : <Bookmark className="h-6 w-6" />}
            <span className="sr-only">{isBookmarked ? "Remove bookmark" : "Add bookmark"}</span>
          </Button>
        </CardHeader>
        <CardContent>
          <p className="text-lg font-semibold mb-4">{currentMcq?.question_text}</p>
          <RadioGroup value={currentMcq?.correct_answer} disabled className="space-y-2">
            {['A', 'B', 'C', 'D'].map((optionKey) => {
              const optionText = currentMcq?.[`option_${optionKey.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
              const isCorrectOption = currentMcq?.correct_answer === optionKey;

              return (
                <div key={optionKey} className="flex items-center space-x-2 p-2 rounded-md">
                  <RadioGroupItem value={optionKey} id={`option-${optionKey}`} />
                  <Label
                    htmlFor={`option-${optionKey}`}
                    className={cn(
                      "flex-grow",
                      isCorrectOption && "text-green-600 font-medium"
                    )}
                  >
                    {`${optionKey}. ${optionText as string}`}
                    {isCorrectOption && <span className="ml-2">(Correct Answer)</span>}
                  </Label>
                </div>
              );
            })}
          </RadioGroup>

          {showExplanation && explanations.has(currentMcq?.explanation_id || '') && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold mb-2">Explanation:</h3>
              <p className="text-gray-800 dark:text-gray-200">{explanations.get(currentMcq?.explanation_id || '')?.explanation_text}</p>
              {explanations.get(currentMcq?.explanation_id || '')?.image_url && (
                <img src={explanations.get(currentMcq?.explanation_id || '')?.image_url || ''} alt="Explanation" className="mt-4 max-w-full h-auto rounded-md" />
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button onClick={handlePreviousMcq} disabled={currentMcqIndex === 0} variant="outline">
            Previous
          </Button>
          <Button onClick={handleToggleExplanation} variant="secondary">
            {showExplanation ? "Hide Explanation" : "Show Explanation"}
          </Button>
          <Button onClick={handleNextMcq} disabled={currentMcqIndex === bookmarkedMcqs.length - 1}>
            Next
          </Button>
        </CardFooter>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default BookmarkedMcqsPage;