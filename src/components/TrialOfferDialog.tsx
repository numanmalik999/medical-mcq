"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TrialOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onActivated: () => void;
}

const TrialOfferDialog = ({ open, onOpenChange, userId, onActivated }: TrialOfferDialogProps) => {
  const { toast } = useToast();
  const [isActivating, setIsActivating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleActivateTrial = async () => {
    setIsActivating(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase.functions.invoke('activate-trial', {
        body: { user_id: userId },
      });

      // Handle specific Edge Function error response
      if (error || data?.error) {
        const message = error?.message || data?.error || "Activation failed.";
        throw new Error(message);
      }

      toast({
        title: "Success!",
        description: "Your 3-day premium trial is now active. Enjoy!",
      });
      
      // Delay slightly so user can see toast before reload
      setTimeout(() => {
          onActivated();
          onOpenChange(false);
      }, 1500);

    } catch (error: any) {
      console.error("Trial Activation Error:", error);
      const detailedError = error.message?.includes("not found") 
        ? "The '3-Day Trial' plan hasn't been created yet. Please contact the administrator or check Admin Settings." 
        : error.message;
        
      setErrorMsg(detailedError);
      toast({
        title: "Activation Failed",
        description: detailedError,
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-primary p-8 text-primary-foreground text-center">
          <div className="mx-auto bg-white/20 p-4 rounded-full w-fit mb-4 backdrop-blur-sm">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">Gift: 3 Days Premium</DialogTitle>
          <p className="text-primary-foreground/80 text-sm font-medium mt-1">Unlock full access to master your exams.</p>
        </div>
        
        <div className="p-8 space-y-6 bg-background">
          <div className="space-y-3">
            {[
              "Access 5,000+ Premium MCQs",
              "Interactive AI Clinical Cases",
              "Unlimited Simulated Mock Exams",
              "Expert Video Explanations"
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span className="text-sm font-semibold text-slate-700">{feature}</span>
              </div>
            ))}
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <p>{errorMsg}</p>
            </div>
          )}

          <div className="space-y-3 pt-2">
            <Button 
                onClick={handleActivateTrial} 
                disabled={isActivating}
                className="w-full h-12 rounded-xl font-bold text-lg shadow-lg"
            >
              {isActivating ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : null}
              {isActivating ? "Activating..." : "Start My Free Trial"}
            </Button>
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full text-muted-foreground hover:text-foreground">
              Maybe Later
            </Button>
          </div>
          <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold">No credit card required</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrialOfferDialog;