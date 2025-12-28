"use client";

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle } from 'lucide-react'; 
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
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [areasForImprovement, setAreasForImprovement] = useState<PerformanceSummary[]>([]);
  const [suggestedPractice, setSuggestedPractice] = useState<PerformanceSummary[]>([]);

  const isGuestMode = !user; 

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (user) {
        const fetchData = async () => {
          setIsFetchingData(true);
          await Promise.all([
            fetchAllCategories(), 
            fetchQuizPerformance(),
            fetchRecentAttempts(),
          ]);
          setIsFetchingData(false);
        };
        fetchData();
      } else {
        const fetchDataForGuest = async () => {
          setIsFetchingData(true);
          await fetchAllCategories(); 
          setQuizPerformance({ totalAttempts: 0, correctAttempts: 0, accuracy: '0.00%' });
          setRecentAttempts([]);
          setAreasForImprovement([]);
          setSuggestedPractice([]); 
          setIsFetchingData(false);
        };
        fetchDataForGuest();
      }
    }
  }, [user, hasCheckedInitialSession]); 

  const fetchAllCategories = async () => {
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');
    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories for recommendations.", variant: "destructive" });
      setAllCategories([]);
    } else {
      setAllCategories(categoriesData || []);
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
      toast({ title: "Error", description: "Failed to load quiz performance.", variant: "destructive" });
      setQuizPerformance(null);
      return;
    }

    const totalAttempts = attemptsData.length;
    const correctAttempts = attemptsData.filter(attempt => attempt.is_correct).length;
    const accuracy = totalAttempts > 0 ? ((correctAttempts / totalAttempts) * 100).toFixed(2) : '0.00';

    setQuizPerformance({
      totalAttempts,
      correctAttempts,
      accuracy: `${accuracy}%`,
    });

    generateRecommendations(attemptsData);
  };

  const generateRecommendations = (attemptsData: any[]) => {
    const categoryPerformance: { [key: string]: { total: number; correct: number; name: string } } = {};

    attemptsData.forEach(attempt => {
      if (attempt.category_id) {
        if (!categoryPerformance[attempt.category_id]) {
          categoryPerformance[attempt.category_id] = { total: 0, correct: 0, name: '' };
        }
        categoryPerformance[attempt.category_id].total++;
        if (attempt.is_correct) {
          categoryPerformance[attempt.category_id].correct++;
        }
      }
    });

    const performanceSummaries: PerformanceSummary[] = [];

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
      }
    });

    const sortedByAccuracy = [...performanceSummaries].sort((a, b) => a.accuracy - b.accuracy);
    setAreasForImprovement(sortedByAccuracy.slice(0, 3)); 

    const attemptedCategoryIds = new Set(attemptsData.map(a => a.category_id).filter(Boolean));
    const unattemptedCategories = allCategories.filter(cat => !attemptedCategoryIds.has(cat.id));

    const suggested: PerformanceSummary[] = [];
    unattemptedCategories.slice(0, 2).forEach(cat => { 
      suggested.push({
        id: cat.id,
        name: cat.name,
        type: 'category',
        totalAttempts: 0,
        correctAttempts: 0,
        accuracy: 0,
      });
    });

    const lowAttemptCategories = performanceSummaries
      .filter(p => p.type === 'category' && p.totalAttempts < 5 && p.accuracy > 50) 
      .sort((a, b) => a.totalAttempts - b.totalAttempts)
      .slice(0, 2 - suggested.length); 

    suggested.push(...lowAttemptCategories);
    setSuggestedPractice(suggested);
  };

  const fetchRecentAttempts = async () => {
    if (!user) return; 

    const { data, error } = await supabase
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

    if (error) {
      console.error('Error fetching recent attempts:', error);
      toast({ title: "Error", description: "Failed to load recent quiz activity.", variant: "destructive" });
      setRecentAttempts([]);
    } else {
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

  if (!hasCheckedInitialSession || isFetchingData) {
    return <LoadingBar />;
  }

  if (!user && !isGuestMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-red-500">You must be logged in to view your dashboard.</p>
      </div>
    );
  }

  const userEmail = user?.email || 'Guest User';
  const hasActiveSubscription = user?.has_active_subscription;
  const trialTaken = user?.trial_taken;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Welcome, {userEmail}!</h1>

      {isGuestMode && (
        <Card className="border-blue-500 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-blue-700">Guest Mode Active</CardTitle>
            <CardDescription className="text-blue-600">
              You are currently browsing as a guest. Some features are limited.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-blue-800">
              <Link to="/user/subscriptions" className="font-semibold underline">Sign up and subscribe</Link> to unlock full access, track your progress, and personalize your learning experience.
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-700">
            This is your personal space. Here you can find your quiz progress, profile settings, and more.
          </p>
          <p className="mt-4 text-gray-700">
            Use the sidebar to navigate.
          </p>
        </CardContent>
      </Card>

      {/* Subscription Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Subscription Status</CardTitle>
          <CardDescription>Your current access level to premium content.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isGuestMode ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-blue-600 font-semibold">
                <AlertCircle className="h-5 w-5" />
                <span>Trial Mode (Guest)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                You can take a limited number of trial quizzes. <Link to="/user/subscriptions" className="font-semibold underline">Sign up and subscribe</Link> for full access.
              </p>
              <Link to="/user/subscriptions">
                <Button className="mt-2">View Subscription Plans</Button>
              </Link>
            </div>
          ) : hasActiveSubscription ? (
            <div className="flex items-center gap-2 text-green-600 font-semibold">
              <CheckCircle2 className="h-5 w-5" />
              <span>You have an active subscription!</span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-600 font-semibold">
                <AlertCircle className="h-5 w-5" />
                <span>No active subscription.</span>
              </div>
              {trialTaken ? (
                <p className="text-sm text-muted-foreground">
                  You have already taken your free trial. Please subscribe to unlock all features.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You are eligible for a free trial! Start a quiz to begin your trial.
                </p>
              )}
              <Link to="/user/subscriptions">
                <Button className="mt-2">View Subscription Plans</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions Card */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Jump right into your learning journey.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          <Link to="/quiz">
            <Button>Take a Quiz</Button>
          </Link>
          <Link to="/user/take-test">
            <Button disabled={isGuestMode || !hasActiveSubscription} variant="secondary">
              Take a Test
            </Button>
          </Link>
          {!hasActiveSubscription && !isGuestMode && (
            <Link to="/user/subscriptions">
              <Button variant="outline">Subscribe Now</Button>
            </Link>
          )}
          {isGuestMode && (
            <Link to="/user/subscriptions">
              <Button variant="outline">Sign Up & Subscribe</Button>
            </Link>
          )}
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

      {/* Areas for Improvement Card */}
      <Card>
        <CardHeader>
          <CardTitle>Areas for Improvement</CardTitle>
          <CardDescription>Based on your quiz performance, these areas might need more practice.</CardDescription>
        </CardHeader>
        <CardContent>
          {isGuestMode ? (
            <p className="text-center text-gray-600">
              <Link to="/user/subscriptions" className="font-semibold underline">Sign up</Link> to track your performance and get personalized recommendations here!
            </p>
          ) : areasForImprovement.length > 0 ? (
            <div className="space-y-3">
              {areasForImprovement.map((area) => (
                <div key={area.id} className="flex items-center justify-between p-2 border rounded-md">
                  <p className="font-medium">{area.name} ({area.type === 'category' ? 'Category' : 'Subcategory'})</p>
                  <Badge variant={area.accuracy < 50 ? "destructive" : "secondary"}>
                    Accuracy: {area.accuracy.toFixed(2)}%
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600">
              Keep taking quizzes to get personalized recommendations here!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Suggested Practice Card */}
      <Card>
        <CardHeader>
          <CardTitle>Suggested Practice</CardTitle>
          <CardDescription>Explore new topics or revisit areas with fewer attempts.</CardDescription>
        </CardHeader>
        <CardContent>
          {isGuestMode ? (
            <p className="text-center text-gray-600">
              <Link to="/user/subscriptions" className="font-semibold underline">Sign up</Link> to get personalized practice suggestions here!
            </p>
          ) : suggestedPractice.length > 0 ? (
            <div className="space-y-3">
              {suggestedPractice.map((suggestion) => (
                <div key={suggestion.id} className="flex items-center justify-between p-2 border rounded-md">
                  <p className="font-medium">{suggestion.name} ({suggestion.type === 'category' ? 'Category' : 'Subcategory'})</p>
                  <Link to="/quiz">
                    <Button variant="outline" size="sm">Practice</Button>
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600">
              No specific suggestions at the moment. Keep up the great work!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent Quiz Activity Card */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Quiz Activity</CardTitle>
          <CardDescription>Your last 5 quiz attempts.</CardDescription>
        </CardHeader>
        <CardContent>
          {isGuestMode ? (
            <p className="text-center text-gray-600">
              <Link to="/user/subscriptions" className="font-semibold underline">Sign up</Link> to see your quiz activity here!
            </p>
          ) : recentAttempts.length > 0 ? (
            <div className="space-y-4">
              {recentAttempts.map((attempt) => (
                <div key={attempt.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  <p className="font-semibold text-gray-900 line-clamp-2">
                    Q: {attempt.question_text}
                  </p>
                  <p className="text-sm text-gray-700 mt-1">
                    Your Answer: {attempt.selected_option}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={attempt.is_correct ? "default" : "destructive"}>
                      {attempt.is_correct ? "Correct" : "Incorrect"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(attempt.attempt_timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-600">
              No recent quiz attempts found. Start a quiz to see your activity here!
            </p>
          )}
        </CardContent>
      </Card>

      <MadeWithDyad />
    </div>
  );
};

export default UserDashboardPage;