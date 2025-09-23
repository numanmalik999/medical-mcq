"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QuizPerformance {
  totalAttempts: number;
  correctAttempts: number;
  accuracy: string;
}

const UserDashboardPage = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const { toast } = useToast();
  const [quizPerformance, setQuizPerformance] = useState<QuizPerformance | null>(null);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(true);

  useEffect(() => {
    if (user && !isSessionLoading) {
      fetchQuizPerformance();
    } else if (!user && !isSessionLoading) {
      setIsLoadingPerformance(false);
    }
  }, [user, isSessionLoading]);

  const fetchQuizPerformance = async () => {
    if (!user) return;
    setIsLoadingPerformance(true);

    const { data, error } = await supabase
      .from('user_quiz_attempts')
      .select('is_correct', { count: 'exact' })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching quiz performance:', error);
      toast({ title: "Error", description: "Failed to load quiz performance.", variant: "destructive" });
      setQuizPerformance(null);
    } else {
      const totalAttempts = data.length;
      const correctAttempts = data.filter(attempt => attempt.is_correct).length;
      const accuracy = totalAttempts > 0 ? ((correctAttempts / totalAttempts) * 100).toFixed(2) : '0.00';

      setQuizPerformance({
        totalAttempts,
        correctAttempts,
        accuracy: `${accuracy}%`,
      });
    }
    setIsLoadingPerformance(false);
  };

  if (isSessionLoading || isLoadingPerformance) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading user dashboard...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-red-500">You must be logged in to view your dashboard.</p>
      </div>
    );
  }

  const userEmail = user?.email || 'Guest';

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome, {userEmail}!</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700 dark:text-gray-300">
            This is your personal space. Here you can find your quiz progress, profile settings, and more.
          </p>
          <p className="mt-4 text-gray-700 dark:text-gray-300">
            Use the sidebar to navigate.
          </p>
        </CardContent>
      </Card>

      {/* Quiz Performance Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Quiz Performance Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-4 border rounded-md">
            <p className="text-2xl font-bold">{quizPerformance?.totalAttempts || 0}</p>
            <p className="text-sm text-muted-foreground">Total Attempts</p>
          </div>
          <div className="text-center p-4 border rounded-md">
            <p className="text-2xl font-bold">{quizPerformance?.correctAttempts || 0}</p>
            <p className="text-sm text-muted-foreground">Correct Answers</p>
          </div>
          <div className="text-center p-4 border rounded-md">
            <p className="text-2xl font-bold">{quizPerformance?.accuracy || '0.00%'}</p>
            <p className="text-sm text-muted-foreground">Accuracy</p>
          </div>
        </CardContent>
      </Card>

      <MadeWithDyad />
    </div>
  );
};

export default UserDashboardPage;