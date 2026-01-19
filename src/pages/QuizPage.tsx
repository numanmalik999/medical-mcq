"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { useSession } from '@/components/SessionContextProvider';
import { AlertCircle, CheckCircle2, RotateCcw, Save, Bookmark, BookmarkCheck, ArrowLeft, WifiOff, Info, Search, Lock, ArrowRight, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import QuizNavigator from '@/components/QuizNavigator';
import { MCQ } from '@/components/mcq-columns';
import { cn } from '@/lib/utils';
import { useBookmark } from '@/hooks/use-bookmark';
import useOfflineMcqs from '@/hooks/useOfflineMcqs';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import LoadingBar from '@/components/LoadingBar';
import { Badge } from '@/components/ui/badge';

interface MCQExplanation {
  id: string;
  explanation_text: string;
  image_url: string | null;
}

interface CategoryStat {
  id: string;
  name: string;
  description: string | null;
  total_mcqs: number;
  total_trial_mcqs: number;
  user_attempts: number;
  user_correct: number;
  user_incorrect: number;
  user_accuracy: string;
  offline_count: number;
}

interface UserAnswerData {
  selectedOption: string | null;
  isCorrect: boolean | null;
  submitted: boolean;
}

interface DbQuizSession {
  id: string;
  user_id: string;
  category_id: string | null;
  mcq_ids_order: string[];
  current_question_index: number;
  user_answers_json: { [mcqId: string]: UserAnswerData };
  is_trial_session: boolean;
  created_at: string;
  updated_at: string;
}

interface LoadedQuizSession {
  dbSessionId: string;
  categoryId: string | null;
  mcqs: MCQ[];
  userAnswers: Map<string, UserAnswerData>;
  currentQuestionIndex: number;
  isTrialActiveSession: boolean;
  userId: string;
  categoryName: string;
  isOffline: boolean;
}

const TRIAL_MCQ_LIMIT = 50;
const ALL_TRIAL_MCQS_ID = 'all-trial-mcqs-virtual-id';
const UNCATEGORIZED_ID = 'uncategorized-mcqs-virtual-id';

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

const QuizPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const { isNative, isDbInitialized, getOfflineCategoryCounts, getOfflineMcqIdsByCategory, getOfflineMcqs } = useOfflineMcqs();

  const [quizQuestions, setQuizQuestions] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, UserAnswerData>>(new Map());
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [currentQuizCategoryId, setCurrentQuizCategoryId] = useState<string | null>(null); // Restored
  const [currentDbSessionId, setCurrentDbSessionId] = useState<string | null>(null);
  const [showCategorySelection, setShowCategorySelection] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());

  const [isTrialActiveSession, setIsTrialActiveSession] = useState(false);
  const [isOfflineQuiz, setIsOfflineQuiz] = useState(false);

  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const [activeSavedQuizzes, setActiveSavedQuizzes] = useState<LoadedQuizSession[]>([]);
  const [currentCorrectnessPercentage, setCurrentCorrectnessPercentage] = useState('0.00%');
  
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);

  const currentMcq = quizQuestions[currentQuestionIndex];
  const { isBookmarked, toggleBookmark, isLoading: isBookmarkLoading } = useBookmark(currentMcq?.id || null);
  const isGuest = !user;

  useEffect(() => {
    if (!showCategorySelection) {
      window.scrollTo(0, 0);
    }
  }, [currentQuestionIndex, showCategorySelection]);

  useEffect(() => {
    if (quizQuestions.length > 0) {
      let correct = 0;
      let answered = 0;
      quizQuestions.forEach(mcq => {
        const answerData = userAnswers.get(mcq.id);
        if (answerData?.submitted) {
          answered++;
          if (answerData.isCorrect) {
            correct++;
          }
        }
      });
      const percentage = answered > 0 ? ((correct / answered) * 100).toFixed(2) : '0.00';
      setCurrentCorrectnessPercentage(`${percentage}%`);
    } else {
      setCurrentCorrectnessPercentage('0.00%');
    }
  }, [userAnswers, quizQuestions]);

  const fetchExplanation = useCallback(async (explanationId: string): Promise<MCQExplanation | null> => {
    if (!currentMcq) return null;
    const mcqId = currentMcq.id;

    if (isOfflineQuiz) {
      if (currentMcq && (currentMcq as any).explanation_text) {
        const localExplanation: MCQExplanation = {
          id: mcqId,
          explanation_text: (currentMcq as any).explanation_text,
          image_url: (currentMcq as any).image_url || null,
        };
        setExplanations(prev => new Map(prev).set(mcqId, localExplanation));
        return localExplanation;
      }
      return null;
    }

    if (explanations.has(mcqId)) {
      return explanations.get(mcqId)!;
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
    } else if (data) {
      const formattedExplanation = { ...data, id: mcqId };
      setExplanations(prev => new Map(prev).set(mcqId, formattedExplanation));
      return formattedExplanation;
    }
    return null;
  }, [explanations, toast, isOfflineQuiz, currentMcq]);

  const saveQuizState = useCallback(async (
    dbSessionId: string | null,
    categoryId: string | null,
    mcqs: MCQ[],
    answers: Map<string, UserAnswerData>,
    index: number,
    isTrial: boolean,
    currentUserId: string,
    isOffline: boolean
  ): Promise<{ id: string; sessionData: DbQuizSession } | null> => {
    if (!currentUserId || isOffline) return null;

    const sessionData = {
      user_id: currentUserId,
      category_id: categoryId,
      mcq_ids_order: mcqs.map(m => m.id),
      user_answers_json: Object.fromEntries(answers),
      current_question_index: index,
      is_trial_session: isTrial,
    };

    try {
      if (dbSessionId) {
        const { data, error } = await supabase
          .from('user_quiz_sessions')
          .update({ ...sessionData, updated_at: new Date().toISOString() })
          .eq('id', dbSessionId)
          .select('id')
          .single();
        if (error) throw error;
        return { id: data.id, sessionData: { ...sessionData, id: data.id, created_at: '', updated_at: new Date().toISOString() } as DbQuizSession };
      } else {
        const { data, error } = await supabase
          .from('user_quiz_sessions')
          .insert(sessionData)
          .select('id, created_at, updated_at')
          .single();
        if (error) throw error;
        setCurrentDbSessionId(data.id);
        return { id: data.id, sessionData: { ...sessionData, id: data.id, created_at: data.created_at, updated_at: data.updated_at } as DbQuizSession };
      }
    } catch (error: any) {
      console.error("Error saving quiz state:", error);
      return null;
    }
  }, [toast]);

  const clearSpecificQuizState = useCallback(async (dbSessionId: string) => {
    try {
      const { error } = await supabase.from('user_quiz_sessions').delete().eq('id', dbSessionId);
      if (error) throw error;
      setActiveSavedQuizzes(prev => prev.filter(session => session.dbSessionId !== dbSessionId));
    } catch (error: any) {
      console.error("Error clearing quiz state:", error);
    }
  }, []);

  const fetchQuizOverview = async () => {
    setIsPageLoading(true);

    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name, description');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      setIsPageLoading(false);
      return;
    }
    const categoriesMap = new Map(categoriesData?.map(cat => [cat.id, cat]) || []);
    categoriesMap.set(UNCATEGORIZED_ID, { id: UNCATEGORIZED_ID, name: 'Uncategorized', description: 'Questions that have not yet been assigned to a specific specialty category.' });

    const limit = 1000;
    let allMcqCategoryLinks: { category_id: string; mcq_id: string }[] = [];
    let offset = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const { data: chunkData } = await supabase.from('mcq_category_links').select('category_id, mcq_id').range(offset, offset + limit - 1);
        if (chunkData && chunkData.length > 0) {
          allMcqCategoryLinks = allMcqCategoryLinks.concat(chunkData);
          offset += chunkData.length;
          hasMore = chunkData.length === limit;
        } else {
          hasMore = false;
        }
      }
    } catch (e) { console.error(e); }
    
    const uniqueLinkedMcqIds = Array.from(new Set(allMcqCategoryLinks.map(link => link.mcq_id)));
    let mcqTrialStatusMap = new Map<string, boolean>();
    const chunkSize = 500;
    for (let i = 0; i < uniqueLinkedMcqIds.length; i += chunkSize) {
        const chunk = uniqueLinkedMcqIds.slice(i, i + chunkSize);
        const { data } = await supabase.from('mcqs').select('id, is_trial_mcq').in('id', chunk);
        data?.forEach(mcq => mcqTrialStatusMap.set(mcq.id, mcq.is_trial_mcq || false));
    }

    const categoryMcqCounts = new Map<string, { total: number; trial: number }>();
    allMcqCategoryLinks.forEach(link => {
      if (!categoryMcqCounts.has(link.category_id)) categoryMcqCounts.set(link.category_id, { total: 0, trial: 0 });
      const counts = categoryMcqCounts.get(link.category_id)!;
      counts.total++;
      if (mcqTrialStatusMap.get(link.mcq_id)) counts.trial++;
    });

    const { count: totalMcqCount } = await supabase.from('mcqs').select('id', { count: 'exact', head: true });
    const uncategorizedTotal = (totalMcqCount || 0) - uniqueLinkedMcqIds.length;
    let uncategorizedTrial = 0;
    if (uncategorizedTotal > 0) {
      let trialQuery = supabase.from('mcqs').select('id', { count: 'exact', head: true }).eq('is_trial_mcq', true);
      if (uniqueLinkedMcqIds.length > 0) trialQuery = trialQuery.not('id', 'in', `(${Array.from(uniqueLinkedMcqIds).join(',')})`);
      const { count } = await trialQuery;
      uncategorizedTrial = count || 0;
      categoryMcqCounts.set(UNCATEGORIZED_ID, { total: uncategorizedTotal, trial: uncategorizedTrial });
    }

    let userAttemptsData: any[] = [];
    if (user) {
      const { data } = await supabase.from('user_quiz_attempts').select('is_correct, category_id').eq('user_id', user.id);
      userAttemptsData = data || [];
    }

    const categoriesWithStats: CategoryStat[] = [];
    const categoryUserAttempts = new Map<string, { total: number; correct: number }>();
    userAttemptsData.forEach(attempt => {
      if (attempt.category_id) {
        if (!categoryUserAttempts.has(attempt.category_id)) categoryUserAttempts.set(attempt.category_id, { total: 0, correct: 0 });
        const attempts = categoryUserAttempts.get(attempt.category_id)!;
        attempts.total++;
        if (attempt.is_correct) attempts.correct++;
      }
    });

    let offlineCounts = new Map<string, number>();
    if (isNative && isDbInitialized) offlineCounts = await getOfflineCategoryCounts();

    categoriesData?.forEach(category => {
      const mcqCounts = categoryMcqCounts.get(category.id) || { total: 0, trial: 0 };
      const userAttempts = categoryUserAttempts.get(category.id) || { total: 0, correct: 0 };
      const accuracy = userAttempts.total > 0 ? ((userAttempts.correct / userAttempts.total) * 100).toFixed(2) : '0.00';
      categoriesWithStats.push({
        ...category,
        total_mcqs: mcqCounts.total,
        total_trial_mcqs: mcqCounts.trial,
        user_attempts: userAttempts.total,
        user_correct: userAttempts.correct,
        user_incorrect: userAttempts.total - userAttempts.correct,
        user_accuracy: `${accuracy}%`,
        offline_count: offlineCounts.get(category.id) || 0,
      });
    });

    const uncategorizedStats = categoryMcqCounts.get(UNCATEGORIZED_ID);
    if (uncategorizedStats && uncategorizedStats.total > 0) {
      const userAtt = categoryUserAttempts.get(UNCATEGORIZED_ID) || { total: 0, correct: 0 };
      const acc = userAtt.total > 0 ? ((userAtt.correct / userAtt.total) * 100).toFixed(2) : '0.00';
      categoriesWithStats.push({
        id: UNCATEGORIZED_ID,
        name: 'Uncategorized',
        description: 'Questions that have not yet been assigned to a specific specialty category.',
        total_mcqs: uncategorizedStats.total,
        total_trial_mcqs: uncategorizedStats.trial,
        user_attempts: userAtt.total,
        user_correct: userAtt.correct,
        user_incorrect: userAtt.total - userAtt.correct,
        user_accuracy: `${acc}%`,
        offline_count: offlineCounts.get(UNCATEGORIZED_ID) || 0,
      });
    }

    if (user) {
      const { data: dbSessions } = await supabase.from('user_quiz_sessions').select('*').eq('user_id', user.id).is('test_duration_seconds', null).order('updated_at', { ascending: false });
      if (dbSessions) {
        setActiveSavedQuizzes(dbSessions.map((dbSession: DbQuizSession) => ({
          dbSessionId: dbSession.id,
          categoryId: dbSession.category_id,
          mcqs: dbSession.mcq_ids_order.map(id => ({ id, question_text: 'Loading...', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', explanation_id: null, difficulty: null, is_trial_mcq: null, category_links: [] })),
          userAnswers: new Map(Object.entries(dbSession.user_answers_json)),
          currentQuestionIndex: dbSession.current_question_index,
          isTrialActiveSession: dbSession.is_trial_session,
          userId: user.id,
          categoryName: dbSession.category_id === ALL_TRIAL_MCQS_ID ? 'All Trial MCQs' : dbSession.category_id === UNCATEGORIZED_ID ? 'Uncategorized' : categoriesMap.get(dbSession.category_id || '')?.name || 'Unknown',
          isOffline: false,
        } as LoadedQuizSession)));
      }
    }

    setCategoryStats(categoriesWithStats);
    setIsPageLoading(false);
  };

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchQuizOverview();
    }
  }, [user, hasCheckedInitialSession, isDbInitialized]);

  const startQuizSession = async (selectedCategoryId: string | null, mode: 'random' | 'incorrect', isOffline: boolean) => {
    setIsOfflineQuiz(isOffline);
    const isSubscribed = user?.has_active_subscription;
    const isGuest = !user;

    let sessionIsTrial = selectedCategoryId === ALL_TRIAL_MCQS_ID || isGuest || !isSubscribed;
    
    if (sessionIsTrial && mode === 'incorrect') {
      toast({ title: "Feature Restricted", description: "This feature is only available for subscribed users.", variant: "default" });
      return;
    }

    setIsPageLoading(true);
    let mcqIdsToConsider: string[] = [];
    let mcqsToLoad: MCQ[] = [];

    if (isOffline) {
      mcqIdsToConsider = await getOfflineMcqIdsByCategory(selectedCategoryId!);
      mcqsToLoad = await getOfflineMcqs(shuffleArray(mcqIdsToConsider));
    } else {
      let baseMcqQuery = supabase.from('mcqs').select('id, is_trial_mcq');
      if (selectedCategoryId === ALL_TRIAL_MCQS_ID) baseMcqQuery = baseMcqQuery.eq('is_trial_mcq', true);
      else if (selectedCategoryId === UNCATEGORIZED_ID) {
        const { data: links } = await supabase.from('mcq_category_links').select('mcq_id');
        const categorized = Array.from(new Set(links?.map(l => l.mcq_id) || []));
        if (categorized.length > 0) baseMcqQuery = baseMcqQuery.not('id', 'in', `(${categorized.join(',')})`);
      } else if (selectedCategoryId) {
        const { data: links } = await supabase.from('mcq_category_links').select('mcq_id').eq('category_id', selectedCategoryId);
        baseMcqQuery = baseMcqQuery.in('id', Array.from(new Set(links?.map(l => l.mcq_id) || [])));
      }
      if (sessionIsTrial && selectedCategoryId !== ALL_TRIAL_MCQS_ID) baseMcqQuery = baseMcqQuery.eq('is_trial_mcq', true);
      const { data } = await baseMcqQuery;
      mcqIdsToConsider = data?.map(m => m.id) || [];

      if (mode === 'incorrect' && user && isSubscribed) {
        const { data: attempts } = await supabase.from('user_quiz_attempts').select('mcq_id').eq('user_id', user.id).in('mcq_id', mcqIdsToConsider).eq('is_correct', false);
        mcqIdsToConsider = Array.from(new Set(attempts?.map(a => a.mcq_id) || []));
      }

      let finalIds = shuffleArray(mcqIdsToConsider);
      if (sessionIsTrial && selectedCategoryId !== ALL_TRIAL_MCQS_ID) finalIds = finalIds.slice(0, TRIAL_MCQ_LIMIT);

      const { data: mcqs } = await supabase.from('mcqs').select('*, mcq_category_links(category_id, categories(name))').in('id', finalIds);
      mcqsToLoad = finalIds.map(id => {
        const m = (mcqs || []).find(x => x.id === id);
        return { ...m, category_links: m.mcq_category_links.map((l: any) => ({ category_id: l.category_id, category_name: l.categories?.name })) };
      }).filter((m): m is MCQ => !!m);
    }

    if (mcqsToLoad.length === 0) {
      toast({ title: "No MCQs", description: "No questions available." });
      setIsPageLoading(false);
      return;
    }

    setQuizQuestions(mcqsToLoad);
    setShowCategorySelection(false);
    setIsPageLoading(false);
    
    const initialAnswers = new Map<string, UserAnswerData>();
    mcqsToLoad.forEach(m => initialAnswers.set(m.id, { selectedOption: null, isCorrect: null, submitted: false }));
    setUserAnswers(initialAnswers);
    setSelectedAnswer(null);

    if (user && !isOffline) {
      await saveQuizState(null, selectedCategoryId, mcqsToLoad, initialAnswers, 0, sessionIsTrial, user.id, false);
    }
    setIsTrialActiveSession(sessionIsTrial);
    setCurrentQuizCategoryId(selectedCategoryId); // Restored
  };

  const continueQuizSession = useCallback(async (loadedSession: LoadedQuizSession) => {
    setIsPageLoading(true);
    setCurrentDbSessionId(loadedSession.dbSessionId);
    setCurrentQuizCategoryId(loadedSession.categoryId); // Restored
    setIsTrialActiveSession(loadedSession.isTrialActiveSession);
    setIsOfflineQuiz(loadedSession.isOffline);

    let mcqsData: MCQ[] = [];
    if (loadedSession.isOffline) {
        mcqsData = await getOfflineMcqs(loadedSession.mcqs.map(m => m.id));
    } else {
        const { data } = await supabase.from('mcqs').select('*, mcq_category_links(category_id, categories(name))').in('id', loadedSession.mcqs.map(m => m.id));
        mcqsData = (data || []).map((m: any) => ({ ...m, category_links: m.mcq_category_links.map((l: any) => ({ category_id: l.category_id, category_name: l.categories?.name })) }));
    }

    mcqsData = loadedSession.mcqs.map(l => mcqsData.find(f => f.id === l.id)).filter((m): m is MCQ => !!m);
    setQuizQuestions(mcqsData);
    setUserAnswers(loadedSession.userAnswers);
    setCurrentQuestionIndex(loadedSession.currentQuestionIndex);

    const cur = mcqsData[loadedSession.currentQuestionIndex];
    const ans = loadedSession.userAnswers.get(cur.id);
    setSelectedAnswer(ans?.selectedOption || null);
    setFeedback(ans?.submitted ? (ans.isCorrect ? 'Correct!' : `Incorrect. Correct: ${cur.correct_answer}.`) : null);
    setShowExplanation(ans?.submitted || false);
    if (ans?.submitted && cur.explanation_id) fetchExplanation(cur.explanation_id);

    setShowCategorySelection(false);
    setIsPageLoading(false);
  }, [fetchExplanation, getOfflineMcqs]);

  const handleResetProgress = async (categoryId: string) => {
    if (!user) return;
    if (!window.confirm("Reset all progress for this category?")) return;
    setIsPageLoading(true);
    try {
        await supabase.from('user_quiz_attempts').delete().eq('user_id', user.id).eq('category_id', categoryId);
        await supabase.from('user_quiz_sessions').delete().eq('user_id', user.id).eq('category_id', categoryId);
        fetchQuizOverview();
    } catch (e: any) {
        toast({ title: "Reset Failed", description: e.message, variant: "destructive" });
        setIsPageLoading(false);
    }
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < quizQuestions.length) {
      setCurrentQuestionIndex(index);
      const ans = userAnswers.get(quizQuestions[index].id);
      setSelectedAnswer(ans?.selectedOption || null);
      setFeedback(ans?.submitted ? (ans.isCorrect ? 'Correct!' : `Incorrect. Correct: ${quizQuestions[index].correct_answer}.`) : null);
      setShowExplanation(ans?.submitted || false);
      if (ans?.submitted && quizQuestions[index].explanation_id) {
          fetchExplanation(quizQuestions[index].explanation_id!);
      }
    }
  };

  const handleNextQuestion = () => {
    if (isTrialActiveSession && currentQuestionIndex + 1 >= TRIAL_MCQ_LIMIT) {
      submitFullQuiz();
      return;
    }
    if (currentQuestionIndex < quizQuestions.length - 1) {
      goToQuestion(currentQuestionIndex + 1);
    } else {
      submitFullQuiz();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      goToQuestion(currentQuestionIndex - 1);
    }
  };

  const handleOptionSelect = useCallback((value: string) => {
    if (currentMcq) {
      setSelectedAnswer(value);
      setUserAnswers(prev => new Map(prev).set(currentMcq.id, { selectedOption: value, isCorrect: null, submitted: false }));
      setFeedback(null);
      setShowExplanation(false);
    }
  }, [currentMcq]);

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentMcq) return;
    const isCorrect = selectedAnswer === currentMcq.correct_answer;
    setFeedback(isCorrect ? 'Correct!' : `Incorrect. Correct: ${currentMcq.correct_answer}.`);
    setShowExplanation(true);
    setUserAnswers(prev => new Map(prev).set(currentMcq.id, { selectedOption: selectedAnswer, isCorrect, submitted: true }));

    if (user && !isOfflineQuiz) {
      await supabase.from('user_quiz_attempts').insert({ user_id: user.id, mcq_id: currentMcq.id, category_id: currentMcq.category_links?.[0]?.category_id || null, selected_option: selectedAnswer, is_correct: isCorrect });
    }
    if (currentMcq.explanation_id) fetchExplanation(currentMcq.explanation_id);
  };

  const handleSaveProgress = async () => {
    if (!user) return;
    const res = await saveQuizState(currentDbSessionId, currentQuizCategoryId, quizQuestions, userAnswers, currentQuestionIndex, isTrialActiveSession, user.id, isOfflineQuiz);
    if (res) toast({ title: "Progress Saved" });
  };

  const handleBackToSelection = () => {
    setShowCategorySelection(true);
    setQuizQuestions([]);
    setCurrentQuestionIndex(0);
    setUserAnswers(new Map());
    fetchQuizOverview();
  };

  const handleSubmitFeedback = async () => {
    if (!user || !currentMcq || !feedbackText.trim()) return;
    setIsSubmittingFeedback(true);
    try {
        const { error } = await supabase.from('mcq_feedback').insert({ user_id: user.id, mcq_id: currentMcq.id, feedback_text: feedbackText, status: 'pending' });
        if (error) throw error;
        toast({ title: "Feedback Submitted", description: "Thank you for your clinical input." });
        setFeedbackText('');
        setIsFeedbackDialogOpen(false);
    } catch (e: any) {
        toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
        setIsSubmittingFeedback(false);
    }
  };

  const submitFullQuiz = async () => {
    let count = 0;
    quizQuestions.forEach(m => { if (userAnswers.get(m.id)?.isCorrect) count++; });
    setScore(count);
    setShowResults(true);
    if (currentDbSessionId && !isOfflineQuiz) clearSpecificQuizState(currentDbSessionId);
  };

  const filteredCategories = categoryStats.filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!hasCheckedInitialSession || isPageLoading) return <LoadingBar />;

  if (showResults) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-20">
        <Card className="w-full max-w-2xl text-center">
            <CardHeader><CardTitle className="text-3xl font-bold">Quiz Complete!</CardTitle></CardHeader>
            <CardContent className="space-y-6">
                <div className="text-6xl font-extrabold text-primary">{score} / {quizQuestions.length}</div>
                <p className="text-muted-foreground">Accuracy: {((score / quizQuestions.length) * 100).toFixed(2)}%</p>
                <div className="flex justify-center gap-4">
                    <Button onClick={handleBackToSelection} variant="outline">Exit to Dashboard</Button>
                    <Button onClick={() => window.location.reload()}>Try Another</Button>
                </div>
            </CardContent>
        </Card>
      </div>
    );
  }

  if (showCategorySelection) {
    return (
      <div className="min-h-screen bg-background p-4 pt-16">
        <Card className="w-full max-w-6xl mx-auto shadow-xl border-none">
          <CardHeader className="text-center pb-8 border-b">
            <CardTitle className="text-4xl font-extrabold text-foreground">Select a Practice Specialty</CardTitle>
            <CardDescription className="text-lg mt-2">Access high-yield MCQs mapped to current Gulf licensing blueprints.</CardDescription>
          </CardHeader>
          <CardContent className="pt-8 space-y-8">
            {activeSavedQuizzes.length > 0 && !isGuest && (
              <div className="p-6 rounded-2xl border border-border">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-4 text-foreground"><RotateCcw className="h-5 w-5 text-primary" /> Continue Recent Practice</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeSavedQuizzes.map((s) => (
                    <div key={s.dbSessionId} className="bg-primary p-4 rounded-xl border border-primary flex justify-between items-center shadow-md">
                      <div>
                        <p className="font-bold text-white">{s.categoryName}</p>
                        <p className="text-xs text-primary-foreground/80">Progress: {s.currentQuestionIndex + 1} / {s.mcqs.length}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => continueQuizSession(s)} size="sm" variant="secondary" className="rounded-full">Resume</Button>
                        <Button onClick={() => clearSpecificQuizState(s.dbSessionId)} size="sm" variant="ghost" className="text-white hover:bg-white/10 rounded-full"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="relative">
               <Input placeholder="Search for a medical specialty..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-14 pl-12 rounded-2xl shadow-sm text-lg" />
               <Search className="absolute left-4 top-4 text-muted-foreground" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCategories.map((cat) => (
                <Card key={cat.id} className="flex flex-col hover:shadow-lg transition-all border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start mb-2">
                        <CardTitle className="text-xl font-bold text-foreground">{cat.name}</CardTitle>
                        <Badge variant="outline" className="font-bold">{cat.total_mcqs} MCQs</Badge>
                    </div>
                    <CardDescription className="text-sm line-clamp-3 min-h-[4.5rem] text-foreground/80 leading-relaxed italic">
                        {cat.description || 'Comprehensive prep material for this medical specialty.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow pt-6 space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        <span>Accuracy: <span className="text-foreground font-bold">{cat.user_accuracy}</span></span>
                        <span>Attempts: <span className="text-foreground font-bold">{cat.user_attempts}</span></span>
                    </div>
                    {!user?.has_active_subscription && cat.total_trial_mcqs < cat.total_mcqs && (
                        <div className="flex items-center gap-1.5 text-xs text-orange-600 font-bold bg-orange-50 dark:bg-orange-950/20 p-2 rounded-lg">
                            <Lock className="h-3 w-3" />
                            <span>{cat.total_mcqs - cat.total_trial_mcqs} premium questions locked</span>
                        </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex flex-col gap-2 p-4 pt-0">
                    <Button onClick={() => startQuizSession(cat.id, 'random', false)} className="w-full rounded-xl font-bold">Practice Now</Button>
                    <div className="grid grid-cols-2 gap-2 w-full">
                         <Button variant="outline" size="sm" className="rounded-xl text-[10px]" disabled={cat.user_incorrect === 0} onClick={() => startQuizSession(cat.id, 'incorrect', false)}>Review Mistakes ({cat.user_incorrect})</Button>
                         <Button variant="ghost" size="sm" className="rounded-xl text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleResetProgress(cat.id)}>Reset Statistics</Button>
                    </div>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  const ansData = userAnswers.get(currentMcq.id);
  const isSelected = ansData?.selectedOption !== null;
  const isSub = ansData?.submitted;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
      <div className="w-full max-w-6xl mb-4">
        <Card className="p-4 flex flex-col sm:flex-row justify-between items-center gap-4 bg-primary border-none shadow-md">
          <p className="font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" /> Live Session Accuracy: {currentCorrectnessPercentage}
          </p>
          <div className="flex gap-2">
             <Button variant="outline" size="sm" className="text-white border-white hover:bg-white/10" onClick={handleSaveProgress} disabled={isOfflineQuiz}><Save className="h-4 w-4 mr-2" /> Save Progress</Button>
             <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={handleBackToSelection}><ArrowLeft className="h-4 w-4 mr-2" /> Exit Quiz</Button>
          </div>
        </Card>
      </div>
      <div className="flex flex-col md:flex-row w-full max-w-6xl gap-6">
        <Card className="flex-1 border-none shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="border-b flex flex-row items-center justify-between py-6">
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold">Question {currentQuestionIndex + 1} of {quizQuestions.length}</CardTitle>
              {isOfflineQuiz && <Badge variant="destructive" className="flex items-center gap-1"><WifiOff className="h-3 w-3" /> Offline Practice</Badge>}
            </div>
            {!isGuest && !isOfflineQuiz && (
              <Button variant="ghost" size="icon" onClick={toggleBookmark} disabled={isBookmarkLoading}>
                {isBookmarked ? <BookmarkCheck className="h-6 w-6 text-primary fill-current" /> : <Bookmark className="h-6 w-6 text-muted-foreground" />}
              </Button>
            )}
          </CardHeader>
          <CardContent className="pt-8">
            <div className="prose dark:prose-invert max-w-none text-xl font-medium leading-relaxed mb-8 text-foreground">
               <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{currentMcq.question_text}</ReactMarkdown>
            </div>
            <RadioGroup onValueChange={handleOptionSelect} value={selectedAnswer || ""} className="space-y-4" disabled={isSub}>
              {['A', 'B', 'C', 'D'].map((k) => {
                const optKey = `option_${k.toLowerCase()}` as keyof MCQ;
                const text = currentMcq[optKey] as string;
                const isCorrectOpt = currentMcq.correct_answer === k;
                const isSel = selectedAnswer === k;
                return (
                  <div key={k} className={cn("flex items-center space-x-3 p-4 rounded-xl border-2 transition-all cursor-pointer", 
                    isSub && isSel && isCorrectOpt && "border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
                    isSub && isSel && !isCorrectOpt && "border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300",
                    isSub && !isSel && isCorrectOpt && "border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300",
                    !isSub && isSel && "border-primary bg-primary/5 dark:bg-primary/10"
                  )} onClick={() => !isSub && handleOptionSelect(k)}>
                    <RadioGroupItem value={k} id={`opt-${k}`} />
                    <Label htmlFor={`opt-${k}`} className="cursor-pointer text-lg font-semibold flex-grow">
                      <span className="opacity-50 mr-2">{k}.</span> {text}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            {feedback && (
              <div className={cn("mt-8 p-6 rounded-2xl flex items-center gap-4 font-bold text-lg border animate-in fade-in zoom-in-95", 
                feedback.startsWith('Correct') 
                    ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-700 dark:text-green-200" 
                    : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950 dark:border-red-700 dark:text-red-200")}>
                {feedback.startsWith('Correct') ? <CheckCircle2 className="h-8 w-8" /> : <AlertCircle className="h-8 w-8" />}
                {feedback}
              </div>
            )}

            {showExplanation && (
              <div className="mt-8 p-8 bg-background rounded-2xl border-2 border-dashed border-border animate-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-foreground"><Info className="h-5 w-5 text-primary" /> Clinical AI Explanation</h3>
                <div className="prose dark:prose-invert max-w-none text-foreground/90 leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{explanations.get(currentMcq.id || '')?.explanation_text || "Analyzing clinical scenario..."}</ReactMarkdown>
                </div>
                {!isOfflineQuiz && (
                  <Button variant="link" className="mt-6 p-0 text-muted-foreground hover:text-primary transition-colors" onClick={() => setIsFeedbackDialogOpen(true)}>Report a clinical error or add note</Button>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t py-6 px-8 flex justify-between">
              <Button onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0} variant="outline" className="rounded-full h-12 px-6">Previous</Button>
              {!isSub ? (
                <Button onClick={handleSubmitAnswer} disabled={!isSelected} className="px-10 rounded-full font-bold h-12">Check Answer</Button>
              ) : (
                <Button onClick={handleNextQuestion} className="px-10 rounded-full font-bold h-12">Next Question <ArrowRight className="ml-2 h-4 w-4" /></Button>
              )}
          </CardFooter>
        </Card>
        <QuizNavigator mcqs={quizQuestions} userAnswers={userAnswers} currentQuestionIndex={currentQuestionIndex} goToQuestion={goToQuestion} showResults={false} score={0} />
      </div>
      <MadeWithDyad />

      <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
        <DialogContent className="rounded-2xl"><DialogHeader><DialogTitle>Clinical Feedback</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Your notes help our review board maintain the highest standard of accuracy.</p>
            <Textarea placeholder="e.g. Current ESC guidelines suggest..." value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} rows={6} className="rounded-xl" />
          </div>
          <DialogFooter><Button onClick={handleSubmitFeedback} disabled={isSubmittingFeedback || !feedbackText.trim()} className="w-full rounded-xl h-12 font-bold">Submit to Clinical Board</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default QuizPage;