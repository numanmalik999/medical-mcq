"use client";

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MadeWithDyad } from '@/components/made-with-dyad';
import Flashcard from '@/components/Flashcard';
import { Loader2, BrainCircuit, Zap, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface CardData {
  id: string;
  front_text: string;
  back_text: string;
  category_id: string;
  ease_factor: number;
  interval_days: number;
}

const FlashcardsPage = () => {
  const { user } = useSession();
  const { toast } = useToast();
  
  const [cards, setCards] = useState<CardData[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchDueCards = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // 1. Fetch due cards first
      const { data: progress } = await supabase
        .from('user_flashcard_progress')
        .select('flashcard_id, ease_factor, interval_days')
        .eq('user_id', user.id)
        .lte('next_review_at', new Date().toISOString());
      
      // 2. Fetch some cards to study
      let allCards: any[] = [];
      
      const { data: flashcards } = await supabase
        .from('flashcards')
        .select('*')
        .limit(20);

      if (flashcards) {
        allCards = flashcards.map(f => {
            const p = progress?.find(prog => prog.flashcard_id === f.id);
            return {
                ...f,
                ease_factor: p?.ease_factor || 2.5,
                interval_days: p?.interval_days || 0
            };
        });
      }

      setCards(allCards);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDueCards();
  }, [fetchDueCards]);

  const handleSRS = async (quality: 1 | 2 | 3 | 4) => {
    if (!user || !cards[currentIndex]) return;
    setIsUpdating(true);

    const currentCard = cards[currentIndex];
    let newEase = currentCard.ease_factor;
    let newInterval = 0;

    // Simplified SM-2 Logic
    if (quality === 1) { // Again
        newEase = Math.max(1.3, newEase - 0.2);
        newInterval = 0;
    } else if (quality === 2) { // Hard
        newEase = Math.max(1.3, newEase - 0.15);
        newInterval = currentCard.interval_days === 0 ? 1 : Math.ceil(currentCard.interval_days * 1.2);
    } else if (quality === 3) { // Good
        newInterval = currentCard.interval_days === 0 ? 1 : currentCard.interval_days === 1 ? 4 : Math.ceil(currentCard.interval_days * newEase);
    } else { // Easy
        newEase = Math.min(3.0, newEase + 0.15);
        newInterval = currentCard.interval_days === 0 ? 4 : Math.ceil(currentCard.interval_days * newEase * 1.3);
    }

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + newInterval);

    try {
        const { error } = await supabase
            .from('user_flashcard_progress')
            .upsert({
                user_id: user.id,
                flashcard_id: currentCard.id,
                ease_factor: newEase,
                interval_days: newInterval,
                next_review_at: nextReview.toISOString(),
                last_reviewed_at: new Date().toISOString()
            }, { onConflict: 'user_id,flashcard_id' });

        if (error) throw error;

        setIsFlipped(false);
        if (currentIndex < cards.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            toast({ title: "Session Complete!", description: "You've reviewed all cards for now." });
            fetchDueCards();
            setCurrentIndex(0);
        }
    } catch (err: any) {
        toast({ title: "Sync Error", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>;

  if (cards.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <Card className="border-none shadow-xl rounded-3xl overflow-hidden p-10 text-center">
            <BrainCircuit className="h-16 w-16 mx-auto mb-4 text-primary opacity-20" />
            <CardTitle className="text-2xl font-black uppercase">No Cards Ready</CardTitle>
            <CardDescription className="mt-2 font-medium">We are currently generating cards from your clinical bank. Check back soon!</CardDescription>
            <Button className="mt-8 rounded-full px-10" onClick={fetchDueCards}>Check Again</Button>
        </Card>
      </div>
    );
  }

  const progress = ((currentIndex) / cards.length) * 100;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
           <h1 className="text-3xl font-black uppercase italic tracking-tighter flex items-center gap-3">
              <Zap className="h-8 w-8 text-primary fill-primary" /> Memory Master
           </h1>
           <p className="text-muted-foreground font-medium">Spaced repetition for clinical dominance.</p>
        </div>
        <div className="text-right">
           <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Session Progress</p>
           <div className="flex items-center gap-3">
               <Progress value={progress} className="w-32 h-2" />
               <span className="text-xs font-black text-primary">{currentIndex + 1} / {cards.length}</span>
           </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-8">
        <Flashcard 
          front={cards[currentIndex].front_text} 
          back={cards[currentIndex].back_text} 
          isFlipped={isFlipped}
          onFlip={() => setIsFlipped(true)}
        />

        <div className={cn(
            "grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl transition-all duration-300",
            !isFlipped ? "opacity-0 pointer-events-none translate-y-4" : "opacity-100 translate-y-0"
        )}>
           <Button 
             variant="outline" 
             className="h-14 border-red-200 text-red-700 hover:bg-red-50 font-bold uppercase rounded-2xl flex flex-col"
             onClick={() => handleSRS(1)}
             disabled={isUpdating}
           >
             <span className="text-xs">Again</span>
             <span className="text-[10px] opacity-60">{"< 1m"}</span>
           </Button>
           <Button 
             variant="outline" 
             className="h-14 border-orange-200 text-orange-700 hover:bg-orange-50 font-bold uppercase rounded-2xl flex flex-col"
             onClick={() => handleSRS(2)}
             disabled={isUpdating}
           >
             <span className="text-xs">Hard</span>
             <span className="text-[10px] opacity-60">{"2d"}</span>
           </Button>
           <Button 
             variant="outline" 
             className="h-14 border-blue-200 text-blue-700 hover:bg-blue-50 font-bold uppercase rounded-2xl flex flex-col"
             onClick={() => handleSRS(3)}
             disabled={isUpdating}
           >
             <span className="text-xs">Good</span>
             <span className="text-[10px] opacity-60">{"4d"}</span>
           </Button>
           <Button 
             variant="outline" 
             className="h-14 border-green-200 text-green-700 hover:bg-green-50 font-bold uppercase rounded-2xl flex flex-col"
             onClick={() => handleSRS(4)}
             disabled={isUpdating}
           >
             <span className="text-xs">Easy</span>
             <span className="text-[10px] opacity-60">{"7d"}</span>
           </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm rounded-3xl bg-muted/20">
         <CardContent className="p-8 flex flex-col md:flex-row items-center gap-6">
            <div className="p-4 bg-white rounded-2xl shadow-sm">
                <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <div>
                <h4 className="font-bold text-lg">Did you know?</h4>
                <p className="text-sm text-slate-600 leading-relaxed">
                    Study Prometric automatically extracts "Pearls" from every MCQ you solve and adds them to this deck. The more quizzes you take, the smarter your deck becomes!
                </p>
            </div>
         </CardContent>
      </Card>
      
      <MadeWithDyad />
    </div>
  );
};

export default FlashcardsPage;