"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { RotateCcw, MenuIcon } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

// Interfaces copied from QuizPage.tsx for type consistency
interface CategoryStat {
  id: string;
  name: string;
  total_mcqs: number;
  total_trial_mcqs: number;
  user_attempts: number;
  user_correct: number;
  user_incorrect: number;
  user_accuracy: string;
}

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

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
  category_links: any[]; // Simplified for sidebar display
}

interface UserAnswerData {
  selectedOption: string | null;
  isCorrect: boolean | null;
  submitted: boolean;
}

interface LoadedQuizSession {
  dbSessionId: string;
  categoryId: string;
  subcategory_id: string | null;
  mcqs: MCQ[];
  userAnswers: Map<string, UserAnswerData>;
  currentQuestionIndex: number;
  isTrialActiveSession: boolean;
  userId: string;
  categoryName: string;
  subcategoryName: string | null;
}

interface QuizSidebarProps {
  categoryStats: CategoryStat[];
  allSubcategories: Subcategory[];
  activeSavedQuizzes: LoadedQuizSession[];
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  currentQuizSubcategoryId: string | null;
  setCurrentQuizSubcategoryId: (id: string | null) => void;
  startQuizSession: (categoryId: string, subcategoryId: string | null, mode: 'random' | 'incorrect') => Promise<void>;
  continueQuizSession: (session: LoadedQuizSession) => Promise<void>;
  clearSpecificQuizState: (dbSessionId: string) => Promise<void>;
  handleResetProgress: (categoryId: string) => Promise<void>;
  user: any; // User object from session
  isTrialActiveSession: boolean;
  showSubscriptionPrompt: boolean;
  setShowSubscriptionPrompt: (show: boolean) => void;
  onCloseSidebar: () => void; // Callback to close sidebar
}

const QuizSidebar = ({
  categoryStats,
  allSubcategories,
  activeSavedQuizzes,
  searchTerm,
  setSearchTerm,
  currentQuizSubcategoryId,
  setCurrentQuizSubcategoryId,
  startQuizSession,
  continueQuizSession,
  clearSpecificQuizState,
  handleResetProgress,
  user,
  isTrialActiveSession,
  showSubscriptionPrompt,
  setShowSubscriptionPrompt,
  onCloseSidebar,
}: QuizSidebarProps) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = React.useState(false);

  // Sync internal isOpen state with parent's onCloseSidebar
  React.useEffect(() => {
    if (!isOpen) {
      onCloseSidebar();
    }
  }, [isOpen, onCloseSidebar]);

  const filteredCategories = categoryStats.filter(cat =>
    cat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const content = (
    <div className="flex flex-col h-full p-4">
      <h2 className="text-2xl font-bold text-foreground mb-6">Quiz Categories</h2>
      <div className="flex-grow overflow-y-auto pr-2 space-y-4">
        {activeSavedQuizzes.length > 0 && (
          <Card className="mb-6 border-blue-500 bg-blue-50 dark:bg-blue-950">
            <CardHeader>
              <CardTitle className="text-blue-700 dark:text-blue-300 text-lg">Continue Your Quizzes</CardTitle>
              <CardDescription className="text-blue-600 dark:text-blue-400 text-sm">
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
                      <p className="font-semibold">{savedState.categoryName} {savedState.subcategoryName ? `(${savedState.subcategoryName})` : ''}</p>
                      <p className="text-sm text-muted-foreground">Question {progress} of {total}</p>
                    </div>
                    <div className="flex gap-2 mt-2 sm:mt-0">
                      <Button onClick={() => { continueQuizSession(savedState); setIsOpen(false); }} size="sm">Continue</Button>
                      <Button onClick={() => clearSpecificQuizState(savedState.dbSessionId)} variant="outline" size="sm">Clear</Button>
                    </div>
                  </div>
                );
              })}
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
          <div className="grid grid-cols-1 gap-4">
            {filteredCategories.map((cat) => {
              const savedSessionForCurrentSelection = activeSavedQuizzes.find(
                (session) =>
                  session.categoryId === cat.id &&
                  session.subcategory_id === currentQuizSubcategoryId
              );

              return (
                <Card key={cat.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg">{cat.name}</CardTitle>
                    <CardDescription>
                      {user?.has_active_subscription ? `${cat.total_mcqs} MCQs available` : `${cat.total_trial_mcqs} Trial MCQs available`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-2 text-sm">
                    {user && (
                      <>
                        <p>Attempts: {cat.user_attempts}</p>
                        <p>Correct: {cat.user_correct}</p>
                        <p>Incorrect: {cat.user_incorrect}</p>
                        <p>Accuracy: {cat.user_accuracy}</p>
                      </>
                    )}
                    <div className="space-y-2 mt-4">
                      <Label htmlFor={`subcategory-select-${cat.id}`}>Subcategory (Optional)</Label>
                      <Select
                        onValueChange={(value) => setCurrentQuizSubcategoryId(value === "all" ? null : value)}
                        value={currentQuizSubcategoryId || "all"}
                        disabled={!cat.id || allSubcategories.filter(sub => sub.category_id === cat.id).length === 0}
                      >
                        <SelectTrigger id={`subcategory-select-${cat.id}`}>
                          <SelectValue placeholder="Any Subcategory" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any Subcategory</SelectItem>
                          {allSubcategories
                            .filter(sub => sub.category_id === cat.id)
                            .map((subcat) => (
                              <SelectItem key={subcat.id} value={subcat.id}>{subcat.name}</SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-2">
                    {savedSessionForCurrentSelection ? (
                      <Button
                        onClick={() => { continueQuizSession(savedSessionForCurrentSelection); setIsOpen(false); }}
                        className="w-full"
                      >
                        Continue Quiz
                      </Button>
                    ) : (
                      <Button
                        onClick={() => { startQuizSession(cat.id, currentQuizSubcategoryId, 'random'); setIsOpen(false); }}
                        className="w-full"
                        disabled={
                          !user ||
                          (user?.has_active_subscription && cat.total_mcqs === 0) ||
                          (!user?.has_active_subscription && cat.total_trial_mcqs === 0) ||
                          (!user?.has_active_subscription && user?.trial_taken)
                        }
                      >
                        {user?.has_active_subscription ? "Start Quiz" : (user?.trial_taken ? "Subscribe to Start" : "Start Trial Quiz")}
                      </Button>
                    )}
                    <Button
                      onClick={() => { startQuizSession(cat.id, currentQuizSubcategoryId, 'incorrect'); setIsOpen(false); }}
                      className="w-full"
                      variant="secondary"
                      disabled={cat.user_incorrect === 0 || !user?.has_active_subscription}
                    >
                      Attempt Incorrect ({cat.user_incorrect})
                    </Button>
                    {user && (
                      <Button
                        onClick={() => handleResetProgress(cat.id)}
                        className="w-full"
                        variant="destructive"
                        disabled={cat.user_attempts === 0}
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
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50">
            <MenuIcon className="h-6 w-6" />
            <span className="sr-only">Toggle quiz categories</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 p-0 bg-background flex flex-col">
          {content}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="w-80 min-h-screen bg-background text-foreground border-r border-border flex flex-col">
      {content}
    </aside>
  );
};

export default QuizSidebar;