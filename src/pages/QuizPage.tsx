"use client";

import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MCQ {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: 'A' | 'B' | 'C' | 'D';
  explanation_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  difficulty: string | null;
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

interface Subcategory {
  id: string;
  category_id: string;
  name: string;
}

const QuizPage = () => {
  const [mcq, setMcq] = useState<MCQ | null>(null);
  const [explanation, setExplanation] = useState<MCQExplanation | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState<Subcategory[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);

  useEffect(() => {
    fetchCategoriesAndSubcategories();
  }, []);

  useEffect(() => {
    if (selectedCategoryId) {
      setFilteredSubcategories(subcategories.filter(sub => sub.category_id === selectedCategoryId));
      setSelectedSubcategoryId(null); // Reset subcategory when category changes
    } else {
      setFilteredSubcategories([]);
      setSelectedSubcategoryId(null);
    }
  }, [selectedCategoryId, subcategories]);

  const fetchCategoriesAndSubcategories = async () => {
    setIsLoading(true);
    const { data: categoriesData, error: categoriesError } = await supabase
      .from('categories')
      .select('*');

    const { data: subcategoriesData, error: subcategoriesError } = await supabase
      .from('subcategories')
      .select('*');

    if (categoriesError) {
      console.error('Error fetching categories:', categoriesError);
      toast({ title: "Error", description: "Failed to load categories.", variant: "destructive" });
    } else {
      setCategories(categoriesData || []);
    }

    if (subcategoriesError) {
      console.error('Error fetching subcategories:', subcategoriesError);
      toast({ title: "Error", description: "Failed to load subcategories.", variant: "destructive" });
    } else {
      setSubcategories(subcategoriesData || []);
    }
    setIsLoading(false);
  };

  const fetchMcq = async () => {
    setIsLoading(true);
    setMcq(null);
    setExplanation(null);
    setSelectedAnswer(null);
    setFeedback(null);
    setShowExplanation(false);

    console.log("Attempting to fetch MCQ with category:", selectedCategoryId, "and subcategory:", selectedSubcategoryId);

    let countQuery = supabase.from('mcqs').select('count()', { head: true, count: 'exact' });
    if (selectedCategoryId) {
      countQuery = countQuery.eq('category_id', selectedCategoryId);
    }
    if (selectedSubcategoryId) {
      countQuery = countQuery.eq('subcategory_id', selectedSubcategoryId);
    }

    const { count, error: countError } = await countQuery;

    if (countError) {
      console.error('Supabase Error fetching MCQ count:', countError);
      toast({ title: "Error", description: `Failed to load quiz count: ${countError.message}. Please try again.`, variant: "destructive" });
      setIsLoading(false);
      return;
    }

    console.log("MCQ count for criteria:", count);

    if (count === 0) {
      toast({ title: "No MCQs", description: "No MCQs found for the selected criteria.", variant: "default" });
      setIsLoading(false);
      setMcq(null);
      return;
    }

    const randomIndex = Math.floor(Math.random() * count!);
    console.log("Fetching MCQ at random index:", randomIndex);

    let mcqQuery = supabase
      .from('mcqs')
      .select('*')
      .limit(1)
      .range(randomIndex, randomIndex);

    if (selectedCategoryId) {
      mcqQuery = mcqQuery.eq('category_id', selectedCategoryId);
    }
    if (selectedSubcategoryId) {
      mcqQuery = mcqQuery.eq('subcategory_id', selectedSubcategoryId);
    }

    const { data, error } = await mcqQuery.single();

    if (error) {
      console.error('Supabase Error fetching single MCQ:', error);
      toast({
        title: "Error",
        description: `Failed to load MCQ: ${error.message || 'Unknown error'}. Please try again.`,
        variant: "destructive",
      });
    } else if (data) { // Ensure data is not null
      console.log("Successfully fetched MCQ:", data);
      setMcq(data);
      if (data.explanation_id) {
        try {
          await fetchExplanation(data.explanation_id);
        } catch (explanationFetchError: any) {
          console.error('Client-side error during explanation fetch:', explanationFetchError);
          toast({
            title: "Error",
            description: `An unexpected error occurred while fetching explanation: ${explanationFetchError.message || 'Unknown error'}`,
            variant: "destructive",
          });
        }
      } else {
        console.log("MCQ has no explanation_id.");
        setExplanation(null); // Explicitly clear explanation if no ID
      }
    } else {
      console.warn("No MCQ data returned despite no error.");
      toast({
        title: "Warning",
        description: "No MCQ data found. Please try again.",
        variant: "default",
      });
      setMcq(null);
    }
    setIsLoading(false);
  };

  const fetchExplanation = async (explanationId: string) => {
    console.log("Attempting to fetch explanation for ID:", explanationId);
    const { data, error } = await supabase
      .from('mcq_explanations')
      .select('*')
      .eq('id', explanationId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 means no rows found
      console.error('Supabase Error fetching explanation:', error);
      toast({
        title: "Error",
        description: `Failed to load explanation: ${error.message || 'Unknown error'}.`,
        variant: "destructive",
      });
      setExplanation(null);
    } else if (data) {
      console.log("Successfully fetched explanation:", data);
      setExplanation(data);
    } else {
      console.warn(`No explanation found for ID: ${explanationId} (or PGRST116 error).`);
      setExplanation(null);
    }
  };

  const handleSubmitAnswer = () => {
    if (!selectedAnswer || !mcq) return;

    if (selectedAnswer === mcq.correct_answer) {
      setFeedback('Correct!');
    } else {
      setFeedback(`Incorrect. The correct answer was ${mcq.correct_answer}.`);
    }
    setShowExplanation(true);
  };

  const handleAiExplanation = () => {
    toast({
      title: "AI Explanation",
      description: "This feature is coming soon! The AI will provide a deeper dive into the topic.",
    });
    console.log("Requesting AI explanation for:", mcq?.question_text);
  };

  const handleStartQuiz = () => {
    if (!selectedCategoryId) {
      toast({ title: "Error", description: "Please select a category to start the quiz.", variant: "destructive" });
      return;
    }
    setQuizStarted(true);
    fetchMcq();
  };

  if (isLoading && !quizStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading categories...</p>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>Select Quiz Options</CardTitle>
            <CardDescription>Choose a category and optionally a subcategory to start your quiz.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="category-select">Category</Label>
              <Select onValueChange={setSelectedCategoryId} value={selectedCategoryId || ''}>
                <SelectTrigger id="category-select">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.length === 0 ? (
                    <SelectItem value="no-categories" disabled>No categories available</SelectItem>
                  ) : (
                    categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subcategory-select">Subcategory (Optional)</Label>
              <Select
                onValueChange={(value) => setSelectedSubcategoryId(value === "all" ? null : value)}
                value={selectedSubcategoryId || "all"}
                disabled={!selectedCategoryId || filteredSubcategories.length === 0}
              >
                <SelectTrigger id="subcategory-select">
                  <SelectValue placeholder="Select a subcategory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any Subcategory</SelectItem>
                  {filteredSubcategories.map((subcat) => (
                    <SelectItem key={subcat.id} value={subcat.id}>{subcat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={handleStartQuiz} disabled={!selectedCategoryId || categories.length === 0}>
              Start Quiz
            </Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  if (!mcq && quizStarted && !isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle>No MCQs Found</CardTitle>
            <CardDescription>
              It looks like there are no MCQs for the selected criteria.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Please try a different category/subcategory or add more MCQs.
            </p>
          </CardContent>
          <CardFooter className="flex justify-center">
            <Button onClick={() => setQuizStarted(false)}>Go Back to Selection</Button>
          </CardFooter>
        </Card>
        <MadeWithDyad />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-xl">{mcq?.question_text}</CardTitle>
          {mcq?.category_id && mcq?.difficulty && (
            <CardDescription className="text-sm text-gray-500 dark:text-gray-400">
              Category ID: {mcq.category_id} | Difficulty: {mcq.difficulty}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <RadioGroup
            onValueChange={setSelectedAnswer}
            value={selectedAnswer || ""}
            className="space-y-2"
            disabled={showExplanation}
          >
            {['A', 'B', 'C', 'D'].map((optionKey) => {
              const optionText = mcq?.[`option_${optionKey.toLowerCase()}` as keyof MCQ];
              return (
                <div key={optionKey} className="flex items-center space-x-2">
                  <RadioGroupItem value={optionKey} id={`option-${optionKey}`} />
                  <Label htmlFor={`option-${optionKey}`}>{`${optionKey}. ${optionText}`}</Label>
                </div>
              );
            })}
          </RadioGroup>

          {feedback && (
            <p className={`mt-4 text-lg font-semibold ${feedback.startsWith('Correct') ? 'text-green-600' : 'text-red-600'}`}>
              {feedback}
            </p>
          )}

          {showExplanation && explanation && (
            <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-md border border-gray-200 dark:border-gray-600">
              <h3 className="text-lg font-semibold mb-2">Explanation:</h3>
              <p className="text-gray-800 dark:text-gray-200">{explanation.explanation_text}</p>
              {explanation.image_url && (
                <img src={explanation.image_url} alt="Explanation" className="mt-4 max-w-full h-auto rounded-md" />
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-2">
          {!showExplanation ? (
            <Button onClick={handleSubmitAnswer} disabled={!selectedAnswer}>
              Submit Answer
            </Button>
          ) : (
            <>
              <Button onClick={fetchMcq} variant="outline">Next MCQ</Button>
              <Button onClick={handleAiExplanation}>Get more explanation with AI</Button>
            </>
          )}
        </CardFooter>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default QuizPage;