"use client";

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface CategoryStats {
  id: string;
  name: string;
  mcqCount: number;
  attempts: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  incorrectMcqIds: string[];
}

const QuizPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchData();
    }
  }, [hasCheckedInitialSession, user]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch all categories
      const { data: categories, error: catError } = await supabase.from('categories').select('id, name');
      if (catError) throw catError;

      // 2. Fetch all MCQ-category links to count MCQs per category
      const { data: links, error: linksError } = await supabase.from('mcq_category_links').select('category_id');
      if (linksError) throw linksError;

      const mcqCounts = new Map<string, number>();
      for (const link of links) {
        mcqCounts.set(link.category_id, (mcqCounts.get(link.category_id) || 0) + 1);
      }

      let userAttempts: any[] = [];
      if (user) {
        // 3. Fetch user attempts if logged in
        const { data: attemptsData, error: attemptsError } = await supabase
          .from('user_quiz_attempts')
          .select('category_id, is_correct, mcq_id')
          .eq('user_id', user.id);
        if (attemptsError) throw attemptsError;
        userAttempts = attemptsData || [];
      }

      // 4. Combine all data
      const stats: CategoryStats[] = categories.map(category => {
        const attemptsInCategory = userAttempts.filter(a => a.category_id === category.id);
        const correctAttempts = attemptsInCategory.filter(a => a.is_correct).length;
        const totalAttempts = attemptsInCategory.length;
        const incorrectAttempts = totalAttempts - correctAttempts;
        const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;
        const incorrectMcqIds = attemptsInCategory.filter(a => !a.is_correct).map(a => a.mcq_id);

        return {
          id: category.id,
          name: category.name,
          mcqCount: mcqCounts.get(category.id) || 0,
          attempts: totalAttempts,
          correct: correctAttempts,
          incorrect: incorrectAttempts,
          accuracy: accuracy,
          incorrectMcqIds: Array.from(new Set(incorrectMcqIds)), // Unique incorrect IDs
        };
      });

      setCategoryStats(stats.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error: any) {
      console.error("Error fetching quiz data:", error);
      toast({ title: "Error", description: "Failed to load quiz categories.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCategories = useMemo(() => {
    return categoryStats.filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [categoryStats, searchTerm]);

  const startQuiz = (categoryId: string) => {
    navigate('/quiz/run', { state: { categoryId } });
  };

  const startIncorrectQuiz = (incorrectMcqIds: string[]) => {
    if (incorrectMcqIds.length === 0) {
      toast({ title: "No incorrect questions", description: "You haven't answered any questions incorrectly in this category yet." });
      return;
    }
    navigate('/quiz/run', { state: { mcqIds: incorrectMcqIds } });
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 pt-16">
      <div className="container mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold">Select a Quiz Category</h1>
          <p className="text-muted-foreground mt-2">Choose a category to start your quiz and view your performance.</p>
        </div>
        <div className="max-w-xl mx-auto mb-8">
          <Input
            placeholder="Search categories..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredCategories.map(cat => (
            <Card key={cat.id}>
              <CardHeader>
                <CardTitle>{cat.name}</CardTitle>
                <CardDescription>{cat.mcqCount} MCQs available</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>Attempts: {cat.attempts}</p>
                  <p>Correct: {cat.correct}</p>
                  <p>Incorrect: {cat.incorrect}</p>
                  <p>Accuracy: {cat.accuracy.toFixed(2)}%</p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2">
                <Button className="w-full" onClick={() => startQuiz(cat.id)}>Start Quiz</Button>
                <Button className="w-full" variant="outline" onClick={() => startIncorrectQuiz(cat.incorrectMcqIds)} disabled={cat.incorrect === 0}>
                  Attempt Incorrect ({cat.incorrect})
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default QuizPage;