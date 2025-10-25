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
import { AlertCircle, CheckCircle2, RotateCcw, MessageSquareText, Save, Bookmark, BookmarkCheck, ArrowLeft, WifiOff } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import QuizNavigator from '@/components/QuizNavigator';
import { MCQ } from '@/components/mcq-columns';
import { cn } from '@/lib/utils';
import { useBookmark } from '@/hooks/use-bookmark';
import useOfflineMcqs from '@/hooks/useOfflineMcqs'; // Import offline hook
import { Separator } from '@/components/ui/separator'; // Import Separator

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
  offline_count: number; // New field for offline count
}

interface UserAnswerData {
  selectedOption: string | null;
  isCorrect: boolean | null;
  submitted: boolean;
}

// Interface for data stored in the database (used internally for typing fetched data)
interface DbQuizSession {
  id: string;
  user_id: string;
  category_id: string | null;
  mcq_ids_order: string[]; // Array of MCQ IDs
  current_question_index: number;
  user_answers_json: { [mcqId: string]: UserAnswerData }; // JSONB object
  is_trial_session: boolean;
  created_at: string;
  updated_at: string;
}

// Client-side representation of a loaded session, including full MCQ objects
interface LoadedQuizSession {
  dbSessionId: string; // The ID from the database
  categoryId: string | null; // Changed to allow null
  mcqs: MCQ[]; // Full MCQ objects
  userAnswers: Map<string, UserAnswerData>;
  currentQuestionIndex: number;
  isTrialActiveSession: boolean;
  userId: string;
  categoryName: string; // Added for display
  isOffline: boolean; // New flag
}

const TRIAL_MCQ_LIMIT = 50;
const ALL_TRIAL_MCQS_ID = 'all-trial-mcqs-virtual-id'; // Special ID for fetching all trial MCQs
const UNCATEGORIZED_ID = 'uncategorized-mcqs-virtual-id'; // Unique ID for the virtual uncategorized category

