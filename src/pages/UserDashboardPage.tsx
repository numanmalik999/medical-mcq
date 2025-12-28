"use client";

import { useEffect, useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import LoadingBar from '@/components/LoadingBar';

interface QuizPerformance {
  totalAttempts: number;
  correctAttempts: number;
  accuracy: string;
}

interface RecentAttempt {
  id: string;
  mcq_id: string;
  question_text: string; 
  selected_option: string;
  is_correct: boolean;
  attempt_timestamp: string;
}

interface Category {
  id: string;
  name: string;
}

interface PerformanceSummary {
  id: string;
  name: string;
  type: 'category'; 
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number; 
}

const UserDashboardPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const [isFetchingData, setIsFetchingData] = useState(true); 

  const [quizPerformance, setQuizPerformance] = useState<QuizPerformance | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);
  const [areasForImprovement, setAreasForImprovement] = useState<PerformanceSummary[]>([]);

  const isGuestMode = !user; 

  const generateRecommendations = useCallback((attemptsData: any[], allCategories: Category[]) => {
    const categoryPerformance: { [key: string]: { total: number; correct: number } } = {};

    attemptsData.forEach(attempt => {
      if (attempt.category_id) {
        if (!categoryPerformance[attempt.category_id]) {
          categoryPerformance[attempt.category_id] = { total: 0, correct: 0 };
        }
        categoryPerformance[attempt.category_id].total++;
        if (attempt.is_correct) {
          categoryPerformance[attempt.category_id].correct++;
        }
      }
    });

    const performanceSummaries: PerformanceSummary[] = [];
    const catMap = new Map(allCategories.map(c => [c.id, c.name]));

    Object.keys(categoryPerformance).forEach(catId => {
      const catName = catMap.get(catId);
      if (catName) {
        const perf = categoryPerformance[catId];
        performanceSummaries.push({
          id: catId,
          name: catName,
          type: 'category',
          totalAttempts: perf.total,
          correctAttempts: perf.correct,
          accuracy: (perf.correct / perf.total) * 100,
        });
      }
    });

    // Areas for Improvement (lowest accuracy)
    const sortedByAccuracy = [...performanceSummaries].sort((a, b) => a.accuracy - b.accuracy);
    setAreasForImprovement(sortedByAccuracy.slice(0, 3)); 
  }, []);

  const loadDashboardData = useCallback(async () => {
    if (!user && !isGuestMode) return;
    
    setIsFetchingData(true);
    try {
      // Parallelize all independent fetches
      const [categoriesRes, attemptsRes, recentRes] = await Promise.all([
        supabase.from('categories').select('id, name'),
        user ? supabase.from('user_quiz_attempts').select('is_correct, category_id').eq('user_id', user.id) : Promise.resolve({ data: [] }),
        user ? supabase.from('user_quiz_attempts').select('id, mcq_id, selected_option, is_correct, attempt_timestamp, mcqs(question_text)').eq('user_id', user.id).order('attempt_timestamp', { ascending: false }).limit(5) : Promise.resolve({ data: [] })
      ]);

      const allCategories = categoriesRes.data || [];
      const allAttempts = attemptsRes.data || [];
      const recentData = recentRes.data || [];

      // Calculate general performance
      const total = allAttempts.length;
      const correct = allAttempts.filter(a => a.is_correct).length;
      setQuizPerformance({
        totalAttempts: total,
        correctAttempts: correct,
        accuracy: total > 0 ? ((correct / total) * 100).toFixed(2) + '%' : '0.00%',
      });

      // Format recent activity
      setRecentAttempts(recentData.map((a: any) => ({
        id: a.id,
        mcq_id: a.mcq_id,
        question_text: a.mcqs?.question_text || 'N/A',
        selected_option: a.selected_option,
        is_correct: a.is_correct,
        attempt_timestamp: a.attempt_timestamp,
      })));

      generateRecommendations(allAttempts, allCategories);
    } catch (e) {
      console.error('[Dashboard] Load error:', e);
      toast({ title: "Error", description: "Failed to load dashboard statistics.", variant: "destructive" });
    } finally {
      setIsFetchingData(false);
    }
  }, [user, isGuestMode, generateRecommendations, toast]);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      loadDashboardData();
    }
  }, [hasCheckedInitialSession, loadDashboardData]);

  if (!hasCheckedInitialSession || isFetchingData) return <LoadingBar />;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome, {user?.email || 'Guest'}!</h1>

      {isGuestMode && (
        <Card className="border-blue-500 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-700">Guest Mode</CardTitle>
            <CardDescription className="text-blue-600">Track progress by creating an account.</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold">{quizPerformance?.totalAttempts || 0}</p>
          <p className="text-sm text-muted-foreground">Total Attempts</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold">{quizPerformance?.correctAttempts || 0}</p>
          <p className="text-sm text-muted-foreground">Correct</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <p className="text-2xl font-bold">{quizPerformance?.accuracy || '0.00%'}</p>
          <p className="text-sm text-muted-foreground">Accuracy</p>
        </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Progress Logic */}
        <Card>
          <CardHeader><CardTitle>Areas for Improvement</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {areasForImprovement.length > 0 ? areasForImprovement.map(area => (
              <div key={area.id} className="flex items-center justify-between p-2 border rounded-md">
                <span className="font-medium">{area.name}</span>
                <Badge variant={area.accuracy < 50 ? "destructive" : "secondary"}>{area.accuracy.toFixed(1)}%</Badge>
              </div>
            )) : <p className="text-muted-foreground text-sm">Keep practicing to see insights.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {recentAttempts.length > 0 ? recentAttempts.map(attempt => (
              <div key={attempt.id} className="border-b pb-2 last:border-0">
                <p className="text-sm font-medium line-clamp-1">{attempt.question_text}</p>
                <div className="flex justify-between items-center mt-1">
                  <Badge variant={attempt.is_correct ? "default" : "destructive"}>{attempt.is_correct ? "Correct" : "Incorrect"}</Badge>
                  <span className="text-[10px] text-muted-foreground">{new Date(attempt.attempt_timestamp).toLocaleDateString()}</span>
                </div>
              </div>
            )) : <p className="text-muted-foreground text-sm">No recent quizzes found.</p>}
          </CardContent>
        </Card>
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default UserDashboardPage;