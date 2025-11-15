"use client";

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const AdminDashboardPage = () => {
  const { hasCheckedInitialSession } = useSession();
  const [dailyStats, setDailyStats] = useState<{
    question: string;
    totalSubmissions: number;
    correctSubmissions: number;
  } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      const fetchDailyStats = async () => {
        setIsLoadingStats(true);
        try {
          // 1. Get today's daily MCQ
          const { data: dailyMcqData, error: dailyMcqError } = await supabase.functions.invoke('get-daily-mcq');
          if (dailyMcqError) throw dailyMcqError;
          if (!dailyMcqData || !dailyMcqData.daily_mcq_id) {
            setDailyStats(null); // No question for today
            return;
          }

          const { daily_mcq_id, mcq } = dailyMcqData;

          // 2. Get total submissions count
          const { count: totalCount, error: totalError } = await supabase
            .from('daily_mcq_submissions')
            .select('id', { count: 'exact', head: true })
            .eq('daily_mcq_id', daily_mcq_id);
          if (totalError) throw totalError;

          // 3. Get correct submissions count
          const { count: correctCount, error: correctError } = await supabase
            .from('daily_mcq_submissions')
            .select('id', { count: 'exact', head: true })
            .eq('daily_mcq_id', daily_mcq_id)
            .eq('is_correct', true);
          if (correctError) throw correctError;

          setDailyStats({
            question: mcq.question_text,
            totalSubmissions: totalCount || 0,
            correctSubmissions: correctCount || 0,
          });

        } catch (error: any) {
          console.error("Error fetching daily stats:", error);
          // Don't show a toast for this, as it's just a summary card
        } finally {
          setIsLoadingStats(false);
        }
      };

      fetchDailyStats();
    }
  }, [hasCheckedInitialSession]);

  if (!hasCheckedInitialSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700">Loading admin dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Use the sidebar to navigate through content management, user management, and other administrative tasks.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Today's Question of the Day</CardTitle>
            <CardDescription>A quick summary of today's engagement.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingStats ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : dailyStats ? (
              <>
                <p className="text-sm font-medium text-muted-foreground truncate" title={dailyStats.question}>
                  Q: {dailyStats.question}
                </p>
                <div className="flex justify-around text-center pt-2">
                  <div>
                    <p className="text-2xl font-bold">{dailyStats.totalSubmissions}</p>
                    <p className="text-xs text-muted-foreground">Total Submissions</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{dailyStats.correctSubmissions}</p>
                    <p className="text-xs text-muted-foreground">Correct</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{dailyStats.totalSubmissions - dailyStats.correctSubmissions}</p>
                    <p className="text-xs text-muted-foreground">Incorrect</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-center py-8">No question set for today.</p>
            )}
          </CardContent>
          <CardFooter>
            <Button asChild variant="outline" className="w-full">
              <Link to="/admin/manage-daily-mcqs">View Detailed Submissions</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
      
      <MadeWithDyad />
    </div>
  );
};

export default AdminDashboardPage;