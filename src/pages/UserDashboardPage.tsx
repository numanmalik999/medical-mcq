"use client";

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, TrendingUp, Clock, Target, ArrowRight, Sparkles, PlayCircle, MonitorPlay } from 'lucide-react'; 
import LoadingBar from '@/components/LoadingBar';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from "@/lib/utils";

interface QuizPerformance {
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number;
}

interface RecentAttempt {
  id: string;
  mcq_id: string;
  question_text: string; 
  selected_option: string;
  is_correct: boolean;
  attempt_timestamp: string;
}

interface RecentVideo {
  id: string;
  title: string;
  group_name: string;
  last_watched_at: string;
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
  const [isPageLoading, setIsPageLoading] = useState(true); 

  const [quizPerformance, setQuizPerformance] = useState<QuizPerformance | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);
  const [videoProgress, setVideoProgress] = useState({ watched: 0, total: 0, percentage: 0 });
  const [recentVideos, setRecentVideos] = useState<RecentVideo[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [areasForImprovement, setAreasForImprovement] = useState<PerformanceSummary[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  const isGuestMode = !user; 

  useEffect(() => {
    if (hasCheckedInitialSession) {
      const fetchData = async () => {
        setIsPageLoading(true);
        await Promise.all([
          fetchAllCategories(),
          fetchQuizPerformance(),
          fetchRecentAttempts(),
          fetchVideoStats()
        ]);
        setIsPageLoading(false);
      };
      fetchData();
    }
  }, [user, hasCheckedInitialSession]);

  const fetchAllCategories = async () => {
    const { data: categoriesData } = await supabase.from('categories').select('*');
    setAllCategories(categoriesData || []);
  };

  const fetchVideoStats = async () => {
    if (!user) return;

    try {
      // Fetch total video count
      const { count: totalVideos } = await supabase
        .from('videos')
        .select('*', { count: 'exact', head: true });

      // Fetch watched count
      const { data: progressData } = await supabase
        .from('user_video_progress')
        .select(`
          video_id,
          last_watched_at,
          videos (
            title,
            video_groups (name)
          )
        `)
        .eq('user_id', user.id)
        .eq('is_watched', true)
        .order('last_watched_at', { ascending: false });

      const watchedCount = progressData?.length || 0;
      const total = totalVideos || 0;
      
      setVideoProgress({
        watched: watchedCount,
        total: total,
        percentage: total > 0 ? (watchedCount / total) * 100 : 0
      });

      if (progressData) {
        const formattedVideos: RecentVideo[] = progressData.slice(0, 3).map((p: any) => ({
          id: p.video_id,
          title: p.videos?.title || 'Unknown Lesson',
          group_name: p.videos?.video_groups?.name || 'General',
          last_watched_at: p.last_watched_at
        }));
        setRecentVideos(formattedVideos);
      }
    } catch (e) {
      console.error("Error fetching video stats:", e);
    }
  };

  const fetchQuizPerformance = async () => {
    if (!user) return; 

    const { data: attemptsData, error: attemptsError } = await supabase
      .from('user_quiz_attempts')
      .select('is_correct, category_id') 
      .eq('user_id', user.id);

    if (attemptsError) {
      console.error('Error fetching quiz performance:', attemptsError);
      setQuizPerformance(null);
      return;
    }

    const totalAttempts = attemptsData.length;
    const correctAttempts = attemptsData.filter(attempt => attempt.is_correct).length;
    const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;

    setQuizPerformance({
      totalAttempts,
      correctAttempts,
      accuracy,
    });

    generateRecommendationsAndCharts(attemptsData);
  };

  const generateRecommendationsAndCharts = (attemptsData: any[]) => {
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
    const visualData: any[] = [];

    Object.keys(categoryPerformance).forEach(catId => {
      const cat = allCategories.find(c => c.id === catId);
      if (cat) {
        const perf = categoryPerformance[catId];
        const accuracy = perf.total > 0 ? (perf.correct / perf.total) * 100 : 0;
        performanceSummaries.push({
          id: catId,
          name: cat.name,
          type: 'category',
          totalAttempts: perf.total,
          correctAttempts: perf.correct,
          accuracy: accuracy,
        });

        visualData.push({
          name: cat.name.length > 10 ? cat.name.substring(0, 10) + '...' : cat.name,
          accuracy: parseFloat(accuracy.toFixed(1)),
          attempts: perf.total,
          fullName: cat.name
        });
      }
    });

    setChartData(visualData.sort((a, b) => b.accuracy - a.accuracy).slice(0, 8));
    setAreasForImprovement([...performanceSummaries].sort((a, b) => a.accuracy - b.accuracy).slice(0, 4)); 
  };

  const fetchRecentAttempts = async () => {
    if (!user) return; 

    const { data } = await supabase
      .from('user_quiz_attempts')
      .select(`
        id,
        mcq_id,
        selected_option,
        is_correct,
        attempt_timestamp,
        mcqs (question_text)
      `)
      .eq('user_id', user.id)
      .order('attempt_timestamp', { ascending: false })
      .limit(5); 

    if (data) {
      const formattedAttempts: RecentAttempt[] = data.map((attempt: any) => ({
        id: attempt.id,
        mcq_id: attempt.mcq_id,
        question_text: attempt.mcqs?.question_text || 'N/A',
        selected_option: attempt.selected_option,
        is_correct: attempt.is_correct,
        attempt_timestamp: attempt.attempt_timestamp,
      }));
      setRecentAttempts(formattedAttempts);
    }
  };

  if (!hasCheckedInitialSession || isPageLoading) {
    return <LoadingBar />;
  }

  const daysRemaining = user?.subscription_end_date 
    ? differenceInDays(parseISO(user.subscription_end_date), new Date()) 
    : null;

  const isCurrentlyOnTrial = user?.has_active_subscription && daysRemaining !== null && daysRemaining <= 3;

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {user?.first_name || user?.email || 'Guest'}. Tracking your exam readiness.</p>
        </div>
        <div className="flex gap-3">
           <Link to="/quiz"><Button className="rounded-full px-6">Start Practice</Button></Link>
           <Link to="/user/take-test"><Button variant="outline" className="rounded-full px-6">Take Mock Exam</Button></Link>
        </div>
      </div>

      {isCurrentlyOnTrial && (
        <Card className="border-primary bg-primary/5 border-l-4 shadow-md animate-in fade-in slide-in-from-top-4 duration-500">
          <CardHeader className="py-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary text-primary-foreground rounded-2xl shadow-lg">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-black">Welcome to Premium Trial!</CardTitle>
                <CardDescription className="text-foreground/80 font-medium">
                  You have full access to all features for the next {daysRemaining} days. Explore the full question bank and AI cases!
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {isGuestMode && (
        <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950/20 border-l-4">
          <CardHeader className="py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg text-blue-700 dark:text-blue-300">Guest Mode - Limited Progress Tracking</CardTitle>
                <CardDescription className="text-blue-600/80 dark:text-blue-400/80">
                  <Link to="/signup" className="font-bold underline">Create an account</Link> to get a 3-day free trial and unlock detailed analytics.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/70 flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                <Target className="h-4 w-4" /> Quiz Accuracy
            </CardDescription>
            <CardTitle className="text-3xl font-black">{quizPerformance?.accuracy.toFixed(1) || '0.0'}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full bg-white/20 rounded-full mt-2">
                <div className="h-full bg-white rounded-full" style={{ width: `${quizPerformance?.accuracy || 0}%` }}></div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                <MonitorPlay className="h-4 w-4 text-primary" /> Video Progress
            </CardDescription>
            <CardTitle className="text-3xl font-black">{videoProgress.watched} <span className="text-sm text-muted-foreground font-medium">/ {videoProgress.total}</span></CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full bg-muted rounded-full mt-2">
                <div className="h-full bg-primary rounded-full" style={{ width: `${videoProgress.percentage}%` }}></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                <TrendingUp className="h-4 w-4 text-primary" /> MCQs Solved
            </CardDescription>
            <CardTitle className="text-3xl font-black">{quizPerformance?.totalAttempts || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground font-medium">Across all specialties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
                <Clock className="h-4 w-4 text-primary" /> Access Level
            </CardDescription>
            <div className="flex items-baseline gap-2">
              <CardTitle className="text-2xl font-black">{isCurrentlyOnTrial ? 'Trial' : (user?.has_active_subscription ? 'Premium' : 'Standard')}</CardTitle>
              {user?.has_active_subscription && daysRemaining !== null && (
                <span className={cn("text-[10px] font-black uppercase", daysRemaining <= 1 ? "text-red-500 animate-pulse" : "text-muted-foreground")}>
                  ({daysRemaining} {daysRemaining === 1 ? 'day' : 'days'})
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Link to="/user/subscriptions" className="text-[10px] text-primary font-black uppercase hover:underline">
                {user?.has_active_subscription ? 'Manage Plan' : 'Upgrade Now'}
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="md:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Specialty Performance</CardTitle>
            <CardDescription>Accuracy rates across different medical fields.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] pl-2">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} style={{ fontSize: '12px', fontWeight: 'bold' }} />
                  <Tooltip 
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            return (
                                <div className="bg-white p-3 border rounded-lg shadow-xl text-xs text-black">
                                    <p className="font-bold mb-1">{payload[0].payload.fullName}</p>
                                    <p className="text-blue-600">Accuracy: {payload[0].value}%</p>
                                    <p className="text-muted-foreground">Attempts: {payload[0].payload.attempts}</p>
                                </div>
                            );
                        }
                        return null;
                    }}
                  />
                  <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} barSize={25}>
                    {chartData.map((entry, _index) => (
                      <Cell key={`cell-${_index}`} fill={entry.accuracy > 70 ? '#16a34a' : entry.accuracy > 40 ? '#2563eb' : '#dc2626'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-muted/20 rounded-xl border-2 border-dashed">
                  <TrendingUp className="h-10 w-10 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground font-medium uppercase text-xs">No analytics available yet</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Solve more MCQs to generate performance data.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="md:col-span-3 space-y-6">
            <Card className="shadow-sm border-none bg-primary/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <PlayCircle className="h-5 w-5 text-primary" /> Continue Watching
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    {recentVideos.length > 0 ? (
                        recentVideos.map(video => (
                            <Link key={video.id} to="/user/videos" className="flex items-center gap-3 p-3 rounded-xl bg-white border hover:border-primary transition-all group">
                                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
                                    <MonitorPlay className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-black uppercase truncate">{video.title}</p>
                                    <p className="text-[9px] text-muted-foreground font-bold">{video.group_name}</p>
                                </div>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            </Link>
                        ))
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">No recently watched videos</p>
                            <Link to="/user/videos"><Button variant="link" size="sm" className="text-[10px] h-auto p-0 font-black">Browse Library</Button></Link>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Focus Areas</CardTitle>
                    <CardDescription className="text-xs">Categories requiring immediate review.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {areasForImprovement.length > 0 ? (
                    areasForImprovement.map((area) => (
                        <div key={area.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-muted/30 transition-colors">
                            <div className="min-w-0">
                                <p className="text-xs font-black truncate uppercase tracking-tight">{area.name}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                    <Badge variant={area.accuracy < 40 ? "destructive" : "secondary"} className="text-[8px] h-4 px-1">
                                        {area.accuracy.toFixed(1)}%
                                    </Badge>
                                </div>
                            </div>
                            <Link to="/quiz">
                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full"><ArrowRight className="h-3 w-3" /></Button>
                            </Link>
                        </div>
                    ))
                    ) : (
                        <p className="text-center py-4 text-[10px] font-bold text-muted-foreground uppercase">Not enough data</p>
                    )}
                </CardContent>
            </Card>
        </div>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg">Recent Question History</CardTitle>
            <CardDescription className="text-xs">Audit of your last 5 individual MCQ attempts.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {recentAttempts.length > 0 ? (
              <div className="divide-y">
                {recentAttempts.map((attempt) => (
                  <div key={attempt.id} className="p-4 hover:bg-muted/30 transition-colors flex items-start gap-4">
                    <div className={cn("mt-1 p-1 rounded-full", attempt.is_correct ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                        {attempt.is_correct ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground line-clamp-1">
                        {attempt.question_text}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="text-[9px] text-muted-foreground font-black uppercase tracking-widest">{new Date(attempt.attempt_timestamp).toLocaleDateString()}</span>
                        <span className="text-[9px] bg-muted px-2 py-0.5 rounded font-black uppercase">Result: {attempt.is_correct ? 'Correct' : 'Failed'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-muted-foreground italic text-xs">No recent attempts. Start practicing today!</div>
            )}
          </CardContent>
          <CardFooter className="bg-muted/10 p-4 border-t text-center">
             <Link to="/user/bookmarked-mcqs" className="text-xs text-primary font-black uppercase hover:underline mx-auto">Review Your Bookmarked MCQs</Link>
          </CardFooter>
        </Card>
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default UserDashboardPage;