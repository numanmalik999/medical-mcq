"use client";

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Loader2, MessageSquareText, Bookmark, BookmarkCheck } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import QuizNavigator from '@/components/QuizNavigator';
import { MCQ } from '@/components/mcq-columns';
import { useBookmark } from '@/hooks/use-bookmark';
import ExplanationDisplay from '@/components/ExplanationDisplay';
import TopicContentDialog from '@/components/TopicContentDialog';
import { cn } from '@/lib/utils';

// --- Interfaces ---
interface CategoryStats {
  id: string;
  name: string;
  mcqCount: number;
  attempts: number;
  correct: number;
  incorrect: number;
  accuracy: number;
  incorrectMcqIds: string[];
}

interface MCQExplanation {
  id: string;
  explanation_text: string;
  image_url: string | null;
}

interface UserAnswerData {
  selectedOption: string | null;
  isCorrect: boolean | null;
  submitted: boolean;
}

interface StructuredTopicContent {
  title: string;
  definition: string;
  main_causes: string;
  symptoms: string;
  diagnostic_tests: string;
  diagnostic_criteria: string;
  treatment_management: string;
  youtube_video_id: string;
}

// --- Component ---
const QuizPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const navigate = useNavigate();

  // --- State Management ---
  const [quizState, setQuizState] = useState<'selection' | 'running' | 'results'>('selection');
  
  // Category Selection State
  const [categoryStats, setCategoryStats] = useState<CategoryStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Quiz Running State
  const [quizQuestions, setQuizQuestions] = useState<MCQ[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Map<string, UserAnswerData>>(new Map());
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [explanations, setExplanations] = useState<Map<string, MCQExplanation>>(new Map());
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isTopicDialogOpen, setIsTopicDialogOpen] = useState(false);
  const [topicContent, setTopicContent] = useState<StructuredTopicContent | null>(null);

  const currentMcq = quizQuestions[currentQuestionIndex];
  const { isBookmarked, toggleBookmark, isLoading: isBookmarkLoading } = useBookmark(currentMcq?.id || null);

  // --- Data Fetching and Logic ---

  const fetchCategoryData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: categories, error: catError } = await supabase.from('categories').select('id, name');
      if (catError) throw catError;

      const { data: links, error: linksError } = await supabase.from('mcq_category_links').select('category_id');
      if (linksError) throw linksError;

      const mcqCounts = new Map<string, number>();
      for (const link of links) {
        mcqCounts.set(link.category_id, (mcqCounts.get(link.category_id) || 0) + 1);
      }

      let userAttempts: any[] = [];
      if (user) {
        const { data: attemptsData, error: attemptsError } = await supabase.from('user_quiz_attempts').select('category_id, is_correct, mcq_id').eq('user_id', user.id);
        if (attemptsError) throw attemptsError;
        userAttempts = attemptsData || [];
      }

      const stats: CategoryStats[] = categories.map(category => {
        const attemptsInCategory = userAttempts.filter(a => a.category_id === category.id);
        const correctAttempts = attemptsInCategory.filter(a => a.is_correct).length;
        const totalAttempts = attemptsInCategory.length;
        const incorrectAttempts = totalAttempts - correctAttempts;
        const accuracy = totalAttempts > 0 ? (correctAttempts / totalAttempts) * 100 : 0;
        const incorrectMcqIds = attemptsInCategory.filter(a => !a.is_correct).map(a => a.mcq_id);

        return {
          id: category.id,
          name: category.name,
          mcqCount: mcqCounts.get(category.id) || 0,
          attempts: totalAttempts,
          correct: correctAttempts,
          incorrect: incorrectAttempts,
          accuracy: accuracy,
          incorrectMcqIds: Array.from(new Set(incorrectMcqIds)),
        };
      });

      setCategoryStats(stats.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error: any) {
      console.error("Error fetching quiz data:", error);
      toast({ title: "Error", description: "Failed to load quiz categories.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    if (hasCheckedInitialSession) {
      fetchCategoryData();
    }
  }, [hasCheckedInitialSession, fetchCategoryData]);

  const startQuiz = useCallback(async (params: { categoryId?: string; mcqIds?: string[] }) => {
    setIsLoading(true);
    setQuizState('running');
    let query;

    if (params.mcqIds && params.mcqIds.length > 0) {
      query = supabase.from('mcqs').select(`*, mcq_category_links(category_id, categories(name)), mcq_topic_links(topic_id, course_topics(title))`).in('id', params.mcqIds);
    } else if (params.categoryId) {
      const { data: links, error: linksError } = await supabase.from('mcq_category_links').select('mcq_id').eq('category_id', params.categoryId);
      if (linksError || !links || links.length === 0) {
        toast({ title: "Error", description: "No questions found for this category.", variant: "destructive" });
        setQuizState('selection');
        setIsLoading(false);
        return;
      }
      const mcqIds = links.map(l => l.mcq_id);
      query = supabase.from('mcqs').select(`*, mcq_category_links(category_id, categories(name)), mcq_topic_links(topic_id, course_topics(title))`).in('id', mcqIds);
    } else {
      toast({ title: "Error", description: "No quiz criteria specified.", variant: "destructive" });
      setQuizState('selection');
      setIsLoading(false);
      return;
    }

    const { data, error } = await query;

    if (error) {
      toast({ title: "Error", description: "Failed to load quiz questions.", variant: "destructive" });
      setQuizState('selection');
    } else {
      const formattedMcqs: MCQ[] = data.map((mcq: any) => ({
        ...mcq,
        category_links: mcq.mcq_category_links.map((link: any) => ({ category_id: link.category_id, category_name: link.categories?.name || null })),
        topic_links: mcq.mcq_topic_links.map((link: any) => ({ topic_id: link.topic_id, topic_title: link.course_topics?.title || null })),
      }));
      setQuizQuestions(formattedMcqs.sort(() => 0.5 - Math.random()));
      const initialAnswers = new Map();
      formattedMcqs.forEach(mcq => initialAnswers.set(mcq.id, { selectedOption: null, isCorrect: null, submitted: false }));
      setUserAnswers(initialAnswers);
      setCurrentQuestionIndex(0);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setScore(0);
    }
    setIsLoading(false);
  }, [toast]);

  const fetchExplanation = useCallback(async (explanationId: string) => {
    if (explanations.has(explanationId)) return;
    const { data, error } = await supabase.from('mcq_explanations').select('*').eq('id', explanationId).single();
    if (error) console.error("Error fetching explanation:", error);
    else if (data) setExplanations(prev => new Map(prev).set(explanationId, data));
  }, [explanations]);

  const handleDiagnosisClick = async (diagnosisTitle: string) => {
    try {
      const { data, error } = await supabase.from('course_topics').select('content').eq('title', diagnosisTitle).single();
      if (error) {
        if (error.code === 'PGRST116') toast({ title: "Not Found", description: `No course topic found for "${diagnosisTitle}".` });
        else throw error;
        return;
      }
      if (data.content) {
        setTopicContent(JSON.parse(data.content));
        setIsTopicDialogOpen(true);
      } else {
        toast({ title: "No Content", description: `The topic "${diagnosisTitle}" has no content yet.` });
      }
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to fetch topic content.", variant: "destructive" });
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentMcq || !selectedAnswer) return;
    setIsSubmittingAnswer(true);
    const isCorrect = selectedAnswer === currentMcq.correct_answer;
    const updatedAnswers = new Map(userAnswers);
    updatedAnswers.set(currentMcq.id, { selectedOption: selectedAnswer, isCorrect, submitted: true });
    setUserAnswers(updatedAnswers);
    setShowExplanation(true);
    if (currentMcq.explanation_id) {
      await fetchExplanation(currentMcq.explanation_id);
    }
    if (user) {
      await supabase.from('user_quiz_attempts').insert({
        user_id: user.id,
        mcq_id: currentMcq.id,
        category_id: currentMcq.category_links?.[0]?.category_id || null,
        selected_option: selectedAnswer,
        is_correct: isCorrect,
      });
    }
    setIsSubmittingAnswer(false);
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < quizQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    } else {
      let correctCount = 0;
      userAnswers.forEach(answer => { if (answer.isCorrect) correctCount++; });
      setScore(correctCount);
      setQuizState('results');
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      const prevAnswer = userAnswers.get(quizQuestions[currentQuestionIndex - 1].id);
      setSelectedAnswer(prevAnswer?.selectedOption || null);
      setShowExplanation(prevAnswer?.submitted || false);
    }
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < quizQuestions.length) {
      setCurrentQuestionIndex(index);
      const answerData = userAnswers.get(quizQuestions[index].id);
      setSelectedAnswer(answerData?.selectedOption || null);
      setShowExplanation(answerData?.submitted || false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!user || !currentMcq) return;
    setIsSubmittingFeedback(true);
    const { error } = await supabase.from('mcq_feedback').insert({ user_id: user.id, mcq_id: currentMcq.id, feedback_text: feedbackText, status: 'pending' });
    if (error) {
      toast({ title: "Error", description: `Failed to submit feedback: ${error.message}`, variant: "destructive" });
    } else {
      toast({ title: "Feedback Submitted", description: "Thank you for your input!" });
      setIsFeedbackDialogOpen(false);
      setFeedbackText('');
    }
    setIsSubmittingFeedback(false);
  };

  const resetQuiz = () => {
    setQuizState('selection');
    fetchCategoryData(); // Refresh stats
  };

  // --- Render Logic ---

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (quizState === 'selection') {
    const filteredCategories = categoryStats.filter(cat => cat.name.toLowerCase().includes(searchTerm.toLowerCase()));
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 pt-16">
        <div className="container mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold">Select a Quiz Category</h1>
            <p className="text-muted-foreground mt-2">Choose a category to start your quiz and view your performance.</p>
          </div>
          <div className="max-w-xl mx-auto mb-8">
            <Input placeholder="Search categories..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCategories.map(cat => (
              <Card key={cat.id}>
                <CardHeader>
                  <CardTitle>{cat.name}</CardTitle>
                  <CardDescription>{cat.mcqCount} MCQs available</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>Attempts: {cat.attempts}</p>
                    <p>Correct: {cat.correct}</p>
                    <p>Incorrect: {cat.incorrect}</p>
                    <p>Accuracy: {cat.accuracy.toFixed(2)}%</p>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button className="w-full" onClick={() => startQuiz({ categoryId: cat.id })}>Start Quiz</Button>
                  <Button className="w-full" variant="outline" onClick={() => startQuiz({ mcqIds: cat.incorrectMcqIds })} disabled={cat.incorrect === 0}>
                    Attempt Incorrect ({cat.incorrect})
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          <MadeWithDyad />
        </div>
      </div>
    );
  }

  if (quizState === 'results') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Quiz Results</CardTitle>
            <CardDescription>You scored {score} out of {quizQuestions.length}.</CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center gap-4">
            <Button onClick={resetQuiz}>Try Another Quiz</Button>
            <Button onClick={() => navigate('/user/dashboard')} variant="outline">Go to Dashboard</Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  if (quizState === 'running' && currentMcq) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 pt-16">
        <div className="flex flex-col md:flex-row w-full max-w-6xl gap-4">
          <QuizNavigator mcqs={quizQuestions} userAnswers={userAnswers} currentQuestionIndex={currentQuestionIndex} goToQuestion={goToQuestion} showResults={false} score={0} />
          <Card className="flex-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Question {currentQuestionIndex + 1} / {quizQuestions.length}</CardTitle>
              {user && (
                <Button variant="ghost" size="icon" onClick={toggleBookmark} disabled={isBookmarkLoading}>
                  {isBookmarked ? <BookmarkCheck className="h-6 w-6 fill-current text-primary" /> : <Bookmark className="h-6 w-6" />}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold mb-4">{currentMcq.question_text}</p>
              <RadioGroup onValueChange={setSelectedAnswer} value={selectedAnswer || ''} className="space-y-2" disabled={showExplanation}>
                {['A', 'B', 'C', 'D'].map(key => {
                  const optionText = currentMcq[`option_${key.toLowerCase() as 'a'}` as keyof MCQ];
                  const isCorrect = currentMcq.correct_answer === key;
                  const isSelected = selectedAnswer === key;
                  return (
                    <div key={key} className="flex items-center space-x-2">
                      <RadioGroupItem value={key} id={`option-${key}`} />
                      <Label htmlFor={`option-${key}`} className={cn(showExplanation && isCorrect ? 'text-green-600 font-bold' : showExplanation && isSelected ? 'text-red-600' : '')}>
                        {`${key}. ${optionText as string}`}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
              {showExplanation && (
                <div className="mt-6 p-4 bg-white rounded-md border">
                  <h3 className="text-lg font-semibold mb-2">Explanation:</h3>
                  <ExplanationDisplay explanationText={explanations.get(currentMcq.explanation_id || '')?.explanation_text || ""} onDiagnosisClick={handleDiagnosisClick} />
                  {explanations.get(currentMcq.explanation_id || '')?.image_url && <img src={explanations.get(currentMcq.explanation_id || '')?.image_url!} alt="Explanation" className="mt-4 rounded-md" />}
                  {user && <Button variant="outline" className="mt-4 w-full" onClick={() => setIsFeedbackDialogOpen(true)}><MessageSquareText className="h-4 w-4 mr-2" /> Add Notes or Feedback</Button>}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button onClick={handlePreviousQuestion} disabled={currentQuestionIndex === 0} variant="outline">Previous</Button>
              {showExplanation ? (
                <Button onClick={handleNextQuestion}>{currentQuestionIndex === quizQuestions.length - 1 ? 'Finish Quiz' : 'Next'}</Button>
              ) : (
                <Button onClick={handleSubmitAnswer} disabled={!selectedAnswer || isSubmittingAnswer}>
                  {isSubmittingAnswer && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Submit
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
        <MadeWithDyad />
        <TopicContentDialog open={isTopicDialogOpen} onOpenChange={setIsTopicDialogOpen} topicContent={topicContent} />
        <Dialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Submit Feedback</DialogTitle></DialogHeader>
            <Textarea value={feedbackText} onChange={(e) => setFeedbackText(e.target.value)} placeholder="Provide feedback..." />
            <DialogFooter>
              <Button onClick={handleSubmitFeedback} disabled={isSubmittingFeedback}>
                {isSubmittingFeedback ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return <div className="min-h-screen flex items-center justify-center"><p>An unexpected error occurred.</p></div>;
};

export default QuizPage;