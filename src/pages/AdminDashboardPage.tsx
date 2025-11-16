"use client";

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Loader2, Users, CreditCard, ArrowRight } from 'lucide-react';
import { User } from '@supabase/supabase-js';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

// Define interfaces for the new data
interface RecentSubscription {
  id: string;
  created_at: string;
  status: string;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
  }[] | null;
  subscription_tiers: {
    name: string;
  }[] | null;
}

const AdminDashboardPage = () => {
  const { hasCheckedInitialSession } = useSession();
  const [dailyStats, setDailyStats] = useState<{
    question: string;
    totalSubmissions: number;
    correctSubmissions: number;
  } | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  
  // New states
  const [recentUsers, setRecentUsers] = useState<User[]>([]);
  const [recentSubscriptions, setRecentSubscriptions] = useState<RecentSubscription[]>([]);
  const [isLoadingRecentData, setIsLoadingRecentData] = useState(true);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      const fetchDashboardData = async () => {
        setIsLoadingStats(true);
        setIsLoadingRecentData(true);
        
        // Fetch daily stats
        try {
          const { data: dailyMcqData, error: dailyMcqError } = await supabase.functions.invoke('get-daily-mcq');
          if (dailyMcqError) throw dailyMcqError;
          if (!dailyMcqData || !dailyMcqData.daily_mcq_id) {
            setDailyStats(null);
          } else {
            const { daily_mcq_id, mcq } = dailyMcqData;
            const { count: totalCount, error: totalError } = await supabase
              .from('daily_mcq_submissions')
              .select('id', { count: 'exact', head: true })
              .eq('daily_mcq_id', daily_mcq_id);
            if (totalError) throw totalError;
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
          }
        } catch (error: any) {
          console.error("Error fetching daily stats:", error);
        } finally {
          setIsLoadingStats(false);
        }

        // Fetch recent users and subscriptions
        try {
          const [usersResponse, subsResponse] = await Promise.all([
            supabase.functions.invoke('list-recent-users'),
            supabase
              .from('user_subscriptions')
              .select(`
                id,
                created_at,
                status,
                profiles ( first_name, last_name, email ),
                subscription_tiers ( name )
              `)
              .order('created_at', { ascending: false })
              .limit(5)
          ]);

          if (usersResponse.error) throw usersResponse.error;
          setRecentUsers(usersResponse.data || []);

          if (subsResponse.error) throw subsResponse.error;
          setRecentSubscriptions(subsResponse.data as RecentSubscription[] || []);

        } catch (error: any) {
          console.error("Error fetching recent activity:", error);
        } finally {
          setIsLoadingRecentData(false);
        }
      };

      fetchDashboardData();
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

      {/* New Cards for Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> Recent Signups</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/manage-users">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingRecentData ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : recentUsers.length > 0 ? (
              <div className="space-y-4">
                {recentUsers.map(user => (
                  <div key={user.id} className="flex items-center gap-4">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="grid gap-1">
                      <p className="text-sm font-medium leading-none">{user.email}</p>
                      <p className="text-sm text-muted-foreground">{formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-10">No new user signups recently.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Recent Subscriptions</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/manage-subscriptions">View All <ArrowRight className="h-4 w-4 ml-1" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoadingRecentData ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : recentSubscriptions.length > 0 ? (
              <div className="space-y-4">
                {recentSubscriptions.map(sub => (
                  <div key={sub.id} className="flex items-center gap-4">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>{sub.profiles?.[0]?.first_name?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
                    </Avatar>
                    <div className="grid gap-1">
                      <p className="text-sm font-medium leading-none">{`${sub.profiles?.[0]?.first_name || ''} ${sub.profiles?.[0]?.last_name || ''}`.trim() || sub.profiles?.[0]?.email || 'Unknown User'}</p>
                      <p className="text-sm text-muted-foreground">
                        Subscribed to "{sub.subscription_tiers?.[0]?.name || 'Unknown Plan'}" {formatDistanceToNow(new Date(sub.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-10">No new subscriptions recently.</p>
            )}
          </CardContent>
        </Card>
      </div>
      
      <MadeWithDyad />
    </div>
  );
};

export default AdminDashboardPage;