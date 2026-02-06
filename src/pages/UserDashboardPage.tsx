"use client";

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, TrendingUp, Clock, Target, ArrowRight, Sparkles } from 'lucide-react'; 
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
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [areasForImprovement, setAreasForImprovement] = useState<PerformanceSummary[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);

  const isGuestMode = !user; 

  useEffect(() => {
    if (hasCheckedInitialSession) {
      const fetchData = async () => {
        setIsPageLoading(true);
        await fetchAllCategories(); 
        await fetchQuizPerformance();
        await fetchRecentAttempts();
        setIsPageLoading(false);
      };
      fetchData();
    }
  }, [user, hasCheckedInitialSession]);

  const fetchAllCategories = async () => {
    const { data: categoriesData } = await supabase.from('categories').select('*');
    setAllCategories(categoriesData || []);
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

  // Logic to detect if user is on a "Trial" based on their end date being within 3 days of joining
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-primary text-primary-foreground">
          <CardHeader className="pb-2">
            <CardDescription className="text-primary-foreground/70 flex items-center gap-2">
                <Target className="h-4 w-4" /> Overall Accuracy
            </CardDescription>
            <CardTitle className="text-3xl font-bold">{quizPerformance?.accuracy.toFixed(1) || '0.0'}%</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full bg-white/20 rounded-full mt-2">
                <div className="h-full bg-white rounded-full" style={{ width: `${quizPerformance?.accuracy || 0}%` }}></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Total Practice
            </CardDescription>
            <CardTitle className="text-3xl font-bold">{quizPerformance?.totalAttempts || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">MCQs attempted across all specialties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Access Level
            </CardDescription>
            <div className="flex items-baseline gap-2">
              <CardTitle className="text-2xl font-bold">{isCurrentlyOnTrial ? 'Free Trial' : (user?.has_active_subscription ? 'Premium' : 'Standard')}</CardTitle>
              {user?.has_active_subscription && daysRemaining !== null && (
                <span className={cn("text-xs font-bold", daysRemaining <= 1 ? "text-red-500 animate-pulse" : "text-muted-foreground")}>
                  ({daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left)
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Link to="/user/subscriptions" className="text-xs text-primary font-bold hover:underline">
                {user?.has_active_subscription ? 'Manage Access' : 'Upgrade for Full Access'}
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        <Card className="md:col-span-4 shadow-sm">
          <CardHeader>
            <CardTitle>Performance by Specialty</CardTitle>
            <CardDescription>Visual breakdown of your accuracy across different medical fields.</CardDescription>
          </CardHeader>
          <CardContent className="h-[350px] pl-2">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" domain={[0, 100]} hide />
                  <YAxis dataKey="name" type="category" width={100} axisLine={false} tickLine={false} style={{ fontSize: '12px' }} />
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
                  <p className="text-muted-foreground font-medium">Not enough data to visualize.</p>
                  <p className="text-xs text-muted-foreground mt-1">Complete more quizzes to unlock charts.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3 shadow-sm">
          <CardHeader>
            <CardTitle>Focus Areas</CardTitle>
            <CardDescription>Categories with the lowest accuracy.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {areasForImprovement.length > 0 ? (
              areasForImprovement.map((area) => (
                <div key={area.id} className="group relative flex items-center justify-between p-4 border rounded-xl hover:bg-muted/50 transition-colors">
                  <div className="space-y-1">
                    <p className="text-sm font-bold">{area.name}</p>
                    <div className="flex items-center gap-2">
                        <Badge variant={area.accuracy < 40 ? "destructive" : "secondary"} className="text-[10px]">
                            {area.accuracy.toFixed(1)}% Accuracy
                        </Badge>
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">{area.totalAttempts} Attempts</span>
                    </div>
                  </div>
                  <Link to="/quiz">
                    <Button size="icon" variant="ghost" className="rounded-full"><ArrowRight className="h-4 w-4" /></Button>
                  </Link>
                </div>
              ))
            ) : (
                <div className="text-center py-10 opacity-50">
                    <p>Continue practicing to see your focus areas.</p>
                </div>
            )}
          </CardContent>
          <CardFooter>
             <Link to="/quiz" className="w-full">
                <Button variant="outline" className="w-full">Improve Score</Button>
             </Link>
          </CardFooter>
        </Card>
      </div>

      <div className="grid gap-6">
        <Card className="shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle className="text-lg">Recent Quiz Activity</CardTitle>
            <CardDescription>Your last 5 individual question attempts.</CardDescription>
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
                      <p className="text-sm font-medium text-foreground line-clamp-1">
                        {attempt.question_text}
                      </p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{new Date(attempt.attempt_timestamp).toLocaleDateString()}</span>
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded font-bold">Answer: {attempt.selected_option}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-20 text-center text-muted-foreground italic">No recent attempts. Start practicing today!</div>
            )}
          </CardContent>
          <CardFooter className="bg-muted/10 p-4 border-t text-center">
             <Link to="/user/bookmarked-mcqs" className="text-xs text-primary font-bold hover:underline mx-auto">View Your Saved Questions</Link>
          </CardFooter>
        </Card>
      </div>

      <MadeWithDyad />
    </div>
  );
};

export default UserDashboardPage;