"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2, Wand2, BookOpen, CheckCircle2, AlertCircle, ArrowRight, RotateCcw, Trophy } from 'lucide-react'; // Added Trophy
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';

interface CaseQuestion {
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: string;
  explanation: string;
}

interface ClinicalCase {
  case_title: string;
  vignette: string;
  questions: CaseQuestion[];
}

const CaseStudiesPage = () => {
  const { toast } = useToast();
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [customTopic, setCustomTopic] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentCase, setCurrentCase] = useState<ClinicalCase | null>(null);
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Map<number, { selected: string, isCorrect: boolean }>>(new Map());
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    const fetchCategories = async () => {
      const { data } = await supabase.from('categories').select('id, name').order('name');
      if (data) setCategories(data);
    };
    fetchCategories();
  }, []);

  const handleGenerate = async () => {
    const category = categories.find(c => c.id === selectedCategoryId);
    if (!category && !customTopic) {
      toast({ title: "Input Required", description: "Please select a category or enter a topic.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setCurrentCase(null);
    setCurrentQuestionIndex(0);
    setAnswers(new Map());
    setShowSummary(false);

    try {
      const { data, error } = await supabase.functions.invoke('generate-clinical-case', {
        body: { 
          category_name: category?.name || 'General Medicine',
          topic: customTopic 
        },
      });

      if (error) throw error;
      setCurrentCase(data);
    } catch (error: any) {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmitAnswer = () => {
    if (!selectedAnswer || !currentCase) return;
    
    const question = currentCase.questions[currentQuestionIndex];
    const isCorrect = selectedAnswer === question.correct_answer;
    
    setAnswers(new Map(answers.set(currentQuestionIndex, { selected: selectedAnswer, isCorrect })));
    setIsSubmitted(true);
  };

  const handleNext = () => {
    if (!currentCase) return;
    if (currentQuestionIndex < currentCase.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setIsSubmitted(false);
    } else {
      setShowSummary(true);
    }
  };

  const reset = () => {
    setCurrentCase(null);
    setShowSummary(false);
    setCustomTopic('');
  };

  if (showSummary && currentCase) {
    const correctCount = Array.from(answers.values()).filter(a => a.isCorrect).length;
    return (
      <div className="max-w-4xl mx-auto py-8">
        <Card className="border-primary/20 shadow-xl">
          <CardHeader className="text-center">
            <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <CardTitle className="text-3xl">Case Study Complete!</CardTitle>
            <CardDescription>Review your performance on "{currentCase.case_title}"</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Overall Score</p>
              <p className="text-5xl font-bold text-primary">{correctCount} / {currentCase.questions.length}</p>
            </div>
            
            <div className="space-y-4">
              {currentCase.questions.map((q, idx) => {
                const ans = answers.get(idx);
                return (
                  <div key={idx} className="p-4 border rounded-md flex items-start gap-3">
                    {ans?.isCorrect ? <CheckCircle2 className="h-5 w-5 text-green-500 mt-1" /> : <AlertCircle className="h-5 w-5 text-red-500 mt-1" />}
                    <div>
                      <p className="font-medium">{q.question_text}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your answer: {ans?.selected} | Correct: {q.correct_answer}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="flex justify-center gap-4">
            <Button onClick={reset} variant="outline">Try Another Topic</Button>
            <Button onClick={handleGenerate}><RotateCcw className="h-4 w-4 mr-2" /> Repeat Case</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">AI Clinical Cases</h1>
        {currentCase && <Button variant="ghost" onClick={reset}><RotateCcw className="h-4 w-4 mr-2" /> Start Over</Button>}
      </div>

      {!currentCase ? (
        <Card className="border-primary/10 shadow-md">
          <CardHeader>
            <CardTitle>Generate a New Case</CardTitle>
            <CardDescription>Select a category or enter a specific medical topic to generate a unique clinical scenario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Category</Label>
                <Select onValueChange={setSelectedCategoryId} value={selectedCategoryId}>
                  <SelectTrigger><SelectValue placeholder="Pick a specialty..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Specific Topic (Optional)</Label>
                <Input 
                  placeholder="e.g. Heart Failure, Diabetes Type 2" 
                  value={customTopic} 
                  onChange={(e) => setCustomTopic(e.target.value)}
                />
              </div>
            </div>
            <Button 
              className="w-full h-12 text-lg" 
              onClick={handleGenerate} 
              disabled={isGenerating}
            >
              {isGenerating ? <><Loader2 className="h-5 w-5 animate-spin mr-2" /> Simulating Case...</> : <><Wand2 className="h-5 w-5 mr-2" /> Generate Case Study</>}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
          {/* Left Side: The Vignette */}
          <Card className="lg:col-span-1 h-fit sticky top-24">
            <CardHeader className="bg-primary/5 rounded-t-lg">
              <CardTitle className="text-xl flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-primary" /> Patient Presentation
              </CardTitle>
              <CardDescription>{currentCase.case_title}</CardDescription>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none pt-4 text-sm leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {currentCase.vignette}
              </ReactMarkdown>
            </CardContent>
          </Card>

          {/* Right Side: Questions */}
          <div className="lg:col-span-2 space-y-6">
             <Card className="border-primary/20 shadow-lg">
               <CardHeader>
                 <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-semibold text-primary uppercase tracking-wider">Question {currentQuestionIndex + 1} of {currentCase.questions.length}</span>
                 </div>
                 <CardTitle className="text-xl">{currentCase.questions[currentQuestionIndex].question_text}</CardTitle>
               </CardHeader>
               <CardContent className="space-y-6">
                 <RadioGroup 
                    onValueChange={setSelectedAnswer} 
                    value={selectedAnswer || ""} 
                    className="space-y-3"
                    disabled={isSubmitted}
                 >
                   {Object.entries(currentCase.questions[currentQuestionIndex].options).map(([key, value]) => {
                     const isCorrect = key === currentCase.questions[currentQuestionIndex].correct_answer;
                     const isSelected = selectedAnswer === key;
                     
                     return (
                       <div 
                         key={key}
                         className={cn(
                           "flex items-center space-x-3 p-4 rounded-lg border transition-all cursor-pointer hover:bg-muted/50",
                           isSelected && "border-primary bg-primary/5 shadow-sm",
                           isSubmitted && isCorrect && "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300",
                           isSubmitted && isSelected && !isCorrect && "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300"
                         )}
                         onClick={() => !isSubmitted && setSelectedAnswer(key)}
                       >
                         <RadioGroupItem value={key} id={`opt-${key}`} />
                         <Label htmlFor={`opt-${key}`} className="flex-grow cursor-pointer font-medium">
                           <span className="mr-2 opacity-50">{key}.</span> {value}
                         </Label>
                       </div>
                     );
                   })}
                 </RadioGroup>

                 {isSubmitted && (
                   <div className="p-4 bg-muted rounded-lg animate-in fade-in zoom-in-95">
                     <h4 className="font-bold mb-2 flex items-center gap-2">
                       {answers.get(currentQuestionIndex)?.isCorrect ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-red-500" />}
                       Clinical Reasoning
                     </h4>
                     <div className="text-sm text-muted-foreground prose dark:prose-invert max-w-none">
                       <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                         {currentCase.questions[currentQuestionIndex].explanation}
                       </ReactMarkdown>
                     </div>
                   </div>
                 )}
               </CardContent>
               <CardFooter className="flex justify-end gap-3 pt-4 border-t">
                 {!isSubmitted ? (
                   <Button onClick={handleSubmitAnswer} disabled={!selectedAnswer}>Confirm Answer</Button>
                 ) : (
                   <Button onClick={handleNext}>
                     {currentQuestionIndex < currentCase.questions.length - 1 ? "Next Question" : "View Results"} 
                     <ArrowRight className="h-4 w-4 ml-2" />
                   </Button>
                 )}
               </CardFooter>
             </Card>
          </div>
        </div>
      )}
      <MadeWithDyad />
    </div>
  );
};

export default CaseStudiesPage;