// Helper function for client-side shuffling
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
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
  const [currentQuizCategoryId, setCurrentQuizCategoryId] = useState<string | null>(null); // Track the category of the current quiz
  const [currentDbSessionId, setCurrentDbSessionId] = useState<string | null>(null); // New: Track the DB session ID
  const [showCategorySelection, setShowCategorySelection] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [score, setScore] = useState(0);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());

  const [showSubscriptionPrompt, setShowSubscriptionPrompt] = useState(false);
  const [isTrialActiveSession, setIsTrialActiveSession] = useState(false);
  const [allTrialMcqsCount, setAllTrialMcqsCount] = useState(0);
  const [isOfflineQuiz, setIsOfflineQuiz] = useState(false); // New state for offline mode

  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const [activeSavedQuizzes, setActiveSavedQuizzes] = useState<LoadedQuizSession[]>([]);

  // New states for current quiz accuracy
  const [currentCorrectCount, setCurrentCorrectCount] = useState(0);
  const [currentCorrectnessPercentage, setCurrentCorrectnessPercentage] = useState('0.00%');

  const currentMcq = quizQuestions[currentQuestionIndex];
  const { isBookmarked, toggleBookmark, isLoading: isBookmarkLoading } = useBookmark(currentMcq?.id || null);
  const isGuest = !user;

  // Effect to calculate current quiz accuracy
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
      // For offline quizzes, explanation text is embedded in the MCQ object
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

  // Function to save quiz state to the database
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
    if (!currentUserId) {
      console.warn("Cannot save quiz state: User not logged in.");
      return null;
    }
    
    // Do not save offline quizzes to the remote database
    if (isOffline) {
        console.warn("Skipping remote save: Quiz is running in offline mode.");
        return null;
    }

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
        // Update existing session
        const { data, error } = await supabase
          .from('user_quiz_sessions')
          .update({ ...sessionData, updated_at: new Date().toISOString() })
          .eq('id', dbSessionId)
          .select('id')
          .single();

        if (error) throw error;
        console.log(`Quiz session ${dbSessionId} updated in DB.`);
        return { id: data.id, sessionData: { ...sessionData, id: data.id, created_at: '', updated_at: new Date().toISOString() } as DbQuizSession };
      } else {
        // Insert new session
        const { data, error } = await supabase
          .from('user_quiz_sessions')
          .insert(sessionData)
          .select('id, created_at, updated_at')
          .single();

        if (error) throw error;
        setCurrentDbSessionId(data.id); // Store the new session ID
        console.log(`New quiz session ${data.id} created in DB.`);
        return { id: data.id, sessionData: { ...sessionData, id: data.id, created_at: data.created_at, updated_at: data.updated_at } as DbQuizSession };
      }
    } catch (error: any) {
      console.error("Error saving quiz state to DB:", error);
      toast({
        title: "Error",
        description: `Failed to save quiz progress: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
      return null;
    }
  }, [toast]);

  // Function to clear a specific quiz session from the database
  const clearSpecificQuizState = useCallback(async (dbSessionId: string) => {
    try {
      const { error } = await supabase
        .from('user_quiz_sessions')
        .delete()
        .eq('id', dbSessionId);

      if (error) throw error;
      console.log(`Quiz session ${dbSessionId} deleted from DB.`);
      setActiveSavedQuizzes(prev => prev.filter(session => session.dbSessionId !== dbSessionId));
    } catch (error: any) {
      console.error("Error clearing quiz state from DB:", error);
      toast({
        title: "Error",
        description: `Failed to clear quiz progress: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (!user) { // Guest mode
        setIsTrialActiveSession(true);
        fetchQuizOverview();
      } else { // Logged-in user
        if (!user.has_active_subscription && !user.trial_taken) {
          setIsTrialActiveSession(true);
        } else {
          setIsTrialActiveSession(false);
        }
        fetchQuizOverview();
      }
    }
  }, [user, hasCheckedInitialSession, isDbInitialized]); // Added isDbInitialized dependency

  const fetchQuizOverview = async () => {
    setIsPageLoading(true);

    // 1. Fetch all categories
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('id, name');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
      setIsPageLoading(false);
      return;
    }
    const categoriesMap = new Map(categoriesData?.map(cat => [cat.id, cat]) || []);
    categoriesMap.set(UNCATEGORIZED_ID, { id: UNCATEGORIZED_ID, name: 'Uncategorized' });

    // 2. Fetch total count of all trial MCQs
    const { count: totalTrialMcqsCount, error: totalTrialError } = await supabase
      .from('mcqs')
      .select('id', { count: 'exact', head: true })
      .eq('is_trial_mcq', true);

    if (totalTrialError) {
      console.error('Error fetching total trial MCQs count:', totalTrialError);
    }
    setAllTrialMcqsCount(totalTrialMcqsCount || 0);

    // --- 3. Fetch all MCQ category links (paginated, NO JOIN) ---
    const limit = 1000;
    let allMcqCategoryLinks: { category_id: string; mcq_id: string }[] = [];
    let offset = 0;
    let hasMore = true;

    try {
      while (hasMore) {
        const { data: chunkData, error: chunkError } = await supabase
          .from('mcq_category_links')
          .select('category_id, mcq_id')
          .range(offset, offset + limit - 1);

        if (chunkError) {
          console.error('Error fetching paginated MCQ category links:', chunkError);
          throw new Error('Failed to load category link data.');
        }

        if (chunkData && chunkData.length > 0) {
          allMcqCategoryLinks = allMcqCategoryLinks.concat(chunkData);
          offset += chunkData.length;
          hasMore = chunkData.length === limit;
        } else {
          hasMore = false;
        }
      }
    } catch (e: any) {
      console.error('Error during paginated fetch:', e);
      // Don't fail the whole load, just log and continue with partial data
    }
    
    // 4. Collect all unique MCQ IDs and fetch their trial status (using batching)
    const uniqueLinkedMcqIds = Array.from(new Set(allMcqCategoryLinks.map(link => link.mcq_id)));
    
    let mcqTrialStatusMap = new Map<string, boolean>();
    
    const chunkSize = 500;
    const fetchPromises = [];

    for (let i = 0; i < uniqueLinkedMcqIds.length; i += chunkSize) {
        const chunk = uniqueLinkedMcqIds.slice(i, i + chunkSize);
        
        fetchPromises.push(
            supabase
                .from('mcqs')
                .select('id, is_trial_mcq')
                .in('id', chunk)
        );
    }

    try {
      const results = await Promise.all(fetchPromises);

      for (const result of results) {
          if (result.error) {
              console.error('Error fetching MCQ trial status chunk:', result.error);
              throw new Error('Failed to load MCQ trial status.');
          }
          result.data.forEach(mcq => {
              mcqTrialStatusMap.set(mcq.id, mcq.is_trial_mcq || false);
          });
      }
    } catch (e: any) {
      console.error('Error during batch fetch for trial status:', e);
      // Don't fail the whole load, just log and continue
    }

    // 5. Process data client-side to build categoryMcqCounts
    const categoryMcqCounts = new Map<string, { total: number; trial: number }>();
    
    allMcqCategoryLinks.forEach(link => {
      const mcqId = link.mcq_id;
      const isTrialMcq = mcqTrialStatusMap.get(mcqId) || false; 
      const categoryId = link.category_id;

      if (!categoryMcqCounts.has(categoryId)) {
        categoryMcqCounts.set(categoryId, { total: 0, trial: 0 });
      }
      const counts = categoryMcqCounts.get(categoryId)!;
      counts.total++;
      if (isTrialMcq) {
        counts.trial++;
      }
    });

    // 6. Calculate uncategorized MCQs counts
    const { count: totalMcqCount, error: totalMcqCountError } = await supabase
      .from('mcqs')
      .select('id', { count: 'exact', head: true });
      
    if (totalMcqCountError) {
      console.error('Error fetching total MCQ count for uncategorized:', totalMcqCountError);
    }

    const uncategorizedTotal = (totalMcqCount || 0) - uniqueLinkedMcqIds.length;

    let uncategorizedTrial = 0;
    if (uncategorizedTotal > 0) {
      let trialQuery = supabase
        .from('mcqs')
        .select('id', { count: 'exact', head: true })
        .eq('is_trial_mcq', true);

      if (uniqueLinkedMcqIds.length > 0) {
        trialQuery = trialQuery.not('id', 'in', `(${Array.from(uniqueLinkedMcqIds).join(',')})`);
      }
      
      const { count: uncategorizedTrialCount, error: uncategorizedTrialError } = await trialQuery;
      
      if (uncategorizedTrialError) {
        console.error('Error fetching uncategorized trial MCQ count:', uncategorizedTrialError);
      }
      uncategorizedTrial = uncategorizedTrialCount || 0;
    }

    if (uncategorizedTotal > 0) {
      categoryMcqCounts.set(UNCATEGORIZED_ID, { total: uncategorizedTotal, trial: uncategorizedTrial });
    }
    // --- End of count calculation ---


    // 7. Fetch all user quiz attempts (if logged in)
    let userAttemptsData: any[] = [];
    if (user) {
      const { data, error: attemptsError } = await supabase
        .from('user_quiz_attempts')
        .select('is_correct, category_id')
        .eq('user_id', user.id);
      if (attemptsError) {
        console.error('Error fetching user attempts:', attemptsError);
        toast({ title: "Error", description: "Failed to load user attempts.", variant: "destructive" });
      } else {
        userAttemptsData = data || [];
      }
    }

    // 8. Process data client-side to build categoryStats
    const categoriesWithStats: CategoryStat[] = [];
    const categoryUserAttempts = new Map<string, { total: number; correct: number }>();

    // Populate categoryUserAttempts
    userAttemptsData.forEach(attempt => {
      const categoryId = attempt.category_id;
      if (categoryId) {
        if (!categoryUserAttempts.has(categoryId)) {
          categoryUserAttempts.set(categoryId, { total: 0, correct: 0 });
        }
        const attempts = categoryUserAttempts.get(categoryId)!;
        attempts.total++;
        if (attempt.is_correct) {
          attempts.correct++;
        }
      }
    });

    // 9. Fetch offline counts if native platform is initialized
    let offlineCounts = new Map<string, number>();
    if (isNative && isDbInitialized) {
        offlineCounts = await getOfflineCategoryCounts();
    }

    // Build final categoriesWithStats
    categoriesData?.forEach(category => {
      const mcqCounts = categoryMcqCounts.get(category.id) || { total: 0, trial: 0 };
      const userAttempts = categoryUserAttempts.get(category.id) || { total: 0, correct: 0 };

      const incorrectAttempts = userAttempts.total - userAttempts.correct;
      const accuracy = userAttempts.total > 0 ? ((userAttempts.correct / userAttempts.total) * 100).toFixed(2) : '0.00';

      categoriesWithStats.push({
        ...category,
        total_mcqs: mcqCounts.total,
        total_trial_mcqs: mcqCounts.trial,
        user_attempts: userAttempts.total,
        user_correct: userAttempts.correct,
        user_incorrect: incorrectAttempts,
        user_accuracy: `${accuracy}%`,
        offline_count: offlineCounts.get(category.id) || 0, // Set offline count
      });
    });

    // Add a virtual 'Uncategorized' category to the stats list if it has MCQs
    const uncategorizedStats = categoryMcqCounts.get(UNCATEGORIZED_ID);
    if (uncategorizedStats && uncategorizedStats.total > 0) {
      const uncategorizedUserAttempts = categoryUserAttempts.get(UNCATEGORIZED_ID) || { total: 0, correct: 0 };
      const uncategorizedIncorrectAttempts = uncategorizedUserAttempts.total - uncategorizedUserAttempts.correct;
      const uncategorizedAccuracy = uncategorizedUserAttempts.total > 0 ? ((uncategorizedUserAttempts.correct / uncategorizedUserAttempts.total) * 100).toFixed(2) : '0.00';

      categoriesWithStats.push({
        id: UNCATEGORIZED_ID,
        name: 'Uncategorized',
        total_mcqs: uncategorizedStats.total,
        total_trial_mcqs: uncategorizedStats.trial,
        user_attempts: uncategorizedUserAttempts.total,
        user_correct: uncategorizedUserAttempts.correct,
        user_incorrect: uncategorizedIncorrectAttempts,
        user_accuracy: `${uncategorizedAccuracy}%`,
        offline_count: offlineCounts.get(UNCATEGORIZED_ID) || 0, // Set offline count
      });
    }

    // 10. Load saved quiz sessions
    let loadedSavedQuizzes: LoadedQuizSession[] = [];
    if (user) {
      const { data: dbSessions, error: dbSessionsError } = await supabase
        .from('user_quiz_sessions')
        .select('*')
        .eq('user_id', user.id)
        .is('test_duration_seconds', null) // Filter out test sessions
        .order('updated_at', { ascending: false });

      if (dbSessionsError) {
        console.error('Error fetching saved quiz sessions from DB:', dbSessionsError);
        toast({ title: "Error", description: "Failed to load saved quiz sessions.", variant: "destructive" });
      } else {
        loadedSavedQuizzes = dbSessions.map((dbSession: DbQuizSession) => {
          const categoryName = dbSession.category_id === ALL_TRIAL_MCQS_ID
            ? 'All Trial MCQs'
            : dbSession.category_id === UNCATEGORIZED_ID
              ? 'Uncategorized'
              : categoriesMap.get(dbSession.category_id || '')?.name || 'Unknown Category';
          return {
            dbSessionId: dbSession.id,
            categoryId: dbSession.category_id,
            mcqs: dbSession.mcq_ids_order.map((id: string) => ({
              id, question_text: 'Loading...', option_a: '', option_b: '', option_c: '', option_d: '',
              correct_answer: 'A', explanation_id: null, difficulty: null, is_trial_mcq: null, category_links: [],
            })),
            userAnswers: new Map(Object.entries(dbSession.user_answers_json)),
            currentQuestionIndex: dbSession.current_question_index,
            isTrialActiveSession: dbSession.is_trial_session,
            userId: user.id,
            categoryName: categoryName,
            isOffline: false, // Saved sessions are always online
          } as LoadedQuizSession;
        });
      }
    }
    setActiveSavedQuizzes(loadedSavedQuizzes);

    setCategoryStats(categoriesWithStats);
    setIsPageLoading(false);
  };

  const startQuizSession = async (selectedCategoryId: string | null, mode: 'random' | 'incorrect', isOffline: boolean) => {
    console.log(`[QuizPage] STARTING QUIZ SESSION for category: ${selectedCategoryId}, mode: ${mode}, offline: ${isOffline}`);
    
    setIsOfflineQuiz(isOffline);
    
    const isSubscribed = user?.has_active_subscription;
    const hasTakenTrial = user?.trial_taken;
    const isGuest = !user;

    // Determine if this session *should* be a trial session
    let sessionIsTrial = false;
    if (selectedCategoryId === ALL_TRIAL_MCQS_ID) {
      sessionIsTrial = true;
    } else if (isGuest || (!isSubscribed && !hasTakenTrial)) {
      sessionIsTrial = true;
    }
    
    // If logged in, not subscribed, and already took trial, and it's NOT a trial session, show prompt
    if (!isGuest && !isSubscribed && hasTakenTrial && !sessionIsTrial && !isOffline) {
      setShowSubscriptionPrompt(true);
      return;
    }

    // If it's a trial session and mode is 'incorrect', restrict it.
    if (sessionIsTrial && mode === 'incorrect') {
      toast({ title: "Feature Restricted", description: "This feature is only available for subscribed users.", variant: "default" });
      setIsPageLoading(false);
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
    setCurrentDbSessionId(null); // Reset current DB session ID for a new quiz

    let mcqIdsToConsider: string[] = [];
    let mcqsToLoad: MCQ[] = [];

    if (isOffline) {
      // --- OFFLINE MODE ---
      if (!isNative || !isDbInitialized) {
        toast({ title: "Error", description: "Offline database is not ready.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }
      
      if (selectedCategoryId) {
        mcqIdsToConsider = await getOfflineMcqIdsByCategory(selectedCategoryId);
      } else {
        // Fetch all offline MCQs if no category selected (not supported by current offline hook, so we'll skip for now)
        toast({ title: "Error", description: "Please select a category for offline quiz.", variant: "destructive" });
        setIsPageLoading(false);
        return;
      }
      
      if (mcqIdsToConsider.length === 0) {
        toast({ title: "No MCQs", description: "No MCQs found locally for the selected category.", variant: "default" });
        setIsPageLoading(false);
        return;
      }
      
      // Shuffle and fetch full MCQ objects from local DB
      const finalMcqIdsForQuiz = shuffleArray(mcqIdsToConsider);
      mcqsToLoad = await getOfflineMcqs(finalMcqIdsForQuiz);
      
      // Note: Offline mode does not support 'incorrect' mode filtering yet.
      if (mode === 'incorrect') {
        toast({ title: "Feature Restricted", description: "Attempt Incorrect is not supported in offline mode.", variant: "default" });
        setIsPageLoading(false);
        return;
      }

    } else {
      // --- ONLINE MODE ---
      let baseMcqQuery = supabase.from('mcqs').select('id, is_trial_mcq');

      if (selectedCategoryId === ALL_TRIAL_MCQS_ID) {
        baseMcqQuery = baseMcqQuery.eq('is_trial_mcq', true);
      } else if (selectedCategoryId === UNCATEGORIZED_ID) {
        const { data: linkedMcqIdsData } = await supabase.from('mcq_category_links').select('mcq_id');
        const categorizedMcqIds = Array.from(new Set(linkedMcqIdsData?.map(link => link.mcq_id) || []));
        if (categorizedMcqIds.length > 0) {
          baseMcqQuery = baseMcqQuery.not('id', 'in', `(${categorizedMcqIds.join(',')})`);
        }
      } else if (selectedCategoryId) {
        const { data: categoryLinkedMcqIdsData, error: categoryLinkedIdsError } = await supabase
          .from('mcq_category_links')
          .select('mcq_id')
          .eq('category_id', selectedCategoryId);
        if (categoryLinkedIdsError) throw categoryLinkedIdsError;
        const categoryLinkedMcqIds = Array.from(new Set(categoryLinkedMcqIdsData?.map(link => link.mcq_id) || []));
        baseMcqQuery = baseMcqQuery.in('id', categoryLinkedMcqIds);
      }

      if (sessionIsTrial && selectedCategoryId !== ALL_TRIAL_MCQS_ID) {
        baseMcqQuery = baseMcqQuery.eq('is_trial_mcq', true);
      }

      const { data: initialMcqIdsData, error: initialMcqIdsError } = await baseMcqQuery;
      if (initialMcqIdsError) throw initialMcqIdsError;
      mcqIdsToConsider = initialMcqIdsData?.map(m => m.id) || [];

      if (mode === 'incorrect' && user && isSubscribed) {
        const { data: incorrectAttempts } = await supabase
          .from('user_quiz_attempts')
          .select('mcq_id')
          .eq('user_id', user.id)
          .in('mcq_id', mcqIdsToConsider)
          .eq('is_correct', false);
        const incorrectMcqIds = Array.from(new Set(incorrectAttempts?.map(attempt => attempt.mcq_id) || []));
        if (incorrectMcqIds.length === 0) {
          toast({ title: "No Incorrect MCQs", description: "You have no incorrect answers in this selection to re-attempt.", variant: "default" });
          setIsPageLoading(false);
          return;
        }
        mcqIdsToConsider = incorrectMcqIds;
      }

      if (mcqIdsToConsider.length === 0) {
        toast({ title: "No MCQs", description: "No MCQs available for the selected criteria.", variant: "default" });
        setIsPageLoading(false);
        return;
      }

      let finalMcqIdsForQuiz = shuffleArray(mcqIdsToConsider);
      if (sessionIsTrial && selectedCategoryId !== ALL_TRIAL_MCQS_ID) {
        finalMcqIdsForQuiz = finalMcqIdsForQuiz.slice(0, Math.min(finalMcqIdsForQuiz.length, TRIAL_MCQ_LIMIT));
      }

      const { data: mcqsData, error: mcqsError } = await supabase
        .from('mcqs')
        .select(`
          *,
          mcq_category_links (
            category_id,
            categories (name)
          )
        `)
        .in('id', finalMcqIdsForQuiz);

      if (mcqsError) throw mcqsError;
      
      mcqsToLoad = (mcqsData || []).map((mcq: any) => ({
        ...mcq,
        category_links: mcq.mcq_category_links?.map((link: any) => ({
          category_id: link.category_id,
          category_name: link.categories?.name || null,
        })) || [],
      }));
      
      mcqsToLoad = finalMcqIdsForQuiz.map(id => mcqsToLoad.find(mcq => mcq.id === id)).filter((mcq): mcq is MCQ => mcq !== undefined);
    }

    if (mcqsToLoad.length === 0) {
      toast({ title: "No MCQs", description: "No questions available for this quiz session.", variant: "default" });
      setIsPageLoading(false);
      return;
    }

    setQuizQuestions(mcqsToLoad);
    setShowCategorySelection(false);
    setIsPageLoading(false);
    
    const initialUserAnswers = new Map<string, UserAnswerData>();
    mcqsToLoad.forEach(mcq => {
      initialUserAnswers.set(mcq.id, { selectedOption: null, isCorrect: null, submitted: false });
    });
    setUserAnswers(initialUserAnswers);
    setSelectedAnswer(null);

    if (user && !isOffline) {
      const savedSessionResult = await saveQuizState(
        null,
        selectedCategoryId,
        mcqsToLoad,
        initialUserAnswers,
        0,
        sessionIsTrial,
        user.id,
        false
      );
      if (savedSessionResult) {
        const categoryName = selectedCategoryId === ALL_TRIAL_MCQS_ID
          ? 'All Trial MCQs'
          : selectedCategoryId === UNCATEGORIZED_ID
            ? 'Uncategorized'
            : categoryStats.find(c => c.id === selectedCategoryId)?.name || 'Unknown Category';

        setActiveSavedQuizzes(prev => [
          {
            dbSessionId: savedSessionResult.id,
            categoryId: selectedCategoryId,
            mcqs: mcqsToLoad,
            userAnswers: new Map(Object.entries(savedSessionResult.sessionData.user_answers_json)),
            currentQuestionIndex: savedSessionResult.sessionData.current_question_index,
            isTrialActiveSession: sessionIsTrial,
            userId: user.id,
            categoryName: categoryName,
            isOffline: false,
          },
          ...prev,
        ]);
      }
    }

    if (user && sessionIsTrial && !hasTakenTrial) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ trial_taken: true })
        .eq('id', user.id);
      if (updateError) {
        console.error('Error marking trial_taken:', updateError);
        toast({ title: "Error", description: "Failed to update trial status.", variant: "destructive" });
      } else {
        toast({ title: "Trial Started!", description: `You have started your free trial. Enjoy ${TRIAL_MCQ_LIMIT} trial questions!`, variant: "default" });
      }
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
        // --- OFFLINE RESUME ---
        const mcqIds = loadedSession.mcqs.map(m => m.id);
        mcqsData = await getOfflineMcqs(mcqIds);
        
        if (mcqsData.length === 0) {
            toast({ title: "Error", description: "Failed to load offline questions. They might have been deleted.", variant: "destructive" });
            setIsPageLoading(false);
            return;
        }
        // Reorder fetched MCQs to match mcq_ids_order
        mcqsData = loadedSession.mcqs.map(loadedMcq => 
            mcqsData.find(fetchedMcq => fetchedMcq.id === loadedMcq.id)
        ).filter((mcq): mcq is MCQ => mcq !== undefined);

    } else {
        // --- ONLINE RESUME ---
        let mcqsQuery = supabase
          .from('mcqs')
          .select(`
            id, question_text, option_a, option_b, option_c, option_d,
            correct_answer, explanation_id, difficulty, is_trial_mcq,
            mcq_category_links (category_id, categories (name))
          `)
          .in('id', loadedSession.mcqs.map(m => m.id));

        const { data: onlineMcqsData, error: mcqsError } = await mcqsQuery;

        if (mcqsError) {
          console.error('Error fetching MCQs for resumed session:', mcqsError);
          toast({ title: "Error", description: "Failed to load quiz questions for your saved session.", variant: "destructive" });
          setIsPageLoading(false);
          return;
        }

        const formattedMcqs: MCQ[] = (onlineMcqsData || []).map((mcq: any) => ({
          ...mcq,
          category_links: mcq.mcq_category_links?.map((link: any) => ({
            category_id: link.category_id,
            category_name: link.categories?.name || null,
          })) || [],
        }));

        // Reorder fetched MCQs to match mcq_ids_order
        mcqsData = loadedSession.mcqs.map(loadedMcq => 
          formattedMcqs.find(fetchedMcq => fetchedMcq.id === loadedMcq.id)
        ).filter((mcq): mcq is MCQ => mcq !== undefined);
    }

    setQuizQuestions(mcqsData);
    setUserAnswers(loadedSession.userAnswers);
    setCurrentQuestionIndex(loadedSession.currentQuestionIndex);

    const currentMcqFromSaved = mcqsData[loadedSession.currentQuestionIndex];
    const currentAnswerDataFromSaved = loadedSession.userAnswers.get(currentMcqFromSaved.id);
    setSelectedAnswer(currentAnswerDataFromSaved?.selectedOption || null);
    setFeedback(currentAnswerDataFromSaved?.submitted ? (currentAnswerDataFromSaved.isCorrect ? 'Correct!' : `Incorrect. The correct answer was ${currentMcqFromSaved.correct_answer}.`) : null);
    setShowExplanation(currentAnswerDataFromSaved?.submitted || false);
    if (currentAnswerDataFromSaved?.submitted && currentMcqFromSaved.explanation_id) {
      fetchExplanation(currentMcqFromSaved.explanation_id);
    }

    setShowCategorySelection(false);
    setIsPageLoading(false);
    toast({
      title: "Quiz Resumed",
      description: "Continuing from where you left off.",
      duration: 3000,
    });
  }, [fetchExplanation, toast, getOfflineMcqs, isDbInitialized]);

  // Effect to update database whenever quiz state changes
  useEffect(() => {
    if (user && currentDbSessionId && !showCategorySelection && quizQuestions.length > 0 && !showResults && currentQuizCategoryId && !isOfflineQuiz) {
      saveQuizState(
        currentDbSessionId,
        currentQuizCategoryId,
        quizQuestions,
        userAnswers,
        currentQuestionIndex,
        isTrialActiveSession,
        user.id,
        isOfflineQuiz
      );
    }
  }, [quizQuestions, userAnswers, currentQuestionIndex, isTrialActiveSession, showCategorySelection, showResults, saveQuizState, user, currentQuizCategoryId, currentDbSessionId, isOfflineQuiz]);


  const handleResetProgress = async (categoryId: string) => {
    if (!user) {
      toast({ title: "Error", description: "You must be logged in to reset progress.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Are you sure you want to delete your quiz progress for this category? This action cannot be undone.")) {
      return;
    }

    setIsPageLoading(true);
    try {
      // 1. Delete user quiz attempts from the database
      const { error: dbError } = await supabase
        .from('user_quiz_attempts')
        .delete()
        .eq('user_id', user.id)
        .eq('category_id', categoryId);

      if (dbError) {
        throw dbError;
      }

      // 2. Clear all associated saved quiz sessions from the database
      const { error: deleteSessionsError } = await supabase
        .from('user_quiz_sessions')
        .delete()
        .eq('user_id', user.id)
        .eq('category_id', categoryId);

      if (deleteSessionsError) {
        throw deleteSessionsError;
      }

      toast({ title: "Success", description: "Quiz progress reset successfully." });
      fetchQuizOverview(); // Refresh overview data including category stats and saved sessions
    } catch (error: any) {
      console.error('Error resetting progress:', error);
      toast({ title: "Error", description: `Failed to reset progress: ${error.message}`, variant: "destructive" });
    } finally {
      setIsPageLoading(false);
    }
  };

  const handleOptionSelect = useCallback((value: string) => {
    if (currentMcq) {
      setSelectedAnswer(value);
      setUserAnswers((prev: Map<string, UserAnswerData>) => {
        const newMap = new Map(prev);
        newMap.set(currentMcq.id, { selectedOption: value, isCorrect: null, submitted: false });
        return newMap;
      });
      setFeedback(null);
      setShowExplanation(false);
    }
  }, [currentMcq, setUserAnswers]);

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !currentMcq) return;

    setIsSubmittingAnswer(true);
    const isCorrect = selectedAnswer === currentMcq.correct_answer;
    if (isCorrect) {
      setFeedback('Correct!');
    } else {
      setFeedback(`Incorrect. The correct answer was ${currentMcq.correct_answer}.`);
    }
    setShowExplanation(true);

    // Update userAnswers with submission status and correctness
    setUserAnswers((prev: Map<string, UserAnswerData>) => {
      const newMap = new Map(prev);
      newMap.set(currentMcq.id, { selectedOption: selectedAnswer, isCorrect: isCorrect, submitted: true });
      return newMap;
    });

    if (user && !isOfflineQuiz) { // Only record attempts if user is logged in AND online
      try {
        const firstCategoryLink = currentMcq.category_links?.[0];
        const { error } = await supabase.from('user_quiz_attempts').insert({
          user_id: user.id,
          mcq_id: currentMcq.id,
          category_id: firstCategoryLink?.category_id || null,
          selected_option: selectedAnswer,
          is_correct: isCorrect,
        });

        if (error) {
          console.error('Error recording quiz attempt:', error);
          toast({
            title: "Error",
            description: `Failed to record quiz attempt: ${error.message}`,
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error('Unhandled error recording quiz attempt:', error);
        toast({
          title: "Error",
          description: `An unexpected error occurred while recording your attempt: ${error.message}`,
          variant: "destructive",
        });
      }
    } else {
      console.log(isOfflineQuiz ? "Offline quiz, skipping remote attempt recording." : "Guest user, not recording quiz attempt.");
    }
    
    setIsSubmittingAnswer(false);
    if (currentMcq.explanation_id) {
      fetchExplanation(currentMcq.explanation_id);
    }
  };

  const handleNextQuestion = () => {
    if (isTrialActiveSession && currentQuestionIndex + 1 >= TRIAL_MCQ_LIMIT) {
      toast({ title: "Trial Limit Reached", description: `You have reached the limit of ${TRIAL_MCQ_LIMIT} trial questions. Please subscribe to continue.`, variant: "default" });
      submitFullQuiz();
      return;
    }

    if (currentQuestionIndex < quizQuestions.length - 1) {
      const nextQuestion = quizQuestions[currentQuestionIndex + 1];
      setCurrentQuestionIndex((prev) => prev + 1);
      const nextAnswerData = userAnswers.get(nextQuestion?.id || '');
      setSelectedAnswer(nextAnswerData?.selectedOption || null);
      setFeedback(nextAnswerData?.submitted ? (nextAnswerData.isCorrect ? 'Correct!' : `Incorrect. The correct answer was ${nextQuestion.correct_answer}.`) : null);
      setShowExplanation(nextAnswerData?.submitted || false);
      if (nextAnswerData?.submitted && nextQuestion.explanation_id) {
        fetchExplanation(nextQuestion.explanation_id);
      }
    } else {
      submitFullQuiz();
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      const prevQuestion = quizQuestions[currentQuestionIndex - 1];
      setCurrentQuestionIndex((prev) => prev - 1);
      const prevAnswerData = userAnswers.get(prevQuestion?.id || '');
      setSelectedAnswer(prevAnswerData?.selectedOption || null);
      setFeedback(prevAnswerData?.submitted ? (prevAnswerData.isCorrect ? 'Correct!' : `Incorrect. The correct answer was ${prevQuestion.correct_answer}.`) : null);
      setShowExplanation(prevAnswerData?.submitted || false);
      if (prevAnswerData?.submitted && prevQuestion.explanation_id) {
        fetchExplanation(prevQuestion.explanation_id);
      }
    }
  };

  const goToQuestion = useCallback((index: number) => {
    if (index >= 0 && index < quizQuestions.length) {
      setCurrentQuestionIndex(index);
      const targetMcq = quizQuestions[index];
      const targetAnswerData = userAnswers.get(targetMcq.id);
      setSelectedAnswer(targetAnswerData?.selectedOption || null);
      setFeedback(targetAnswerData?.submitted ? (targetAnswerData.isCorrect ? 'Correct!' : `Incorrect. The correct answer was ${targetMcq.correct_answer}.`) : null);
      setShowExplanation(targetAnswerData?.submitted || false);
      if (targetAnswerData?.submitted && targetMcq.explanation_id) {
        fetchExplanation(targetMcq.explanation_id);
      }
    }
  }, [quizQuestions, userAnswers, fetchExplanation]);

  const submitFullQuiz = async () => {
    let correctCount = 0;
    const explanationPromises: Promise<MCQExplanation | null>[] = [];
    const mcqExplanationIds = new Set<string>();

    for (const mcq of quizQuestions) {
      const userAnswerData = userAnswers.get(mcq.id);
      const isCorrect = userAnswerData?.isCorrect;
      if (isCorrect) {
        correctCount++;
      }
      if (mcq.explanation_id && !mcqExplanationIds.has(mcq.explanation_id)) {
        mcqExplanationIds.add(mcq.explanation_id);
        explanationPromises.push(fetchExplanation(mcq.explanation_id));
      }
    }

    setScore(correctCount);
    await Promise.all(explanationPromises);
    setShowResults(true);
    setIsPageLoading(false);
    
    if (currentDbSessionId && !isOfflineQuiz) {
      clearSpecificQuizState(currentDbSessionId);
    }
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

      if (insertError) {
        throw insertError;
      }

      const { error: emailError } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'ADMIN_EMAIL',
          subject: `New MCQ Feedback from ${user.email}`,
          body: `User ${user.email} (${user.id}) submitted feedback for MCQ ID: ${currentMcq.id}.<br/><br/>
                 Question: ${currentMcq.question_text}<br/>
                 Correct Answer: ${currentMcq.correct_answer}<br/>
                 Suggested Category: ${currentQuizCategoryId || 'N/A'}<br/>
                 Explanation: ${feedbackText.trim()}<br/><br/>
                 Review in admin panel (future feature).`,
        },
      });

      if (emailError) {
        console.error('Error sending feedback email:', emailError);
        toast({ title: "Warning", description: "Feedback submitted, but failed to send email notification.", variant: "default" });
      } else {
        toast({ title: "Feedback Submitted!", description: "Thank you for your notes. We will review them shortly.", variant: "default" });
      }

      setFeedbackText('');
      setIsFeedbackDialogOpen(false);
    } catch (error: any) {
      console.error("Error submitting feedback:", error);
      toast({ title: "Error", description: `Failed to submit feedback: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleBackToSelection = () => {
    const isCurrentQuizSaved = currentDbSessionId && activeSavedQuizzes.some(session => session.dbSessionId === currentDbSessionId);

    if (!isCurrentQuizSaved && quizQuestions.length > 0 && !showResults) {
      if (!window.confirm("Are you sure you want to end this quiz session and go back to category selection? Your current progress will be lost.")) {
        return;
      }
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
    setIsOfflineQuiz(false); // Reset offline flag
    fetchQuizOverview();
  };

  const handleGoToDashboard = () => {
    const isCurrentQuizSaved = currentDbSessionId && activeSavedQuizzes.some(session => session.dbSessionId === currentDbSessionId);

    if (!isCurrentQuizSaved && quizQuestions.length > 0 && !showResults) {
      if (!window.confirm("Are you sure you want to leave this quiz session? Your current unsaved progress will be lost.")) {
        return;
      }
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
    setIsOfflineQuiz(false); // Reset offline flag
    navigate('/user/dashboard');
  };

  const filteredCategories = categoryStats.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!hasCheckedInitialSession || isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 pt-16">
        <p className="text-gray-700 dark:text-gray-300">Loading quiz overview...</p>
      </div>
    );
  }

  if (showSubscriptionPrompt) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
        <Card className="w-full max-w-2xl text-center">
          <CardHeader>
            <CardTitle className="text-2xl">Trial Completed!</CardTitle>
            <CardDescription>
              You have completed your free trial or already used it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg">To unlock all questions and features, please subscribe.</p>
            <Button onClick={() => navigate('/user/subscriptions')} className="w-full sm:w-auto">
              View Subscription Plans
            </Button>
            <Button onClick={() => setShowCategorySelection(true)} variant="outline" className="w-full sm:w-auto">
              Back to Quiz Selection
            </Button>
          </CardContent>
          <MadeWithDyad />
        </Card>
      </div>
    );
  }

  if (showCategorySelection) {
    const isSubscribed = user?.has_active_subscription;
    const isGuestOrNotSubscribed = isGuest || (!isSubscribed && !user?.trial_taken);
    const hasTakenTrial = !isGuest && user?.trial_taken;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Select a Quiz Category</CardTitle>
            <CardDescription>Choose a category to start your quiz and view your performance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeSavedQuizzes.length > 0 && !isGuest && (
              <Card className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
                <CardHeader>
                  <CardTitle className="text-blue-700 dark:text-blue-300">Continue Your Quizzes</CardTitle>
                  <CardDescription className="text-blue-600 dark:text-blue-400">
                    Pick up where you left off in any of your saved quiz sessions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeSavedQuizzes.map((savedState) => {
                    const progress = savedState.currentQuestionIndex + 1;
                    const total = savedState.mcqs.length;

                    return (
                      <div key={savedState.dbSessionId} className="flex flex-col sm:flex-row items-center justify-between p-3 border rounded-md bg-white dark:bg-gray-800">
                        <div>
                          <p className="font-semibold">{savedState.categoryName} {savedState.isOffline && <WifiOff className="h-4 w-4 inline ml-1 text-muted-foreground" />}</p>
                          <p className="text-sm text-muted-foreground">Question {progress} of {total}</p>
                        </div>
                        <div className="flex gap-2 mt-2 sm:mt-0">
                          <Button onClick={() => continueQuizSession(savedState)} size="sm">Continue</Button>
                          {!savedState.isOffline && ( // Only allow clearing remote sessions
                            <Button onClick={() => clearSpecificQuizState(savedState.dbSessionId)} variant="outline" size="sm">Clear</Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {isGuestOrNotSubscribed && allTrialMcqsCount > 0 && (
              <Card className="mb-6 border-green-500 bg-green-50 dark:bg-green-950">
                <CardHeader>
                  <CardTitle className="text-green-700 dark:text-green-300">Start Your Free Trial</CardTitle>
                  <CardDescription className="text-green-600 dark:text-green-400">
                    Attempt {TRIAL_MCQ_LIMIT} questions from our entire trial question bank.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-lg font-semibold mb-4">
                    Total Trial MCQs Available: {Math.min(allTrialMcqsCount, TRIAL_MCQ_LIMIT)}
                  </p>
                  <Button
                    onClick={() => startQuizSession(ALL_TRIAL_MCQS_ID, 'random', false)}
                    className="w-full"
                  >
                    Start Trial Quiz ({Math.min(allTrialMcqsCount, TRIAL_MCQ_LIMIT)} Questions)
                  </Button>
                </CardContent>
              </Card>
            )}

            <Input
              placeholder="Search categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mb-4"
            />
            {filteredCategories.length === 0 ? (
              <p className="text-center text-gray-600 dark:text-gray-400">
                No categories found matching your search.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCategories.map((cat) => {
                  const isSubscribed = user?.has_active_subscription;
                  const isGuestOrNotSubscribed = isGuest || (!isSubscribed && !user?.trial_taken);
                  const showSubscribePrompt = hasTakenTrial && !isSubscribed;

                  const totalCount = cat.total_mcqs;
                  const accessibleCount = cat.total_trial_mcqs;
                  const offlineCount = cat.offline_count;
                  
                  let descriptionText = `${totalCount} MCQs available`;
                  if (!isSubscribed && totalCount > accessibleCount) {
                    descriptionText += ` (${accessibleCount} trial, ${totalCount - accessibleCount} premium locked)`;
                  }

                  let buttonText = "Start Quiz";
                  let buttonDisabled = false;
                  
                  if (showSubscribePrompt) {
                    buttonText = "Subscribe to Start";
                    buttonDisabled = true;
                  } else if (isSubscribed && totalCount > 0) {
                    buttonText = "Start Quiz";
                    buttonDisabled = false;
                  } else if (isGuestOrNotSubscribed && accessibleCount > 0) {
                    buttonText = "Start Trial Quiz";
                    buttonDisabled = false;
                  } else {
                    buttonText = "No MCQs Available";
                    buttonDisabled = true;
                  }
                  
                  const savedQuiz = activeSavedQuizzes.find(session => session.categoryId === cat.id);
                  if (savedQuiz) {
                      buttonText = "Continue Quiz";
                      buttonDisabled = false;
                  }

                  const showSubscriptionCTA = !isSubscribed && totalCount > accessibleCount;


                  return (
                    <Card key={cat.id} className="flex flex-col">
                      <CardHeader>
                        <CardTitle className="text-lg">{cat.name}</CardTitle>
                        <CardDescription>
                          {descriptionText}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow space-y-2 text-sm">
                        {!isGuest && (
                          <>
                            <p>Attempts: {cat.user_attempts}</p>
                            <p>Correct: {cat.user_correct}</p>
                            <p>Incorrect: {cat.user_incorrect}</p>
                            <p>Accuracy: {cat.user_accuracy}</p>
                          </>
                        )}
                        {isNative && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <WifiOff className="h-3 w-3" /> Offline MCQs: {offlineCount}
                            </p>
                        )}
                        {showSubscriptionCTA && (
                          <div className="pt-2">
                            <Link to="/subscription">
                              <Button variant="link" className="p-0 h-auto text-red-500 dark:text-red-400 hover:underline text-sm">
                                Subscribe to get full access!
                              </Button>
                            </Link>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter className="flex flex-col gap-2">
                        {savedQuiz ? (
                          <Button
                            onClick={() => continueQuizSession(savedQuiz)}
                            className="w-full"
                          >
                            Continue Quiz
                          </Button>
                        ) : (
                          <Button
                            onClick={() => startQuizSession(cat.id, 'random', false)}
                            className="w-full"
                            disabled={buttonDisabled}
                          >
                            {buttonText}
                          </Button>
                        )}
                        <Button
                          onClick={() => startQuizSession(cat.id, 'incorrect', false)}
                          className="w-full"
                          variant="secondary"
                          disabled={cat.user_incorrect === 0 || !isSubscribed || isTrialActiveSession}
                        >
                          Attempt Incorrect ({cat.user_incorrect})
                        </Button>
                        
                        {/* OFFLINE BUTTON */}
                        {isNative && offlineCount > 0 && (
                            <Button
                                onClick={() => startQuizSession(cat.id, 'random', true)}
                                className="w-full"
                                variant="outline"
                            >
                                <WifiOff className="h-4 w-4 mr-2" /> Start Offline Quiz ({offlineCount})
                            </Button>
                        )}

                        {showSubscribePrompt && (
                          <Link to="/user/subscriptions" className="w-full">
                            <Button variant="link" className="w-full text-red-500 dark:text-red-400 hover:underline">
                              Subscribe to unlock this category.
                            </Button>
                          </Link>
                        )}
                        {!isGuest && (
                          <Button
                            onClick={() => handleResetProgress(cat.id)}
                            className="w-full"
                            variant="destructive"
                            disabled={cat.user_attempts === 0 || cat.id === ALL_TRIAL_MCQS_ID}
                          >
                            <RotateCcw className="h-4 w-4 mr-2" /> Reset Progress
                          </Button>
                        )}
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  if (quizQuestions.length === 0 && !isPageLoading && !showCategorySelection && !showResults) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>No MCQs Found</CardTitle>
            <CardDescription>
              It looks like there are no MCQs for the selected category.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Please try a different selection or add more MCQs.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={handleBackToSelection}>Go Back to Selection</Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  if (!currentMcq) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 pt-16">
        <p className="text-gray-700 dark:text-gray-300">Loading current question...</p>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
        <div className="flex flex-col md:flex-row w-full max-w-6xl">
          <Card className="flex-1 order-first md:order-last">
            <CardHeader>
              <CardTitle className="text-3xl">Quiz Results</CardTitle>
              <CardDescription>Review your performance on this quiz session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center text-2xl font-bold">
                Your Score: {score} / {quizQuestions.length}
              </div>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto p-2 border rounded-md">
                {quizQuestions.map((mcq, index) => {
                  const userAnswerData = userAnswers.get(mcq.id);
                  const userAnswer = userAnswerData?.selectedOption;
                  const isCorrect = userAnswerData?.isCorrect;
                  
                  // Get explanation from local state (which includes offline data if applicable)
                  const explanation = explanations.get(mcq.explanation_id || '');

                  return (
                    <div key={mcq.id} className="border-b pb-4 mb-4 last:border-b-0">
                      <p className="font-semibold text-lg">
                        {index + 1}. {mcq.question_text}
                      </p>
                      <ul className="list-disc list-inside ml-4 mt-2">
                        {['A', 'B', 'C', 'D'].map((optionKey) => {
                          const optionText = mcq[`option_${optionKey.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
                          const isSelected = userAnswer === optionKey;
                          const isCorrectOption = mcq.correct_answer === optionKey;

                          let className = "";
                          if (isSelected && isCorrect) {
                            className = "text-green-600 font-medium";
                          } else if (isSelected && !isCorrect) {
                            className = "text-red-600 font-medium";
                          } else if (isCorrectOption) {
                            className = "text-green-600 font-medium";
                          }

                          return (
                            <li key={optionKey} className={className}>
                              {optionKey}. {optionText as string}
                              {isSelected && !isCorrect && <span className="ml-2">(Your Answer)</span>}
                              {isCorrectOption && <span className="ml-2">(Correct Answer)</span>}
                            </li>
                          );
                        })}
                      </ul>
                      {explanation && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-md text-sm">
                          <h4 className="font-semibold">Explanation:</h4>
                          <p>{explanation.explanation_text}</p>
                          {explanation.image_url && (
                            <img src={explanation.image_url} alt="Explanation" className="mt-4 max-w-full h-auto rounded-md" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter className="flex justify-center gap-4">
              <Button onClick={() => { setShowCategorySelection(true); fetchQuizOverview(); }}>Back to Categories</Button>
              <Link to="/user/dashboard">
                <Button>Go to Dashboard</Button>
              </Link>
            </CardFooter>
          </Card>
          <QuizNavigator
            mcqs={quizQuestions}
            userAnswers={userAnswers}
            currentQuestionIndex={currentQuestionIndex}
            goToQuestion={goToQuestion}
            showResults={true}
            score={0}
          />
        </div>
        <MadeWithDyad />
      </div>
    );
  }

  const currentAnswerData = userAnswers.get(currentMcq.id);
  const isAnswered = currentAnswerData?.selectedOption !== null;
  const isSubmitted = currentAnswerData?.submitted;
  const isLastQuestion = currentQuestionIndex === quizQuestions.length - 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4 pt-16">
      {quizQuestions.length > 0 && !showCategorySelection && !showResults && (
        <div className="w-full max-w-6xl mb-4 text-center">
          <Card className="p-4">
            <p className="text-lg font-semibold">
              Current Accuracy: {currentCorrectnessPercentage} ({currentCorrectCount} / {quizQuestions.length} Answered Correctly)
            </p>
          </Card>
        </div>
      )}
      <div className="flex flex-col md:flex-row w-full max-w-6xl">
        <Card className="flex-1 order-first md:order-last">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-xl">Question {currentQuestionIndex + 1} / {quizQuestions.length}</CardTitle>
              {isTrialActiveSession && (
                <CardDescription className="text-sm text-blue-500 dark:text-blue-400">
                  Trial Mode ({currentQuestionIndex + 1} / {TRIAL_MCQ_LIMIT} questions)
                </CardDescription>
              )}
              {isOfflineQuiz && (
                <CardDescription className="text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                  <WifiOff className="h-4 w-4" /> OFFLINE MODE
                </CardDescription>
              )}
              {currentMcq?.difficulty && (
                <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
                  Difficulty: {currentMcq.difficulty}
                </CardDescription>
              )}
            </div>
            {!isGuest && !isOfflineQuiz && ( // Disable bookmarking in offline mode
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleBookmark}
                disabled={isBookmarkLoading}
                className="text-primary hover:text-primary-foreground/90"
              >
                {isBookmarked ? <BookmarkCheck className="h-6 w-6 fill-current" /> : <Bookmark className="h-6 w-6" />}
                <span className="sr-only">{isBookmarked ? "Remove bookmark" : "Add bookmark"}</span>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold mb-4">{currentMcq?.question_text}</p>
            <RadioGroup
              onValueChange={handleOptionSelect}
              value={selectedAnswer || ""}
              className="space-y-2"
              disabled={isSubmitted}
            >
              {['A', 'B', 'C', 'D'].map((optionKey) => {
                const optionText = currentMcq?.[`option_${optionKey.toLowerCase()}` as 'option_a' | 'option_b' | 'option_c' | 'option_d'];
                const userSelectedThisOptionWhenSubmitted = currentAnswerData?.selectedOption === optionKey;
                const isCorrectOption = currentMcq.correct_answer === optionKey;

                return (
                  <div
                    key={optionKey}
                    className={cn(
                      "flex items-center space-x-2 p-2 rounded-md cursor-pointer transition-colors duration-200",
                      isSubmitted && userSelectedThisOptionWhenSubmitted && currentAnswerData?.isCorrect && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                      isSubmitted && userSelectedThisOptionWhenSubmitted && !currentAnswerData?.isCorrect && "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
                      isSubmitted && !userSelectedThisOptionWhenSubmitted && isCorrectOption && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                      !isSubmitted && selectedAnswer === optionKey && "bg-accent text-accent-foreground dark:bg-accent dark:text-accent-foreground"
                    )}
                    onClick={() => !isSubmitted && handleOptionSelect(optionKey)}
                  >
                    <RadioGroupItem value={optionKey} id={`option-${optionKey}`} />
                    <Label
                      htmlFor={`option-${optionKey}`}
                      className={cn(
                        "cursor-pointer flex-grow",
                        isSubmitted && userSelectedThisOptionWhenSubmitted && currentAnswerData?.isCorrect && "text-green-700 dark:text-green-300",
                        isSubmitted && userSelectedThisOptionWhenSubmitted && !currentAnswerData?.isCorrect && "text-red-700 dark:text-red-300",
                        isSubmitted && !userSelectedThisOptionWhenSubmitted && isCorrectOption && "text-green-700 dark:text-green-300",
                        !isSubmitted && selectedAnswer === optionKey && "text-accent-foreground dark:text-accent-foreground"
                      )}
                    >
                      {`${optionKey}. ${optionText as string}`}
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>

            {feedback && (
              <p className={`mt-4 text-lg font-semibold flex items-center gap-2 ${feedback.startsWith('Correct') ? 'text-green-600' : 'text-red-600'}`}>
                {feedback.startsWith('Correct') ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                {feedback}
              </p>
            )}

            {showExplanation && explanations.has(currentMcq.explanation_id || '') && (
              <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
                <h3 className="text-lg font-semibold mb-2">Explanation:</h3>
                <p className="text-gray-800 dark:text-gray-200">{explanations.get(currentMcq.explanation_id || '')?.explanation_text}</p>
                {explanations.get(currentMcq.explanation_id || '')?.image_url && (
                  <img src={explanations.get(currentMcq.explanation_id || '')?.image_url || ''} alt="Explanation" className="mt-4 max-w-full h-auto rounded-md" />
                )}
                {user && !isOfflineQuiz && (
                  <Button
                    variant="outline"
                    className="mt-4 w-full"
                    onClick={() => setIsFeedbackDialogOpen(true)}
                  >
                    <MessageSquareText className="h-4 w-4 mr-2" /> Add Notes or Feedback
                  </Button>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between gap-2">
            <div className="flex gap-2">
              <Button onClick={handleBackToSelection} variant="outline" disabled={isSubmittingAnswer}>
                Back to Selection
              </Button>
              <Button onClick={handleGoToDashboard} variant="outline" disabled={isSubmittingAnswer}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Go to Dashboard
              </Button>
              <Button onClick={handleSaveProgress} variant="secondary" disabled={isSubmittingAnswer || !currentQuizCategoryId || !user || isOfflineQuiz}>
                <Save className="h-4 w-4 mr-2" /> Save Progress
              </Button>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0 || isSubmittingAnswer} variant="outline">
                Previous
              </Button>
              {!isSubmitted ? (
                <Button onClick={handleSubmitAnswer} disabled={!isAnswered || isSubmittingAnswer}>
                  {isSubmittingAnswer ? "Submitting..." : "Submit Answer"}
                </Button>
              ) : (
                <Button onClick={handleNextQuestion} disabled={isSubmittingAnswer}>
                  {isLastQuestion ? "Submit Quiz" : "Next Question"}
                </Button>
              )}
            </div>
          </CardFooter>

          <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Notes or Feedback for this MCQ</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <p className="text-sm text-muted-foreground">
                  Your feedback helps us improve the questions and explanations.
                </p>
                <Textarea
                  placeholder="Write your notes or feedback here..."
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={5}
                  disabled={isSubmittingFeedback}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsFeedbackDialogOpen(false)} disabled={isSubmittingFeedback}>Cancel</Button>
                <Button onClick={handleSubmitFeedback} disabled={isSubmittingFeedback || !feedbackText.trim()}>
                  {isSubmittingFeedback ? "Submitting..." : "Submit Feedback"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Card>
        <QuizNavigator
          mcqs={quizQuestions}
          userAnswers={userAnswers}
          currentQuestionIndex={currentQuestionIndex}
          goToQuestion={goToQuestion}
          showResults={false}
          score={0}
        />
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default QuizPage;