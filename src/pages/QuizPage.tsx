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
import { AlertCircle, CheckCircle2, MessageSquareText, Save, Bookmark, BookmarkCheck, ArrowLeft, WifiOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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


interface MCQExplanation {
  id: string;
  explanation_text: string;
  image_url: string | null;
}

interface CategoryStat {
  id: string;
  name: string;
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
  const navigate = useNavigate();
  const { isNative, isDbInitialized, getOfflineCategoryCounts, getOfflineMcqIdsByCategory, getOfflineMcqs } = useOfflineMcqs();

  const [quizQuestions, setQuizQuestions] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, UserAnswerData>>(new Map());
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);

  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [currentQuizCategoryId, setCurrentQuizCategoryId] = useState<string | null>(null);
  const [currentDbSessionId, setCurrentDbSessionId] = useState<string | null>(null);
  const [showCategorySelection, setShowCategorySelection] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());

  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [isTrialActiveSession, setIsTrialActiveSession] = useState(false);
  const [allTrialMcqsCount, setAllTrialMcqsCount] = useState(0);
  const [isOfflineQuiz, setIsOfflineQuiz] = useState(false);

  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const [activeSavedQuizzes, setActiveSavedQuizzes] = useState<LoadedQuizSession[]>([]);

  const [currentCorrectCount, setCurrentCorrectCount] = useState(0);
  const [currentCorrectnessPercentage, setCurrentCorrectnessPercentage] = useState('0.00%');

  const currentMcq = quizQuestions[currentQuestionIndex];
  const { isBookmarked, toggleBookmark, isLoading: isBookmarkLoading } = useBookmark(currentMcq?.id || null);
  const isGuest = !user;

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
      setCurrentCorrectCount(correct);
      const percentage = answered > 0 ? ((correct / answered) * 100).toFixed(2) : '0.00';
      setCurrentCorrectnessPercentage(`${percentage}%`);
    } else {
      setCurrentCorrectCount(0);
      setCurrentCorrectnessPercentage('0.00%');
    }
  }, [userAnswers, quizQuestions]);

  const fetchExplanation = useCallback(async (explanationId: string): Promise<MCQExplanation | null> => {
    if (isOfflineQuiz) {
      const localMcq = quizQuestions.find(q => q.id === explanationId);
      if (localMcq && (localMcq as any).explanation_text) {
        const localExplanation: MCQExplanation = {
          id: localMcq.id,
          explanation_text: (localMcq as any).explanation_text,
          image_url: (localMcq as any).image_url || null,
        };
        setExplanations(prev => new Map(prev).set(explanationId, localExplanation));
        return localExplanation;
      }
      return null;
    }

    if (explanations.has(explanationId)) {
      return explanations.get(explanationId)!;
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
      setExplanations(prev => new Map(prev).set(explanationId, data));
      return data;
    }
    return null;
  }, [explanations, toast, isOfflineQuiz, quizQuestions]);

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

    const mcqIdsOrder = mcqs.map(m => m.id);
    const userAnswersJson = Object.fromEntries(answers);

    const sessionData = {
      user_id: currentUserId,
      category_id: categoryId,
      mcq_ids_order: mcqIdsOrder,
      user_answers_json: userAnswersJson,
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
  }, []);

  const clearSpecificQuizState = useCallback(async (dbSessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_quiz_sessions')
        .delete()
        .eq('id', dbSessionId);

      if (error) throw error;
      setActiveSavedQuizzes(prev => prev.filter(session => session.dbSessionId !== dbSessionId));
    } catch (error: any) {
      console.error("Error clearing quiz state:", error);
    }
  }, []);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (!user) {
        setIsTrialActiveSession(true);
      } else {
        setIsTrialActiveSession(!user.has_active_subscription && !user.trial_taken);
      }
      fetchQuizOverview();
    }
  }, [user, hasCheckedInitialSession, isDbInitialized]);

  const fetchQuizOverview = async () => {
    setIsPageLoading(true);

    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      setIsPageLoading(false);
      return;
    }
    const categoriesMap = new Map(categoriesData?.map(cat => [cat.id, cat]) || []);

    const { count: totalTrialMcqsCount } = await supabase
      .from('mcqs')
      .select('id', { count: 'exact', head: true })
      .eq('is_trial_mcq', true);
    setAllTrialMcqsCount(totalTrialMcqsCount || 0);

    const limit = 1000;
    let allMcqCategoryLinks: { category_id: string; mcq_id: string }[] = [];
    let offset = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const { data: chunkData } = await supabase
          .from('mcq_category_links')
          .select('category_id, mcq_id')
          .range(offset, offset + limit - 1);

        if (chunkData && chunkData.length > 0) {
          allMcqCategoryLinks = allMcqCategoryLinks.concat(chunkData);
          offset += chunkData.length;
          hasMore = chunkData.length === limit;
        } else {
          hasMore = false;
        }
      }
    } catch (e) {
      console.error('Error fetching link data:', e);
    }
    
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
      const isTrialMcq = mcqTrialStatusMap.get(link.mcq_id) || false; 
      if (!categoryMcqCounts.has(link.category_id)) {
        categoryMcqCounts.set(link.category_id, { total: 0, trial: 0 });
      }
      const counts = categoryMcqCounts.get(link.category_id)!;
      counts.total++;
      if (isTrialMcq) counts.trial++;
    });

    const { count: totalMcqCount } = await supabase.from('mcqs').select('id', { count: 'exact', head: true });
    const uncategorizedTotal = (totalMcqCount || 0) - uniqueLinkedMcqIds.length;

    let uncategorizedTrial = 0;
    if (uncategorizedTotal > 0) {
      const { count } = await supabase.from('mcqs').select('id', { count: 'exact', head: true })
        .eq('is_trial_mcq', true)
        .not('id', 'in', `(${uniqueLinkedMcqIds.join(',')})`);
      uncategorizedTrial = count || 0;
      categoryMcqCounts.set(UNCATEGORIZED_ID, { total: uncategorizedTotal, trial: uncategorizedTrial });
    }

    let userAttemptsData: any[] = [];
    if (user) {
      const { data } = await supabase.from('user_quiz_attempts').select('is_correct, category_id').eq('user_id', user.id);
      userAttemptsData = data || [];
    }

    const categoryUserAttempts = new Map<string, { total: number; correct: number }>();
    userAttemptsData.forEach(attempt => {
      if (attempt.category_id) {
        if (!categoryUserAttempts.has(attempt.category_id)) {
          categoryUserAttempts.set(attempt.category_id, { total: 0, correct: 0 });
        }
        const a = categoryUserAttempts.get(attempt.category_id)!;
        a.total++;
        if (attempt.is_correct) a.correct++;
      }
    });

    let offlineCounts = new Map<string, number>();
    if (isNative && isDbInitialized) {
        offlineCounts = await getOfflineCategoryCounts();
    }

    const categoriesWithStats: CategoryStat[] = [];
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

    const uStats = categoryMcqCounts.get(UNCATEGORIZED_ID);
    if (uStats && uStats.total > 0) {
      const uAtt = categoryUserAttempts.get(UNCATEGORIZED_ID) || { total: 0, correct: 0 };
      const uAcc = uAtt.total > 0 ? ((uAtt.correct / uAtt.total) * 100).toFixed(2) : '0.00';
      categoriesWithStats.push({
        id: UNCATEGORIZED_ID, name: 'Uncategorized', total_mcqs: uStats.total, total_trial_mcqs: uStats.trial,
        user_attempts: uAtt.total, user_correct: uAtt.correct, user_incorrect: uAtt.total - uAtt.correct,
        user_accuracy: `${uAcc}%`, offline_count: offlineCounts.get(UNCATEGORIZED_ID) || 0,
      });
    }

    let loadedSavedQuizzes: LoadedQuizSession[] = [];
    if (user) {
      const { data: dbSessions } = await supabase.from('user_quiz_sessions').select('*').eq('user_id', user.id)
        .is('test_duration_seconds', null).order('updated_at', { ascending: false });

      loadedSavedQuizzes = (dbSessions || []).map((dbSession: DbQuizSession) => {
        const categoryName = dbSession.category_id === ALL_TRIAL_MCQS_ID ? 'All Trial MCQs' :
          dbSession.category_id === UNCATEGORIZED_ID ? 'Uncategorized' :
          categoriesMap.get(dbSession.category_id || '')?.name || 'Unknown Category';
        return {
          dbSessionId: dbSession.id, categoryId: dbSession.category_id,
          mcqs: dbSession.mcq_ids_order.map(id => ({ id } as MCQ)),
          userAnswers: new Map(Object.entries(dbSession.user_answers_json)),
          currentQuestionIndex: dbSession.current_question_index,
          isTrialActiveSession: dbSession.is_trial_session, userId: user.id,
          categoryName, isOffline: false,
        };
      });
    }
    setActiveSavedQuizzes(loadedSavedQuizzes);
    setCategoryStats(categoriesWithStats);
    setIsPageLoading(false);
  };

  const startQuizSession = async (selectedCategoryId: string | null, mode: 'random' | 'incorrect', isOffline: boolean) => {
    setIsOfflineQuiz(isOffline);
    const isSubscribed = user?.has_active_subscription;
    const hasTakenTrial = user?.trial_taken;
    
    let sessionIsTrial = false;
    if (selectedCategoryId === ALL_TRIAL_MCQS_ID) {
      sessionIsTrial = true;
    } else if (isGuest || (!isSubscribed && !hasTakenTrial)) {
      sessionIsTrial = true;
    }
    
    if (!isGuest && !isSubscribed && hasTakenTrial && !sessionIsTrial && !isOffline) {
      setShowSubscriptionPrompt(true);
      return;
    }

    if (sessionIsTrial && mode === 'incorrect') {
      toast({ title: "Premium Feature", description: "Incorrect-only mode is available with a subscription.", variant: "default" });
      return;
    }

    setIsPageLoading(true);
    setQuizQuestions([]);
    setUserAnswers(new Map());
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setFeedback(null);
    setShowExplanation(false);
    setScore(0);
    setExplanations(new Map());
    setShowResults(false);
    setCurrentDbSessionId(null);

    let mcqIdsToConsider: string[] = [];
    let mcqsToLoad: MCQ[] = [];

    if (isOffline) {
      if (!isNative || !isDbInitialized) {
        toast({ title: "Error", description: "Offline database not ready.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }
      mcqIdsToConsider = await getOfflineMcqIdsByCategory(selectedCategoryId || '');
      if (mcqIdsToConsider.length === 0) {
        toast({ title: "No MCQs", description: "No questions found offline for this category.", variant: "default" });
        setIsPageLoading(false);
        return;
      }
      const finalMcqIds = shuffleArray(mcqIdsToConsider);
      mcqsToLoad = await getOfflineMcqs(finalMcqIds);
    } else {
      let baseQuery = supabase.from('mcqs').select('id, is_trial_mcq');
      if (selectedCategoryId === ALL_TRIAL_MCQS_ID) {
        baseQuery = baseQuery.eq('is_trial_mcq', true);
      } else if (selectedCategoryId === UNCATEGORIZED_ID) {
        const { data: links } = await supabase.from('mcq_category_links').select('mcq_id');
        const ids = Array.from(new Set(links?.map(l => l.mcq_id) || []));
        if (ids.length > 0) baseQuery = baseQuery.not('id', 'in', `(${ids.join(',')})`);
      } else if (selectedCategoryId) {
        const { data: links } = await supabase.from('mcq_category_links').select('mcq_id').eq('category_id', selectedCategoryId);
        const ids = Array.from(new Set(links?.map(l => l.mcq_id) || []));
        baseQuery = baseQuery.in('id', ids);
      }

      if (sessionIsTrial && selectedCategoryId !== ALL_TRIAL_MCQS_ID) baseQuery = baseQuery.eq('is_trial_mcq', true);

      const { data: idsData } = await baseQuery;
      mcqIdsToConsider = idsData?.map(m => m.id) || [];

      if (mode === 'incorrect' && user && isSubscribed) {
        const { data: inc } = await supabase.from('user_quiz_attempts').select('mcq_id').eq('user_id', user.id).in('mcq_id', mcqIdsToConsider).eq('is_correct', false);
        const incIds = Array.from(new Set(inc?.map(a => a.mcq_id) || []));
        if (incIds.length === 0) {
          toast({ title: "No Mistakes", description: "You don't have any recorded incorrect answers here.", variant: "default" });
          setIsPageLoading(false);
          return;
        }
        mcqIdsToConsider = incIds;
      }

      if (mcqIdsToConsider.length === 0) {
        toast({ title: "No MCQs", description: "No questions found matching your selection.", variant: "default" });
        setIsPageLoading(false);
        return;
      }

      let finalIds = shuffleArray(mcqIdsToConsider);
      if (sessionIsTrial && selectedCategoryId !== ALL_TRIAL_MCQS_ID) finalIds = finalIds.slice(0, Math.min(finalIds.length, TRIAL_MCQ_LIMIT));

      const { data } = await supabase.from('mcqs').select(`*, mcq_category_links (category_id, categories (name))`).in('id', finalIds);
      mcqsToLoad = (data || []).map((mcq: any) => ({
        ...mcq, category_links: mcq.mcq_category_links?.map((l: any) => ({ category_id: l.category_id, category_name: l.categories?.name || null })) || [],
      }));
      mcqsToLoad = finalIds.map(id => mcqsToLoad.find(m => m.id === id)).filter((m): m is MCQ => !!m);
    }

    if (mcqsToLoad.length === 0) {
      toast({ title: "Error", description: "Failed to build quiz session.", variant: "default" });
      setIsPageLoading(false);
      return;
    }

    setQuizQuestions(mcqsToLoad);
    setShowCategorySelection(false);
    setIsPageLoading(false);
    
    const initialAnswers = new Map<string, UserAnswerData>();
    mcqsToLoad.forEach(m => initialAnswers.set(m.id, { selectedOption: null, isCorrect: null, submitted: false }));
    setUserAnswers(initialAnswers);

    if (user && !isOffline) {
      await saveQuizState(null, selectedCategoryId, mcqsToLoad, initialAnswers, 0, sessionIsTrial, user.id, false);
    }

    if (user && sessionIsTrial && !hasTakenTrial) {
      await supabase.from('profiles').update({ trial_taken: true }).eq('id', user.id);
    }
    setIsTrialActiveSession(sessionIsTrial);
    setCurrentQuizCategoryId(selectedCategoryId);
  };

  const continueQuizSession = useCallback(async (loadedSession: LoadedQuizSession) => {
    setIsPageLoading(true);
    setCurrentDbSessionId(loadedSession.dbSessionId);
    setCurrentQuizCategoryId(loadedSession.categoryId);
    setIsTrialActiveSession(loadedSession.isTrialActiveSession);
    setIsOfflineQuiz(loadedSession.isOffline);

    let mcqsData: MCQ[] = [];
    if (loadedSession.isOffline) {
        mcqsData = await getOfflineMcqs(loadedSession.mcqs.map(m => m.id));
        mcqsData = loadedSession.mcqs.map(l => mcqsData.find(f => f.id === l.id)).filter((m): m is MCQ => !!m);
    } else {
        const { data } = await supabase.from('mcqs').select(`*, mcq_category_links (category_id, categories (name))`).in('id', loadedSession.mcqs.map(m => m.id));
        const formatted = (data || []).map((mcq: any) => ({
          ...mcq, category_links: mcq.mcq_category_links?.map((l: any) => ({ category_id: l.category_id, category_name: l.categories?.name || null })) || [],
        }));
        mcqsData = loadedSession.mcqs.map(l => formatted.find(f => f.id === l.id)).filter((m): m is MCQ => !!m);
    }

    setQuizQuestions(mcqsData);
    setUserAnswers(loadedSession.userAnswers);
    setCurrentQuestionIndex(loadedSession.currentQuestionIndex);

    const q = mcqsData[loadedSession.currentQuestionIndex];
    const ans = loadedSession.userAnswers.get(q.id);
    setSelectedAnswer(ans?.selectedOption || null);
    setFeedback(ans?.submitted ? (ans.isCorrect ? 'Correct!' : `Incorrect. Correct: ${q.correct_answer}.`) : null);
    setShowExplanation(ans?.submitted || false);
    if (ans?.submitted && q.explanation_id) fetchExplanation(q.explanation_id);

    setShowCategorySelection(false);
    setIsPageLoading(false);
  }, [fetchExplanation, getOfflineMcqs]);

  useEffect(() => {
    if (user && currentDbSessionId && !showCategorySelection && quizQuestions.length > 0 && !showResults && currentQuizCategoryId && !isOfflineQuiz) {
      saveQuizState(currentDbSessionId, currentQuizCategoryId, quizQuestions, userAnswers, currentQuestionIndex, isTrialActiveSession, user.id, isOfflineQuiz);
    }
  }, [quizQuestions, userAnswers, currentQuestionIndex, isTrialActiveSession, showCategorySelection, showResults, saveQuizState, user, currentQuizCategoryId, currentDbSessionId, isOfflineQuiz]);

  const handleOptionSelect = useCallback((value: string) => {
    if (currentMcq) {
      setSelectedAnswer(value);
      setUserAnswers(prev => {
        const newMap = new Map(prev);
        newMap.set(currentMcq.id, { selectedOption: value, isCorrect: null, submitted: false });
        return newMap;
      });
      setFeedback(null);
      setShowExplanation(false);
    }
  }, [currentMcq]);

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentMcq) return;

    setIsSubmittingAnswer(true);
    const isCorrect = selectedAnswer === currentMcq.correct_answer;
    setFeedback(isCorrect ? 'Correct!' : `Incorrect. The correct answer was ${currentMcq.correct_answer}.`);
    setShowExplanation(true);

    setUserAnswers(prev => {
      const newMap = new Map(prev);
      newMap.set(currentMcq.id, { selectedOption: selectedAnswer, isCorrect, submitted: true });
      return newMap;
    });

    if (user && !isOfflineQuiz) {
        await supabase.from('user_quiz_attempts').insert({
          user_id: user.id, mcq_id: currentMcq.id,
          category_id: currentMcq.category_links?.[0]?.category_id || null,
          selected_option: selectedAnswer, is_correct: isCorrect,
        });
    }
    
    setIsSubmittingAnswer(false);
    if (currentMcq.explanation_id) fetchExplanation(currentMcq.explanation_id);
  };

  const handleNextQuestion = () => {
    if (isTrialActiveSession && currentQuestionIndex + 1 >= TRIAL_MCQ_LIMIT) {
      submitFullQuiz();
      return;
    }

    if (currentQuestionIndex < quizQuestions.length - 1) {
      const nq = quizQuestions[currentQuestionIndex + 1];
      setCurrentQuestionIndex(prev => prev + 1);
      const ans = userAnswers.get(nq?.id || '');
      setSelectedAnswer(ans?.selectedOption || null);
      setFeedback(ans?.submitted ? (ans.isCorrect ? 'Correct!' : `Incorrect. Correct: ${nq.correct_answer}.`) : null);
      setShowExplanation(ans?.submitted || false);
      if (ans?.submitted && nq.explanation_id) fetchExplanation(nq.explanation_id);
    } else {
      submitFullQuiz();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      const pq = quizQuestions[currentQuestionIndex - 1];
      setCurrentQuestionIndex(prev => prev - 1);
      const ans = userAnswers.get(pq?.id || '');
      setSelectedAnswer(ans?.selectedOption || null);
      setFeedback(ans?.submitted ? (ans.isCorrect ? 'Correct!' : `Incorrect. Correct: ${pq.correct_answer}.`) : null);
      setShowExplanation(ans?.submitted || false);
      if (ans?.submitted && pq.explanation_id) fetchExplanation(pq.explanation_id);
    }
  };

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < quizQuestions.length) {
      setCurrentQuestionIndex(index);
      const q = quizQuestions[index];
      const ans = userAnswers.get(q.id);
      setSelectedAnswer(ans?.selectedOption || null);
      setFeedback(ans?.submitted ? (ans.isCorrect ? 'Correct!' : `Incorrect. Correct: ${q.correct_answer}.`) : null);
      setShowExplanation(ans?.submitted || false);
      if (ans?.submitted && q.explanation_id) fetchExplanation(q.explanation_id);
    }
  }, [quizQuestions, userAnswers, fetchExplanation]);

  const submitFullQuiz = async () => {
    let correctCount = 0;
    const promises = [];
    for (const mcq of quizQuestions) {
      if (userAnswers.get(mcq.id)?.isCorrect) correctCount++;
      if (mcq.explanation_id) promises.push(fetchExplanation(mcq.explanation_id));
    }
    setScore(correctCount);
    await Promise.all(promises);
    setShowResults(true);
    if (currentDbSessionId && !isOfflineQuiz) clearSpecificQuizState(currentDbSessionId);
  };

  const handleSaveProgress = async () => {
    if (!user) {
      toast({
        title: "Cannot Save",
        description: "You must be logged in to save quiz progress.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    if (isOfflineQuiz) {
        toast({
            title: "Offline Quiz",
            description: "Offline quiz progress is not saved remotely. It persists locally until you finish the quiz.",
            variant: "default",
            duration: 3000,
        });
        return;
    }

    if (currentQuizCategoryId && quizQuestions.length > 0) {
      const savedSessionResult = await saveQuizState(
        currentDbSessionId,
        currentQuizCategoryId,
        quizQuestions,
        userAnswers,
        currentQuestionIndex,
        isTrialActiveSession,
        user.id,
        isOfflineQuiz
      );

      if (savedSessionResult) {
        const categoryName = currentQuizCategoryId === ALL_TRIAL_MCQS_ID
          ? 'All Trial MCQs'
          : currentQuizCategoryId === UNCATEGORIZED_ID
            ? 'Uncategorized'
            : categoryStats.find(c => c.id === currentQuizCategoryId)?.name || 'Unknown Category';

        setActiveSavedQuizzes(prev => {
          const existingIndex = prev.findIndex(session => session.dbSessionId === savedSessionResult.id);
          const newSession: LoadedQuizSession = {
            dbSessionId: savedSessionResult.id,
            categoryId: currentQuizCategoryId,
            mcqs: quizQuestions,
            userAnswers: new Map(Object.entries(savedSessionResult.sessionData.user_answers_json)),
            currentQuestionIndex: savedSessionResult.sessionData.current_question_index,
            isTrialActiveSession: isTrialActiveSession,
            userId: user.id,
            categoryName: categoryName,
            isOffline: isOfflineQuiz,
          };
          
          if (existingIndex > -1) {
            const updatedPrev = [...prev];
            updatedPrev[existingIndex] = newSession;
            return updatedPrev;
          } else {
            return [newSession, ...prev];
          }
        });

        toast({
          title: "Progress Saved!",
          description: "Your quiz progress has been saved.",
          duration: 3000,
        });
      }
    } else {
      toast({
        title: "Cannot Save",
        description: "No active quiz session to save.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const handleSubmitFeedback = async () => {
    if (!user || !currentMcq || !feedbackText.trim()) {
      toast({ title: "Error", description: "Feedback cannot be empty.", variant: "destructive" });
      return;
    }
    
    if (isOfflineQuiz) {
        toast({ title: "Offline Restriction", description: "Feedback submission is not available in offline mode.", variant: "destructive" });
        return;
    }

    setIsSubmittingFeedback(true);
    try {
      const { error: insertError } = await supabase.from('mcq_feedback').insert({
        user_id: user.id,
        mcq_id: currentMcq.id,
        feedback_text: feedbackText.trim(),
      });

      if (insertError) throw insertError;

      await supabase.functions.invoke('send-email', {
        body: {
          to: 'ADMIN_EMAIL',
          subject: `New MCQ Feedback from ${user.email}`,
          body: `User ${user.email} submitted feedback for MCQ ID: ${currentMcq.id}.<br/>Question: ${currentMcq.question_text}<br/>Feedback: ${feedbackText.trim()}`,
        },
      });

      toast({ title: "Feedback Submitted!", description: "Thank you for your notes.", variant: "default" });
      setFeedbackText('');
      setIsFeedbackDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: `Failed: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleBackToSelection = () => {
    const isCurrentQuizSaved = currentDbSessionId && activeSavedQuizzes.some(session => session.dbSessionId === currentDbSessionId);

    if (!isCurrentQuizSaved && quizQuestions.length > 0 && !showResults) {
      if (!window.confirm("Are you sure? Current unsaved progress will be lost.")) return;
    }

    setQuizQuestions([]);
    setUserAnswers(new Map());
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setFeedback(null);
    setShowExplanation(false);
    setScore(0);
    setExplanations(new Map());
    setShowResults(false);
    setShowCategorySelection(true);
    setCurrentQuizCategoryId(null);
    setCurrentDbSessionId(null);
    setIsOfflineQuiz(false);
    fetchQuizOverview();
  };

  const handleGoToDashboard = () => {
    const isCurrentQuizSaved = currentDbSessionId && activeSavedQuizzes.some(session => session.dbSessionId === currentDbSessionId);
    if (!isCurrentQuizSaved && quizQuestions.length > 0 && !showResults) {
      if (!window.confirm("Are you sure? Current unsaved progress will be lost.")) return;
    }
    navigate('/user/dashboard');
  };

  const filteredCategories = categoryStats.filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()));

  if (!hasCheckedInitialSession || isPageLoading) return <div className="min-h-screen flex items-center justify-center pt-16"><p>Loading...</p></div>;

  if (showSubscriptionPrompt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-16">
        <Card className="w-full max-w-2xl text-center">
          <CardHeader><CardTitle>Trial Completed!</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p>To unlock all questions, please subscribe.</p>
            <Button onClick={() => navigate('/user/subscriptions')} className="w-full sm:w-auto">Plans</Button>
            <Button onClick={() => setShowCategorySelection(true)} variant="outline" className="w-full sm:w-auto">Back</Button>
          </CardContent>
          <MadeWithDyad />
        </Card>
      </div>
    );
  }

  if (showCategorySelection) {
    const isSubscribed = user?.has_active_subscription;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-16">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Select a Quiz</CardTitle>
            <CardDescription>Choose a topic to practice.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeSavedQuizzes.length > 0 && !isGuest && (
              <Card className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
                <CardHeader><CardTitle>Continue Quiz</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {activeSavedQuizzes.map(s => (
                    <div key={s.dbSessionId} className="flex justify-between items-center p-3 border rounded-md">
                      <div><p className="font-semibold">{s.categoryName}</p></div>
                      <div className="flex gap-2"><Button onClick={() => continueQuizSession(s)} size="sm">Resume</Button></div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {(!isSubscribed) && allTrialMcqsCount > 0 && (
              <Card className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
                <CardHeader><CardTitle>Free Trial Available</CardTitle></CardHeader>
                <CardContent>
                  <Button onClick={() => startQuizSession(ALL_TRIAL_MCQS_ID, 'random', false)} className="w-full">
                    Start Comprehensive Trial Quiz ({Math.min(allTrialMcqsCount, TRIAL_MCQ_LIMIT)} Questions)
                  </Button>
                </CardContent>
              </Card>
            )}

            <Input placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCategories.map(cat => (
                <Card key={cat.id} className="flex flex-col">
                  <CardHeader><CardTitle className="text-lg">{cat.name}</CardTitle></CardHeader>
                  <CardContent className="grow text-sm">
                    <p>{cat.total_mcqs} questions ({cat.total_trial_mcqs} free trial)</p>
                    {!isGuest && <p>Accuracy: {cat.user_accuracy}</p>}
                  </CardContent>
                  <CardFooter className="flex flex-col gap-2">
                    <Button onClick={() => startQuizSession(cat.id, 'random', false)} className="w-full">Start</Button>
                    {isNative && cat.offline_count > 0 && (
                      <Button onClick={() => startQuizSession(cat.id, 'random', true)} className="w-full" variant="outline"><WifiOff className="mr-2 h-4" /> Offline ({cat.offline_count})</Button>
                    )}
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

  if (showResults) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-16">
        <div className="flex flex-col md:flex-row w-full max-w-6xl">
          <Card className="flex-1 order-last">
            <CardHeader><CardTitle>Results: {score} / {quizQuestions.length}</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-h-[60vh] overflow-y-auto">
              {quizQuestions.map((m, i) => (
                <div key={m.id} className="border-b pb-4">
                  <p className="font-semibold">{i + 1}. {m.question_text}</p>
                  {['A','B','C','D'].map(k => {
                    const opt = m[`option_${k.toLowerCase()}` as keyof MCQ] as string;
                    return (
                      <p key={k} className={m.correct_answer === k ? "text-green-900 font-bold" : (userAnswers.get(m.id)?.selectedOption === k ? "text-red-900 font-bold" : "")}>
                        {k}. {opt}
                      </p>
                    );
                  })}
                </div>
              ))}
            </CardContent>
            <CardFooter className="justify-center gap-4">
                <Button onClick={() => navigate('/user/dashboard')}>Dashboard</Button>
                <Button onClick={handleBackToSelection} variant="outline">Quizzes</Button>
            </CardFooter>
          </Card>
          <QuizNavigator mcqs={quizQuestions} userAnswers={userAnswers} currentQuestionIndex={currentQuestionIndex} goToQuestion={goToQuestion} showResults={true} score={score} />
        </div>
        <MadeWithDyad />
      </div>
    );
  }

  const ans = userAnswers.get(currentMcq.id);
  const isLastQuestion = currentQuestionIndex === quizQuestions.length - 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 pt-16">
      <div className="w-full max-w-6xl mb-4 text-center">
        <Card className="p-4">
          <p className="text-lg font-semibold">Accuracy: {currentCorrectnessPercentage} ({currentCorrectCount} correct)</p>
        </Card>
      </div>
      <div className="flex flex-col md:flex-row w-full max-w-6xl">
        <Card className="flex-1 order-last">
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Q {currentQuestionIndex + 1} / {quizQuestions.length}</CardTitle>
            {!isGuest && !isOfflineQuiz && (
              <Button variant="ghost" size="icon" onClick={toggleBookmark} disabled={isBookmarkLoading}>
                {isBookmarked ? <BookmarkCheck className="fill-primary" /> : <Bookmark />}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold mb-4">{currentMcq.question_text}</p>
            <RadioGroup onValueChange={handleOptionSelect} value={selectedAnswer || ""} disabled={ans?.submitted}>
              {['A', 'B', 'C', 'D'].map(k => {
                const opt = currentMcq[`option_${k.toLowerCase()}` as keyof MCQ] as string;
                return (
                  <div key={k} className={cn("flex items-center space-x-2 p-2 rounded border", ans?.submitted && k === currentMcq.correct_answer && "bg-green-50 border-green-600 text-green-900 font-bold", ans?.submitted && selectedAnswer === k && !ans.isCorrect && "bg-red-50 border-red-600 text-red-900 font-bold")}>
                    <RadioGroupItem value={k} id={k} /><Label htmlFor={k} className="grow cursor-pointer">{k}. {opt}</Label>
                  </div>
                );
              })}
            </RadioGroup>
            {feedback && (
              <p className={`mt-4 text-lg font-semibold flex items-center gap-2 ${feedback.startsWith('Correct') ? 'text-green-700' : 'text-red-700'}`}>
                {feedback.startsWith('Correct') ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                {feedback}
              </p>
            )}
            {showExplanation && explanations.get(currentMcq.explanation_id || '') && (
                <div className="mt-6 p-4 border rounded bg-white prose max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{explanations.get(currentMcq.explanation_id || '')!.explanation_text}</ReactMarkdown>
                    {user && !isOfflineQuiz && (
                        <Button variant="outline" className="mt-4 w-full" onClick={() => setIsFeedbackDialogOpen(true)}>
                            <MessageSquareText className="h-4 w-4 mr-2" /> Add Notes
                        </Button>
                    )}
                </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between gap-2">
            <div className="flex gap-2">
              <Button onClick={handleBackToSelection} variant="outline" size="sm">Selection</Button>
              <Button onClick={handleGoToDashboard} variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" /> Dashboard</Button>
              <Button onClick={handleSaveProgress} variant="secondary" size="sm" disabled={!user || isOfflineQuiz}><Save className="h-4 w-4 mr-1" /> Save</Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0} variant="outline" size="sm">Prev</Button>
              {!ans?.submitted ? (
                <Button onClick={handleSubmitAnswer} disabled={!selectedAnswer || isSubmittingAnswer} size="sm">Submit</Button>
              ) : (
                <Button onClick={handleNextQuestion} size="sm">{isLastQuestion ? "Finish" : "Next"}</Button>
              )}
            </div>
          </CardFooter>
          
          <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Notes</DialogTitle></DialogHeader>
              <Textarea value={feedbackText} onChange={e => setFeedbackText(e.target.value)} rows={5} placeholder="Your notes..." />
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsFeedbackDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSubmitFeedback} disabled={isSubmittingFeedback || !feedbackText.trim()}>Save</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>
        <QuizNavigator mcqs={quizQuestions} userAnswers={userAnswers} currentQuestionIndex={currentQuestionIndex} goToQuestion={goToQuestion} showResults={false} score={0} />
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default QuizPage;