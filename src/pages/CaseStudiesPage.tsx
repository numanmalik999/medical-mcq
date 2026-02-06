"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Loader2, Wand2, CheckCircle2, AlertCircle, ArrowRight, RotateCcw, Trophy, Send, Search, BrainCircuit, History } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { useSession } from '@/components/SessionContextProvider';
import { startOfDay, endOfDay } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface CaseQuestion {
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_answer: string;
  explanation: string;
}

interface ClinicalCase {
  case_title: string;
  brief_presentation: string;
  full_vignette: string;
  questions: CaseQuestion[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const DAILY_LIMIT = 5;

const CaseStudiesPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [customTopic, setCustomTopic] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentCase, setCurrentCase] = useState<ClinicalCase | null>(null);
  const [viewMode, setViewMode] = useState<'investigation' | 'assessment'>('investigation');
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Assessment State
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Map<number, { selected: string, isCorrect: boolean }>>(new Map());
  const [showSummary, setShowSummary] = useState(false);
  
  // Limit State
  const [dailyCount, setDailyCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      const { data: cats } = await supabase.from('categories').select('id, name').order('name');
      if (cats) setCategories(cats);

      if (user) {
        const todayStart = startOfDay(new Date()).toISOString();
        const todayEnd = endOfDay(new Date()).toISOString();
        const { count } = await supabase
          .from('user_case_study_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd);
        
        setDailyCount(count || 0);
      }
    };
    fetchData();
  }, [user]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatMessages, isChatLoading]);

  const handleGenerate = async () => {
    if (!user) {
        toast({ title: "Login Required", description: "Please log in to use AI Clinical Cases." });
        return;
    }

    if (dailyCount >= DAILY_LIMIT) {
      toast({ 
        title: "Daily Limit Reached", 
        description: `You have used your ${DAILY_LIMIT} free cases for today. Upgrade for unlimited access!`,
        variant: "destructive"
      });
      return;
    }

    const category = categories.find(c => c.id === selectedCategoryId);
    if (!category && !customTopic) {
      toast({ title: "Input Required", description: "Select a specialty or enter a topic.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setCurrentCase(null);
    setChatMessages([
        { role: 'assistant', content: "I've reviewed the initial patient report. What would you like to check? You can ask about History, Physical Exam, or specific Lab values." }
    ]);
    setViewMode('investigation');
    setCurrentQuestionIndex(0);
    setAnswers(new Map());
    setShowSummary(false);

    try {
      const { data, error } = await supabase.functions.invoke('generate-clinical-case', {
        body: { category_name: category?.name || 'General Medicine', topic: customTopic },
      });

      if (error) throw error;

      // Track usage
      await supabase.from('user_case_study_attempts').insert({ user_id: user.id });
      setDailyCount(prev => prev + 1);

      setCurrentCase(data);
    } catch (error: any) {
      toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !currentCase || isChatLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('case-study-chat', {
        body: { 
            messages: [...chatMessages, userMsg],
            case_context: `Case Title: ${currentCase.case_title}\n\nFull Vignette: ${currentCase.full_vignette}`
        },
      });

      if (error) throw error;
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
    } catch (error: any) {
      toast({ title: "AI Error", description: "Could not reach the clinical tutor." });
    } finally {
      setIsChatLoading(false);
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

  if (!hasCheckedInitialSession) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  if (showSummary && currentCase) {
    const correctCount = Array.from(answers.values()).filter(a => a.isCorrect).length;
    return (
      <div className="max-w-4xl mx-auto py-8 px-4 animate-in fade-in zoom-in-95">
        <Card className="border-primary/20 shadow-2xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground text-center py-10">
            <Trophy className="h-16 w-16 text-yellow-400 mx-auto mb-4 drop-shadow-lg" />
            <CardTitle className="text-3xl font-black uppercase">Case Resolved</CardTitle>
            <CardDescription className="text-primary-foreground/70 font-medium">Final Audit for "{currentCase.case_title}"</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 p-8">
            <div className="flex justify-center">
                <div className="text-center p-8 bg-muted/50 rounded-full border-4 border-primary/10 w-48 h-48 flex flex-col justify-center">
                    <p className="text-sm font-bold text-muted-foreground uppercase">Score</p>
                    <p className="text-5xl font-black text-primary">{correctCount}/{currentCase.questions.length}</p>
                </div>
            </div>
            
            <div className="space-y-4">
              {currentCase.questions.map((q, idx) => {
                const ans = answers.get(idx);
                return (
                  <div key={idx} className="p-5 border rounded-2xl flex items-start gap-4 bg-card shadow-sm">
                    {ans?.isCorrect ? <CheckCircle2 className="h-6 w-6 text-green-500 mt-1" /> : <AlertCircle className="h-6 w-6 text-red-500 mt-1" />}
                    <div>
                      <p className="font-bold text-lg">{q.question_text}</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Choice: <span className={ans?.isCorrect ? "text-green-700 font-bold" : "text-red-700 font-bold"}>{ans?.selected}</span> | Correct: <span className="text-green-700 font-bold">{q.correct_answer}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-center gap-4 p-8 border-t bg-muted/10">
            <Button onClick={() => setCurrentCase(null)} variant="outline" className="rounded-full px-8">New Investigation</Button>
            <Button onClick={handleGenerate} className="rounded-full px-8"><RotateCcw className="h-4 w-4 mr-2" /> Repeat Case</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 px-4 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-black tracking-tighter uppercase italic">Diagnostic Simulation</h1>
            <p className="text-muted-foreground font-medium">Expert-level clinical investigation and management.</p>
        </div>
        <Badge variant="secondary" className="px-4 py-1.5 rounded-full font-bold">
            Daily Usage: {dailyCount} / {DAILY_LIMIT}
        </Badge>
      </div>

      {!currentCase ? (
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden">
          <CardHeader className="bg-primary text-primary-foreground py-10 text-center">
            <BrainCircuit className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <CardTitle className="text-2xl font-black uppercase">Start Investigation</CardTitle>
            <CardDescription className="text-primary-foreground/70">Our AI will generate a complex, multi-stage clinical blueprint.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Select Specialty</Label>
                <Select onValueChange={setSelectedCategoryId} value={selectedCategoryId}>
                  <SelectTrigger className="h-12 rounded-xl border-2"><SelectValue placeholder="Pick a specialty..." /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground">Focus Topic (Optional)</Label>
                <Input 
                  placeholder="e.g. Acute Coronary Syndrome" 
                  value={customTopic} 
                  onChange={(e) => setCustomTopic(e.target.value)}
                  className="h-12 rounded-xl border-2"
                />
              </div>
            </div>
            <Button 
              className="w-full h-14 text-lg font-black uppercase tracking-widest shadow-lg" 
              onClick={handleGenerate} 
              disabled={isGenerating}
            >
              {isGenerating ? <><Loader2 className="h-6 w-6 animate-spin mr-2" /> Initializing Case...</> : <><Wand2 className="h-6 w-6 mr-2" /> Generate Expert Case</>}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in slide-in-from-bottom-6 duration-500">
          
          {/* Phase 1: Context/Briefing */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="border-none shadow-lg rounded-2xl h-full flex flex-col">
              <CardHeader className="bg-primary/5 border-b py-6">
                <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                  <Search className="h-5 w-5 text-primary" /> Initial Presentation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 flex-grow">
                <div className="p-4 bg-primary text-primary-foreground rounded-2xl shadow-inner italic font-medium leading-relaxed mb-6">
                    "{currentCase.brief_presentation}"
                </div>
                
                <div className="space-y-4">
                    <h4 className="font-black text-xs uppercase tracking-[0.2em] text-muted-foreground">Current Phase</h4>
                    <div className="flex flex-col gap-3">
                        <div className={cn("flex items-center gap-3 p-3 rounded-xl border-2 transition-all", viewMode === 'investigation' ? "border-primary bg-primary/5 shadow-md" : "opacity-40")}>
                            <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">1</div>
                            <span className="font-bold">Investigation</span>
                        </div>
                        <div className={cn("flex items-center gap-3 p-3 rounded-xl border-2 transition-all", viewMode === 'assessment' ? "border-primary bg-primary/5 shadow-md" : "opacity-40")}>
                            <div className="h-8 w-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">2</div>
                            <span className="font-bold">Assessment</span>
                        </div>
                    </div>
                </div>
              </CardContent>
              {viewMode === 'investigation' && (
                <CardFooter className="p-6 border-t bg-muted/10">
                    <Button onClick={() => setViewMode('assessment')} className="w-full h-12 rounded-xl font-bold uppercase tracking-tight">
                        End Investigation <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </CardFooter>
              )}
            </Card>
          </div>

          {/* Phase 2: Active Workspace (Chat or Quiz) */}
          <div className="lg:col-span-8">
            {viewMode === 'investigation' ? (
                <Card className="border-none shadow-xl rounded-3xl overflow-hidden h-[650px] flex flex-col bg-slate-50 dark:bg-slate-900">
                    <CardHeader className="bg-white border-b py-4 px-6 flex flex-row items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-black uppercase">Clinical Investigation</CardTitle>
                            <CardDescription className="text-[10px] font-bold text-primary">CHAT WITH THE CLINICAL TUTOR</CardDescription>
                        </div>
                        <BrainCircuit className="h-5 w-5 text-primary/30" />
                    </CardHeader>
                    
                    <ScrollArea className="flex-grow p-6" ref={chatScrollRef as any}>
                        <div className="space-y-6">
                            {chatMessages.map((m, i) => (
                                <div key={i} className={cn("flex", m.role === 'user' ? "justify-end" : "justify-start")}>
                                    <div className={cn(
                                        "max-w-[85%] p-4 rounded-2xl text-sm font-medium shadow-sm leading-relaxed",
                                        m.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-white border rounded-tl-none text-slate-800"
                                    )}>
                                        {m.content}
                                    </div>
                                </div>
                            ))}
                            {isChatLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-white border p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                        <span className="text-xs font-black uppercase text-muted-foreground">Analyzing Case...</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    <div className="p-4 bg-white border-t">
                        <form onSubmit={handleChat} className="flex gap-2">
                            <Input 
                                placeholder="Ask about labs, vitals, or history..." 
                                value={chatInput} 
                                onChange={(e) => setChatInput(e.target.value)}
                                className="h-12 rounded-xl bg-slate-50 border-none shadow-inner font-medium"
                                disabled={isChatLoading}
                            />
                            <Button type="submit" size="icon" className="h-12 w-12 rounded-xl shrink-0" disabled={isChatLoading || !chatInput.trim()}>
                                <Send className="h-5 w-5" />
                            </Button>
                        </form>
                    </div>
                </Card>
            ) : (
                <Card className="border-none shadow-xl rounded-3xl overflow-hidden animate-in slide-in-from-right-6 duration-300">
                    <CardHeader className="bg-primary text-primary-foreground py-6 px-8 border-b">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full">Phase 2: Final Assessment</span>
                            <span className="text-[10px] font-black">{currentQuestionIndex + 1} / {currentCase.questions.length}</span>
                        </div>
                        <CardTitle className="text-xl leading-tight font-bold">{currentCase.questions[currentQuestionIndex].question_text}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-8">
                        <RadioGroup 
                            onValueChange={setSelectedAnswer} 
                            value={selectedAnswer || ""} 
                            className="space-y-4"
                            disabled={isSubmitted}
                        >
                            {Object.entries(currentCase.questions[currentQuestionIndex].options).map(([key, value]) => {
                                const isCorrect = key === currentCase.questions[currentQuestionIndex].correct_answer;
                                const isSelected = selectedAnswer === key;
                                return (
                                    <div 
                                        key={key}
                                        className={cn(
                                            "flex items-center space-x-3 p-5 rounded-2xl border-2 transition-all cursor-pointer",
                                            isSelected && "border-primary bg-primary/5 shadow-md",
                                            isSubmitted && isCorrect && "border-green-600 bg-green-50 text-green-900 font-bold",
                                            isSubmitted && isSelected && !isCorrect && "border-red-600 bg-red-50 text-red-900 font-bold",
                                            !isSubmitted && !isSelected && "hover:border-muted-foreground/20"
                                        )}
                                        onClick={() => !isSubmitted && setSelectedAnswer(key)}
                                    >
                                        <RadioGroupItem value={key} id={`opt-${key}`} className="sr-only" />
                                        <Label htmlFor={`opt-${key}`} className="flex-grow cursor-pointer text-lg font-bold">
                                            <span className="opacity-30 mr-4 font-black">{key}</span> {value}
                                        </Label>
                                    </div>
                                );
                            })}
                        </RadioGroup>

                        {isSubmitted && (
                            <div className="p-8 bg-slate-50 rounded-3xl border-2 border-dashed border-primary/20 animate-in fade-in zoom-in-95">
                                <h4 className="font-black uppercase tracking-widest text-xs text-primary mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" /> Professional Rationale
                                </h4>
                                <div className="prose dark:prose-invert max-w-none text-slate-700 leading-relaxed font-medium">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                                        {currentCase.questions[currentQuestionIndex].explanation}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-between items-center p-8 bg-muted/10 border-t">
                        <Button variant="ghost" onClick={() => setViewMode('investigation')} className="rounded-full px-6 gap-2">
                           <History className="h-4 w-4" /> Review Lab Notes
                        </Button>
                        {!isSubmitted ? (
                            <Button onClick={handleSubmitAnswer} disabled={!selectedAnswer} className="rounded-full px-10 h-12 font-black uppercase">Confirm Diagnosis</Button>
                        ) : (
                            <Button onClick={handleNext} className="rounded-full px-10 h-12 font-black uppercase">
                                {currentQuestionIndex < currentCase.questions.length - 1 ? "Next Stage" : "Case Summary"} 
                                <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        )}
                    </CardFooter>
                </Card>
            )}
          </div>
        </div>
      )}

      <MadeWithDyad />
    </div>
  );
};

export default CaseStudiesPage;