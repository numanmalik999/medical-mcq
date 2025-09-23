"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge'; // Import Badge for correct/incorrect status
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

interface QuizPerformance {
  totalAttempts: number;
  correctAttempts: number;
  accuracy: string;
}

interface RecentAttempt {
  id: string;
  mcq_id: string;
  question_text: string; // From mcqs table
  selected_option: string;
  is_correct: boolean;
  attempt_timestamp: string;
}

interface Category {
  id: string;
  name: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

interface PerformanceSummary {
  id: string;
  name: string;
  type: 'category' | 'subcategory';
  totalAttempts: number;
  correctAttempts: number;
  accuracy: number; // Stored as a number for sorting
}

const UserDashboardPage = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const { toast } = useToast();
  const [quizPerformance, setQuizPerformance] = useState<QuizPerformance | null>(null);
  const [recentAttempts, setRecentAttempts] = useState<RecentAttempt[]>([]);
  const [isLoadingPerformance, setIsLoadingPerformance] = useState(true);
  const [isLoadingRecentAttempts, setIsLoadingRecentAttempts] = useState(true);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [allSubcategories, setAllSubcategories] = useState<Subcategory[]>([]);
  const [areasForImprovement, setAreasForImprovement] = useState<PerformanceSummary[]>([]);
  const [suggestedPractice, setSuggestedPractice] = useState<PerformanceSummary[]>([]);

  useEffect(() => {
    if (user && !isSessionLoading) {
      fetchQuizPerformance();
      fetchRecentAttempts();
      fetchAllCategoriesAndSubcategories();
    } else if (!user && !isSessionLoading) {
      setIsLoadingPerformance(false);
      setIsLoadingRecentAttempts(false);
      setIsLoadingRecommendations(false);
    }
  }, [user, isSessionLoading]);

  const fetchAllCategoriesAndSubcategories = async () => {
    setIsLoadingRecommendations(true);
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');
    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories for recommendations.", variant: "destructive" });
    } else {
      setAllCategories(categoriesData || []);
    }

    const { data: subcategoriesData, error: subcategoriesError } = await supabase
      .from('subcategories')
      .select('*');
    if (subcategoriesError) {
      console.error('Error fetching subcategories:', subcategoriesError);
      toast({ title: "Error", description: "Failed to load subcategories for recommendations.", variant: "destructive" });
    } else {
      setAllSubcategories(subcategoriesData || []);
    }
    setIsLoadingRecommendations(false);
  };

  const fetchQuizPerformance = async () => {
    if (!user) return;
    setIsLoadingPerformance(true);

    const { data: attemptsData, error: attemptsError } = await supabase
      .from('user_quiz_attempts')
      .select('is_correct, category_id, subcategory_id')
      .eq('user_id', user.id);

    if (attemptsError) {
      console.error('Error fetching quiz performance:', attemptsError);
      toast({ title: "Error", description: "Failed to load quiz performance.", variant: "destructive" });
      setQuizPerformance(null);
      setIsLoadingPerformance(false);
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

    // Process data for recommendations
    generateRecommendations(attemptsData);
    setIsLoadingPerformance(false);
  };

  const generateRecommendations = (attemptsData: any[]) => {
    const categoryPerformance: { [key: string]: { total: number; correct: number; name: string } } = {};
    const subcategoryPerformance: { [key: string]: { total: number; correct: number; name: string; categoryId: string } } = {};

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
      if (attempt.subcategory_id) {
        if (!subcategoryPerformance[attempt.subcategory_id]) {
          subcategoryPerformance[attempt.subcategory_id] = { total: 0, correct: 0, name: '', categoryId: attempt.category_id };
        }
        subcategoryPerformance[attempt.subcategory_id].total++;
        if (attempt.is_correct) {
          subcategoryPerformance[attempt.subcategory_id].correct++;
        }
      }
    });

    const performanceSummaries: PerformanceSummary[] = [];

    // Categories
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

    // Subcategories
    Object.keys(subcategoryPerformance).forEach(subcatId => {
      const subcat = allSubcategories.find(s => s.id === subcatId);
      if (subcat) {
        const perf = subcategoryPerformance[subcatId];
        const accuracy = perf.total > 0 ? (perf.correct / perf.total) * 100 : 0;
        performanceSummaries.push({
          id: subcatId,
          name: subcat.name,
          type: 'subcategory',
          totalAttempts: perf.total,
          correctAttempts: perf.correct,
          accuracy: accuracy,
        });
      }
    });

    // Sort by accuracy (lowest first) for areas for improvement
    const sortedByAccuracy = [...performanceSummaries].sort((a, b) => a.accuracy - b.accuracy);
    setAreasForImprovement(sortedByAccuracy.slice(0, 3)); // Top 3 lowest accuracy

    // Suggest practice in categories with fewer attempts or unattempted ones
    const attemptedCategoryIds = new Set(attemptsData.map(a => a.category_id).filter(Boolean));
    const unattemptedCategories = allCategories.filter(cat => !attemptedCategoryIds.has(cat.id));

    const suggested: PerformanceSummary[] = [];
    unattemptedCategories.slice(0, 2).forEach(cat => { // Suggest up to 2 unattempted categories
      suggested.push({
        id: cat.id,
        name: cat.name,
        type: 'category',
        totalAttempts: 0,
        correctAttempts: 0,
        accuracy: 0,
      });
    });

    // Also suggest categories with low attempts but not necessarily low accuracy
    const lowAttemptCategories = performanceSummaries
      .filter(p => p.type === 'category' && p.totalAttempts < 5 && p.accuracy > 50) // Example criteria
      .sort((a, b) => a.totalAttempts - b.totalAttempts)
      .slice(0, 2 - suggested.length); // Fill up to 2 if unattempted are less

    suggested.push(...lowAttemptCategories);
    setSuggestedPractice(suggested);
  };

  const fetchRecentAttempts = async () => {
    if (!user) return;
    setIsLoadingRecentAttempts(true);

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
      .limit(5); // Fetch last 5 attempts

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
    setIsLoadingRecentAttempts(false);
  };

  if (isSessionLoading || isLoadingPerformance || isLoadingRecentAttempts || isLoadingRecommendations) {
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

      {/* Areas for Improvement Card */}
      <Card>
        <CardHeader>
          <CardTitle>Areas for Improvement</CardTitle>
          <CardDescription>Based on your quiz performance, these areas might need more practice.</CardDescription>
        </CardHeader>
        <CardContent>
          {areasForImprovement.length > 0 ? (
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
            <p className="text-center text-gray-600 dark:text-gray-400">
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
          {suggestedPractice.length > 0 ? (
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
            <p className="text-center text-gray-600 dark:text-gray-400">
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
          {recentAttempts.length > 0 ? (
            <div className="space-y-4">
              {recentAttempts.map((attempt) => (
                <div key={attempt.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                  <p className="font-semibold text-gray-900 dark:text-white line-clamp-2">
                    Q: {attempt.question_text}
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
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
            <p className="text-center text-gray-600 dark:text-gray-400">
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