"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';
import { useSession } from '@/components/SessionContextProvider';
import { useNavigate } from 'react-router-dom';
import { TimerIcon, Pause, Play, SkipForward, Bookmark, BookmarkCheck, Loader2, Trash2, CheckCircle2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { McqCategoryLink } from '@/components/mcq-columns'; 
import { Input } from '@/components/ui/input'; 
import QuizNavigator from '@/components/QuizNavigator'; 
import { useBookmark } from '@/hooks/use-bookmark'; 
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import SubscribePromptDialog from '@/components/SubscribePromptDialog';
import { differenceInDays, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MCQ {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation_id: string | null;
  difficulty: string | null;
  is_trial_mcq: boolean | null;
  category_links: McqCategoryLink[];
}

interface MCQExplanation {
  id: string;
  explanation_text: string;
  image_url: string | null;
}

interface Category {
  id: string;
  name: string;
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
  test_duration_seconds: number | null;
  remaining_time_seconds: number | null;
  skipped_mcq_ids: string[] | null;
  created_at: string;
  updated_at: string;
}

interface LoadedTestSession {
  dbSessionId: string;
  categoryIds: string[];
  categoryNames: string[];
  mcqs: MCQ[];
  userAnswers: Map<string, UserAnswerData>;
  currentQuestionIndex: number;
  testDurationSeconds: number;
  remainingTimeSeconds: number;
  skippedMcqIds: Set<string>;
  userId: string;
}

const UNCATEGORIZED_ID = 'uncategorized-mcqs-virtual-id';

const TakeTestPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [numMcqsToSelect, setNumMcqsToSelect] = useState<number>(10);
  const [testDurationMinutes, setTestDurationMinutes] = useState<number>(60);
  const [showConfiguration, setShowConfiguration] = useState(true);
  const [showInstructions, setShowInstructions] = useState(false);

  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, UserAnswerData>>(new Map());
  const [isTestSubmitted, setIsTestSubmitted] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [timer, setTimer] = useState(testDurationMinutes * 60);
  const [score, setScore] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());

  const [isPaused, setIsPaused] = useState(false);
  const [skippedMcqIds, setSkippedMcqIds] = useState<Set<string>>(new Set());

  const [currentDbSessionId, setCurrentDbSessionId] = useState<string | null>(null);
  const [activeSavedTests, setActiveSavedTests] = useState<LoadedTestSession[]>([]);
  
  const [isUpgradeDialogOpen, setIsUpgradeDialogOpen] = useState(false);

  const timerIntervalRef = useRef<number | null>(null);

  const currentMcq = mcqs[currentQuestionIndex];
  const { isBookmarked, toggleBookmark } = useBookmark(currentMcq?.id || null);

  // --- Scroll to top on question change ---
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentQuestionIndex, showConfiguration, showInstructions, showResults]);

  const fetchExplanation = useCallback(async (explanationId: string): Promise<MCQExplanation | null> => {
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
      return null;
    } else if (data) {
      setExplanations(prev => new Map(prev).set(explanationId, data));
      return data;
    }
    return null;
  }, [explanations]);

  const saveTestState = useCallback(async (
    dbSessionId: string | null,
    categoryIds: string[],
    mcqs: MCQ[],
    answers: Map<string, UserAnswerData>,
    index: number,
    duration: number,
    remaining: number,
    skipped: Set<string>,
    currentUserId: string
  ): Promise<{ id: string; sessionData: DbQuizSession } | null> => {
    if (!currentUserId) return null;

    const sessionData = {
      user_id: currentUserId,
      category_id: categoryIds.length > 0 ? categoryIds[0] : null,
      mcq_ids_order: mcqs.map(m => m.id),
      current_question_index: index,
      user_answers_json: Object.fromEntries(answers),
      is_trial_session: false,
      test_duration_seconds: duration,
      remaining_time_seconds: remaining,
      skipped_mcq_ids: Array.from(skipped),
    };

    try {
      if (dbSessionId) {
        const { data, error } = await supabase.from('user_quiz_sessions').update({ ...sessionData, updated_at: new Date().toISOString() }).eq('id', dbSessionId).select('id').single();
        if (error) throw error;
        return { id: data.id, sessionData: { ...sessionData, id: data.id, created_at: '', updated_at: new Date().toISOString() } as DbQuizSession };
      } else {
        const { data, error } = await supabase.from('user_quiz_sessions').insert(sessionData).select('id, created_at, updated_at').single();
        if (error) throw error;
        setCurrentDbSessionId(data.id);
        return { id: data.id, sessionData: { ...sessionData, id: data.id, created_at: data.created_at, updated_at: data.updated_at } as DbQuizSession };
      }
    } catch (error: any) {
      console.error("Error saving test state:", error);
      return null;
    }
  }, []);

  const clearSpecificTestState = useCallback(async (dbSessionId: string) => {
    try {
      const { error } = await supabase.from('user_quiz_sessions').delete().eq('id', dbSessionId);
      if (error) throw error;
      setActiveSavedTests(prev => prev.filter(session => session.dbSessionId !== dbSessionId));
    } catch (error: any) {
      console.error("Error clearing test state:", error);
    }
  }, []);

  const handleSubmitTest = useCallback(async () => {
    if (!user) return;
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsTestSubmitted(true);
    setIsPaused(true);

    let correctCount = 0;
    const attemptsToRecord = [];
    const explanationPromises: Promise<MCQExplanation | null>[] = [];
    const mcqExplanationIds = new Set<string>();
    const finalUserAnswers = new Map(userAnswers);

    for (const mcq of mcqs) {
      const userAnswerData = finalUserAnswers.get(mcq.id);
      const selectedOption = userAnswerData?.selectedOption || null;
      const isCorrect = selectedOption === mcq.correct_answer;
      if (isCorrect) correctCount++;
      finalUserAnswers.set(mcq.id, { selectedOption, isCorrect, submitted: true });
      attemptsToRecord.push({ user_id: user.id, mcq_id: mcq.id, category_id: mcq.category_links?.[0]?.category_id || null, selected_option: selectedOption || 'N/A', is_correct: isCorrect });
      if (mcq.explanation_id && !mcqExplanationIds.has(mcq.explanation_id)) {
        mcqExplanationIds.add(mcq.explanation_id);
        explanationPromises.push(fetchExplanation(mcq.explanation_id));
      }
    }

    setUserAnswers(finalUserAnswers);
    setScore(correctCount);
    await Promise.all(explanationPromises);
    setShowResults(true);

    if (attemptsToRecord.length > 0) {
      const { error } = await supabase.from('user_quiz_attempts').insert(attemptsToRecord);
      if (error) console.error('Error recording test attempts:', error);
    }
    if (currentDbSessionId) clearSpecificTestState(currentDbSessionId);
  }, [user, mcqs, userAnswers, fetchExplanation, currentDbSessionId, clearSpecificTestState]);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      if (user) fetchTestOverview();
      else navigate('/login');
    }
  }, [user, hasCheckedInitialSession]);

  const fetchTestOverview = async () => {
    setIsPageLoading(true);
    const { data: categoriesData } = await supabase.from('categories').select('*');
    setAllCategories([...(categoriesData || []), { id: UNCATEGORIZED_ID, name: 'General Medical Practice' }]);

    if (user) {
      const { data: dbSessions } = await supabase.from('user_quiz_sessions').select('*').eq('user_id', user.id).eq('is_trial_session', false).order('updated_at', { ascending: false });
      if (dbSessions) {
        const loadedSavedTests = dbSessions.map((dbSession: DbQuizSession) => {
          const categoryName = categoriesData?.find(c => c.id === dbSession.category_id)?.name || (dbSession.category_id === UNCATEGORIZED_ID ? 'General Medical Practice' : 'Mixed Categories');
          return {
            dbSessionId: dbSession.id,
            categoryIds: dbSession.category_id ? [dbSession.category_id] : [],
            categoryNames: [categoryName],
            mcqs: dbSession.mcq_ids_order.map((id: string) => ({ id, question_text: 'Loading...', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', explanation_id: null, difficulty: null, is_trial_mcq: null, category_links: [] })),
            userAnswers: new Map(Object.entries(dbSession.user_answers_json)),
            currentQuestionIndex: dbSession.current_question_index,
            testDurationSeconds: dbSession.test_duration_seconds || 0,
            remainingTimeSeconds: dbSession.remaining_time_seconds || 0,
            skippedMcqIds: new Set(dbSession.skipped_mcq_ids || []),
            userId: user.id,
          } as LoadedTestSession;
        });
        setActiveSavedTests(loadedSavedTests);
      }
    }
    setIsPageLoading(false);
  };

  useEffect(() => {
    if (isPageLoading || isTestSubmitted || showResults || showConfiguration || showInstructions || mcqs.length === 0 || isPaused) {
      if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
      return;
    }
    if (!timerIntervalRef.current) {
      timerIntervalRef.current = setInterval(() => {
        setTimer((prevTimer) => {
          if (prevTimer <= 1) { if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; } handleSubmitTest(); return 0; }
          return prevTimer - 1;
        });
      }, 1000) as unknown as number;
    }
    return () => { if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; } };
  }, [isPageLoading, isTestSubmitted, showResults, showConfiguration, showInstructions, mcqs.length, isPaused, handleSubmitTest]);

  const handleCategoryToggle = (categoryId: string) => {
    setSelectedCategoryIds((prev) => {
      if (categoryId === UNCATEGORIZED_ID) return prev.includes(UNCATEGORIZED_ID) ? [] : [UNCATEGORIZED_ID];
      const newSelection = prev.filter(id => id !== UNCATEGORIZED_ID);
      return newSelection.includes(categoryId) ? newSelection.filter((id) => id !== categoryId) : [...newSelection, categoryId];
    });
  };

  const startTestPreparation = async () => {
    if (!user?.has_active_subscription || (user?.subscription_end_date && differenceInDays(parseISO(user.subscription_end_date), new Date()) <= 3)) {
      setIsUpgradeDialogOpen(true);
      return;
    }

    if (numMcqsToSelect <= 0 || testDurationMinutes <= 0) return;

    setIsPageLoading(true);
    let mcqIdsToFilter: string[] | null = null;
    const isUncategorizedSelected = selectedCategoryIds.includes(UNCATEGORIZED_ID);
    const regularCategoryIds = selectedCategoryIds.filter(id => id !== UNCATEGORIZED_ID);

    if (isUncategorizedSelected && regularCategoryIds.length === 0) {
      const { data: links } = await supabase.from('mcq_category_links').select('mcq_id');
      const categorized = Array.from(new Set(links?.map(link => link.mcq_id) || []));
      const { data: all } = await supabase.from('mcqs').select('id');
      mcqIdsToFilter = (all?.map(mcq => mcq.id) || []).filter(id => !categorized.includes(id));
    } else if (regularCategoryIds.length > 0) {
      const { data: links = [] } = await supabase.from('mcq_category_links').select('mcq_id').in('category_id', regularCategoryIds);
      mcqIdsToFilter = Array.from(new Set(links?.map(link => link.mcq_id) || []));
    } else {
      const { data: all } = await supabase.from('mcqs').select('id');
      mcqIdsToFilter = all?.map(mcq => mcq.id) || [];
    }

    if (mcqIdsToFilter !== null && mcqIdsToFilter.length === 0) {
      toast({ title: "No MCQs", description: "No questions available for this criteria." });
      setIsPageLoading(false);
      return;
    }

    let mcqsQuery = supabase.from('mcqs').select(`*, mcq_category_links(category_id, categories(name))`);
    if (mcqIdsToFilter !== null) mcqsQuery = mcqsQuery.in('id', mcqIdsToFilter);
    if (selectedDifficulty && selectedDifficulty !== "all") mcqsQuery = mcqsQuery.eq('difficulty', selectedDifficulty);

    const { data: mcqsData } = await mcqsQuery;
    if (!mcqsData || mcqsData.length === 0) {
      toast({ title: "No MCQs Found" });
      setIsPageLoading(false);
      return;
    }

    const formattedMcqs: MCQ[] = mcqsData.map((mcq: any) => ({ ...mcq, category_links: mcq.mcq_category_links.map((link: any) => ({ category_id: link.category_id, category_name: link.categories?.name || null })) }));
    const selectedMcqs = formattedMcqs.sort(() => 0.5 - Math.random()).slice(0, Math.min(numMcqsToSelect, formattedMcqs.length));

    setMcqs(selectedMcqs);
    setTimer(testDurationMinutes * 60);
    setCurrentQuestionIndex(0);
    const initialUserAnswers = new Map<string, UserAnswerData>();
    selectedMcqs.forEach(mcq => initialUserAnswers.set(mcq.id, { selectedOption: null, isCorrect: null, submitted: false }));
    setUserAnswers(initialUserAnswers);
    setSkippedMcqIds(new Set());
    setIsTestSubmitted(false);
    setScore(0);
    setExplanations(new Map());
    setIsPaused(false);
    setShowConfiguration(false);
    setShowInstructions(true);
    setIsPageLoading(false);

    if (user) {
      await saveTestState(null, selectedCategoryIds, selectedMcqs, initialUserAnswers, 0, testDurationMinutes * 60, testDurationMinutes * 60, new Set(), user.id);
    }
  };

  const continueTestSession = useCallback(async (loadedSession: LoadedTestSession) => {
    if (!user?.has_active_subscription || (user?.subscription_end_date && differenceInDays(parseISO(user.subscription_end_date), new Date()) <= 3)) {
      setIsUpgradeDialogOpen(true);
      return;
    }

    setIsPageLoading(true);
    setCurrentDbSessionId(loadedSession.dbSessionId);
    setSelectedCategoryIds(loadedSession.categoryIds);
    setNumMcqsToSelect(loadedSession.mcqs.length);
    setTestDurationMinutes(loadedSession.testDurationSeconds / 60);

    const { data: mcqsData } = await supabase.from('mcqs').select(`*, mcq_category_links(category_id, categories(name))`).in('id', loadedSession.mcqs.map(m => m.id));
    const formattedMcqs: MCQ[] = (mcqsData || []).map((mcq: any) => ({ ...mcq, category_links: mcq.mcq_category_links.map((link: any) => ({ category_id: link.category_id, category_name: link.categories?.name || null })) }));
    const orderedMcqs = loadedSession.mcqs.map(l => formattedMcqs.find(f => f.id === l.id)).filter((m): m is MCQ => m !== undefined);

    setMcqs(orderedMcqs);
    setUserAnswers(loadedSession.userAnswers);
    setCurrentQuestionIndex(loadedSession.currentQuestionIndex);
    setTimer(loadedSession.remainingTimeSeconds);
    setSkippedMcqIds(loadedSession.skippedMcqIds);
    setShowConfiguration(false);
    setShowInstructions(false);
    setIsPageLoading(false);
  }, [user]);

  const handleNext = useCallback(() => {
    if (currentQuestionIndex < mcqs.length - 1) setCurrentQuestionIndex((prev) => prev + 1);
    else handleSubmitTest();
  }, [currentQuestionIndex, mcqs.length, handleSubmitTest]);

  const handlePrevious = useCallback(() => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex((prev) => prev - 1);
  }, [currentQuestionIndex]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleBackToConfiguration = () => {
    setShowConfiguration(true);
    setMcqs([]);
    setCurrentDbSessionId(null);
  };

  const handleOptionSelect = (value: string) => {
    if (isPaused) return;
    const currentId = mcqs[currentQuestionIndex].id;
    const newAnswers = new Map(userAnswers);
    newAnswers.set(currentId, { selectedOption: value, isCorrect: null, submitted: false });
    setUserAnswers(newAnswers);
    
    if (skippedMcqIds.has(currentId)) {
      const newSkipped = new Set(skippedMcqIds);
      newSkipped.delete(currentId);
      setSkippedMcqIds(newSkipped);
    }
  };

  const togglePause = () => {
    setIsPaused(!isPaused);
  };

  const handleSkip = () => {
    if (isPaused) return;
    const currentId = mcqs[currentQuestionIndex].id;
    setSkippedMcqIds(new Set(skippedMcqIds).add(currentId));
    handleNext();
  };

  if (!hasCheckedInitialSession || isPageLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  if (showConfiguration) {
    return (
      <div className="space-y-4 pb-20 max-w-5xl mx-auto">
        <Card className="w-full border-none shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground py-6 text-center">
            <CardTitle className="text-2xl font-black uppercase tracking-tight">Mock Exam</CardTitle>
            <CardDescription className="text-primary-foreground/80 font-medium">Design your practice session.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {activeSavedTests.length > 0 && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                <h3 className="font-bold text-sm flex items-center gap-2 uppercase tracking-wider"><Play className="h-4 w-4 text-primary" /> Pending Sessions</h3>
                {activeSavedTests.map((s) => (
                  <div key={s.dbSessionId} className="flex items-center justify-between p-3 rounded-lg bg-background shadow-sm border text-sm">
                    <div className="overflow-hidden">
                      <p className="font-bold truncate">{s.categoryNames.join(', ')}</p>
                      <p className="text-[10px] text-muted-foreground font-medium uppercase mt-0.5">Q: {s.currentQuestionIndex + 1}/{s.mcqs.length} • {formatTime(s.remainingTimeSeconds)} left</p>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button onClick={() => continueTestSession(s)} size="sm" className="rounded-lg h-8">Resume</Button>
                      <Button onClick={() => clearSpecificTestState(s.dbSessionId)} variant="ghost" size="icon" className="text-red-500 h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Specialties</Label>
                    <div className="grid grid-cols-1 gap-1 max-h-[250px] overflow-y-auto p-3 bg-muted/20 rounded-xl border scrollbar-hide">
                        {allCategories.map((c) => (
                            <div key={c.id} className="flex items-center space-x-2 p-1.5 hover:bg-background rounded-md transition-colors">
                                <Checkbox id={`cat-${c.id}`} checked={selectedCategoryIds.includes(c.id)} onCheckedChange={() => handleCategoryToggle(c.id)} />
                                <Label htmlFor={`cat-${c.id}`} className="text-xs font-bold cursor-pointer line-clamp-1">{c.name}</Label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Difficulty</Label>
                        <Select onValueChange={(v) => setSelectedDifficulty(v === "all" ? null : v)} value={selectedDifficulty || "all"}>
                            <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-none font-bold text-xs"><SelectValue placeholder="Mixed Difficulty" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">Mixed (Random)</SelectItem><SelectItem value="Easy">Easy Level</SelectItem><SelectItem value="Medium">Medium Level</SelectItem><SelectItem value="Hard">Expert Level</SelectItem></SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Questions ({numMcqsToSelect})</Label>
                        <Input type="number" value={numMcqsToSelect} onChange={(e) => setNumMcqsToSelect(parseInt(e.target.value) || 0)} className="h-10 rounded-xl bg-muted/30 border-none font-bold text-xs" />
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Time (Minutes)</Label>
                        <Input type="number" value={testDurationMinutes} onChange={(e) => setTestDurationMinutes(parseInt(e.target.value) || 0)} className="h-10 rounded-xl bg-muted/30 border-none font-bold text-xs" />
                    </div>
                </div>
            </div>
          </CardContent>
          <CardFooter className="p-6 pt-0">
            <Button onClick={startTestPreparation} className="w-full h-12 rounded-xl text-md font-black uppercase tracking-widest shadow-lg">
               Start Simulation
            </Button>
          </CardFooter>
        </Card>
        
        <SubscribePromptDialog 
           open={isUpgradeDialogOpen} 
           onOpenChange={setIsUpgradeDialogOpen} 
           featureName="Mock Exam Engine" 
           description="Full length timed exams are a premium feature."
        />
        <MadeWithDyad />
      </div>
    );
  }

  if (showInstructions) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <Card className="border-none shadow-xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground py-6">
            <CardTitle className="text-2xl text-center font-black uppercase italic">Instructions</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted/50 rounded-xl text-center"><p className="text-[10px] text-muted-foreground uppercase font-black">Length</p><p className="text-xl font-black">{mcqs.length} MCQs</p></div>
                <div className="p-3 bg-muted/50 rounded-xl text-center"><p className="text-[10px] text-muted-foreground uppercase font-black">Timer</p><p className="text-xl font-black">{testDurationMinutes} Min</p></div>
            </div>
            <ul className="space-y-3">
              {[
                  "No negative marking.",
                  "Timer runs continuously.",
                  "Results revealed only after submission.",
                  "Auto-submit when time expires."
              ].map((text, i) => (
                  <li key={i} className="flex gap-3 items-start"><CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" /><p className="font-bold text-sm">{text}</p></li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="p-8 pt-0">
             <Button onClick={() => setShowInstructions(false)} className="w-full h-12 rounded-xl font-black uppercase tracking-widest">Begin Now</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (showResults) {
    return (
      <div className="space-y-4 max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row w-full gap-4">
          <QuizNavigator mcqs={mcqs} userAnswers={userAnswers} currentQuestionIndex={currentQuestionIndex} goToQuestion={(i) => setCurrentQuestionIndex(i)} showResults={true} score={score} />
          <Card className="flex-1 border-none shadow-xl rounded-2xl overflow-hidden">
            <CardHeader className="bg-primary text-primary-foreground text-center py-8">
              <CardTitle className="text-3xl font-black uppercase tracking-tighter">Results</CardTitle>
              <div className="mt-2 flex justify-center items-baseline gap-1">
                <span className="text-6xl font-black">{score}</span>
                <span className="text-xl text-primary-foreground/40">/ {mcqs.length}</span>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-3 scrollbar-thin">
                {mcqs.map((mcq, index) => {
                  const ans = userAnswers.get(mcq.id);
                  const exp = explanations.get(mcq.id);
                  return (
                    <div key={mcq.id} className="border rounded-xl p-4 bg-muted/10 space-y-3">
                      <h4 className="font-bold text-md">Q{index + 1}. {mcq.question_text}</h4>
                      <div className="grid grid-cols-1 gap-1.5">
                        {['A','B','C','D'].map(k => {
                            const isCorr = mcq.correct_answer === k;
                            const isUser = ans?.selectedOption === k;
                            return (
                                <div key={k} className={cn("p-3 rounded-lg border font-bold text-xs transition-all", 
                                    isCorr && "bg-green-50 border-green-500 text-green-700",
                                    !isCorr && isUser && "bg-red-50 border-red-500 text-red-700",
                                    !isCorr && !isUser && "opacity-50"
                                )}>
                                    <span className="mr-2 opacity-50">{k}.</span> {mcq[`option_${k.toLowerCase()}` as keyof MCQ] as string}
                                </div>
                            );
                        })}
                      </div>
                      {exp && (
                          <div className="mt-3 p-4 bg-white rounded-xl border border-dashed border-primary/20 prose prose-sm max-w-none">
                              <h5 className="font-black uppercase text-[10px] tracking-widest text-primary mb-2">Insight</h5>
                              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{exp.explanation_text}</ReactMarkdown>
                          </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
            <CardFooter className="p-6 pt-0 border-t flex justify-center gap-3">
               <Button onClick={handleBackToConfiguration} variant="outline" className="rounded-full px-6 h-10 text-xs uppercase font-bold">New Config</Button>
               <Button onClick={() => navigate('/user/dashboard')} className="rounded-full px-6 h-10 text-xs uppercase font-bold">Dashboard</Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  const currentAns = userAnswers.get(currentMcq.id)?.selectedOption || "";

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row w-full gap-4">
        <div className="lg:w-64">
           <QuizNavigator mcqs={mcqs} userAnswers={userAnswers} currentQuestionIndex={currentQuestionIndex} goToQuestion={(i) => setCurrentQuestionIndex(i)} showResults={false} score={0} skippedMcqIds={skippedMcqIds} />
        </div>
        
        <Card className="flex-1 border-none shadow-xl rounded-2xl overflow-hidden flex flex-col">
          <CardHeader className="border-b py-2 px-4 flex flex-row justify-between items-center bg-muted/5">
            <div>
              <CardTitle className="text-base font-bold tracking-tight">Question {currentQuestionIndex + 1} of {mcqs.length}</CardTitle>
              <div className="flex items-center gap-2 mt-0.5">
                 <Badge variant="secondary" className="text-[8px] h-4 px-1.5 uppercase font-black leading-none">{currentMcq.difficulty || 'Mixed'}</Badge>
                 <span className="text-[10px] text-muted-foreground font-black flex items-center gap-1 uppercase"><TimerIcon className="h-3 w-3" /> {formatTime(timer)}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={togglePause} className="rounded-full h-8 w-8">{isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}</Button>
                <Button variant="ghost" size="icon" onClick={toggleBookmark} className="rounded-full h-8 w-8">{isBookmarked ? <BookmarkCheck className="h-4 w-4 text-primary fill-current" /> : <Bookmark className="h-4 w-4" />}</Button>
            </div>
          </CardHeader>
          
          <CardContent className="p-4 flex-grow">
             <div className="text-base font-semibold leading-relaxed mb-4 text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{currentMcq.question_text}</ReactMarkdown>
             </div>
             <RadioGroup onValueChange={handleOptionSelect} value={currentAns} className="space-y-1.5" disabled={isPaused}>
                {['A','B','C','D'].map(k => (
                    <div 
                        key={k} 
                        onClick={() => !isPaused && handleOptionSelect(k)} 
                        className={cn(
                            "flex items-center p-2.5 rounded-xl border transition-all cursor-pointer", 
                            currentAns === k ? "border-primary bg-primary/5 shadow-sm border-2" : "border-muted/50 hover:border-muted-foreground/30"
                        )}
                    >
                        <RadioGroupItem value={k} id={`q-${k}`} className="sr-only" />
                        <Label htmlFor={`q-${k}`} className="flex-grow text-sm font-bold cursor-pointer leading-tight">
                            <span className="opacity-30 mr-3 font-black text-xs">{k}</span> 
                            {currentMcq[`option_${k.toLowerCase()}` as keyof MCQ] as string}
                        </Label>
                    </div>
                ))}
             </RadioGroup>
          </CardContent>
          
          <CardFooter className="p-3 border-t bg-muted/5 flex justify-between">
             <Button onClick={handlePrevious} variant="ghost" disabled={currentQuestionIndex === 0 || isPaused} className="rounded-lg h-9 px-4 text-xs font-bold uppercase tracking-tight">Back</Button>
             <div className="flex gap-2">
                <Button onClick={() => !isPaused && handleSkip()} variant="outline" className="rounded-lg h-9 px-4 gap-2 text-xs font-bold uppercase tracking-tight">Skip <SkipForward className="h-3 w-3" /></Button>
                <Button onClick={handleNext} disabled={isPaused} className="rounded-lg h-9 px-8 font-black uppercase tracking-widest text-xs">
                    {currentQuestionIndex === mcqs.length - 1 ? 'Finish Exam' : 'Next'}
                </Button>
             </div>
          </CardFooter>
        </Card>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default TakeTestPage;