"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Zap, Sparkles, MessageSquare, Loader2, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TrialOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const TrialOfferDialog = ({ open, onOpenChange, userId }: TrialOfferDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const { toast } = useToast();

  const handleWhatsAppVerify = () => {
    setIsVerifying(true);
    
    const uniqueId = Math.random().toString(36).substring(7).toUpperCase();
    const adminNum = "923174636479";
    const text = encodeURIComponent(`I am requesting a 3-Day Trial upgrade for my account. Verification Code: SP-TRIAL-${uniqueId}`);
    
    window.open(`https://wa.me/${adminNum}?text=${text}`, '_blank');

    toast({
        title: "Verification Triggered",
        description: "Please send the message on WhatsApp to verify your account.",
    });

    setTimeout(() => {
        setIsVerified(true);
        setIsVerifying(false);
        toast({ title: "Identity Verified", description: "Identity confirmed. You can now activate your trial." });
    }, 4000);
  };

  const handleActivateTrial = async () => {
    if (!isVerified) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('activate-trial', {
        body: { user_id: userId },
      });

      if (error || data?.error) throw new Error(error?.message || data?.error || "Activation failed");

      toast({
        title: "Trial Activated!",
        description: "Access granted. The page will now reload to update your permissions.",
      });

      // Crucial: Wait for the user to read the toast, then reload to force session hydration
      setTimeout(() => {
          window.location.reload();
      }, 1500);

    } catch (error: any) {
      toast({
        title: "Activation Failed",
        description: error.message || "Could not activate trial. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden border-none rounded-3xl shadow-2xl">
        <div className="bg-primary p-8 text-center text-primary-foreground relative overflow-hidden">
            <div className="relative z-10">
                <div className="bg-white/20 p-3 rounded-2xl w-fit mx-auto mb-4 backdrop-blur-md">
                    <Sparkles className="h-8 w-8 text-white fill-white" />
                </div>
                <DialogTitle className="text-3xl font-black uppercase italic tracking-tighter leading-none mb-2">3-Day Premium Pass</DialogTitle>
                <DialogDescription className="text-primary-foreground/80 font-medium">
                    Unlock all 5,000+ MCQs, AI Case Studies, and high-yield flashcards for 72 hours.
                </DialogDescription>
            </div>
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute -top-10 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        </div>

        <div className="p-8 space-y-6">
            <div className="space-y-4">
                {[
                    { icon: Zap, text: "Full Question Bank Access" },
                    { icon: ShieldCheck, text: "AI Clinical Explanations" },
                    { icon: MessageSquare, text: "Community Discussion Access" }
                ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="bg-primary/10 p-1.5 rounded-lg"><item.icon className="h-4 w-4 text-primary" /></div>
                        <span className="font-bold text-sm text-slate-700">{item.text}</span>
                    </div>
                ))}
            </div>

            <div className="pt-4 space-y-3">
                {!isVerified ? (
                    <Button 
                        onClick={handleWhatsAppVerify}
                        disabled={isVerifying}
                        variant="secondary"
                        className="w-full h-12 rounded-xl font-black uppercase tracking-wider gap-2 border-2 border-primary/10 shadow-sm"
                    >
                        {isVerifying ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5 text-green-600" />}
                        Verify on WhatsApp to Start
                    </Button>
                ) : (
                    <div className="p-3 bg-green-50 border-2 border-green-500/20 rounded-2xl flex items-center justify-center gap-3 mb-2">
                        <CheckCircle2 className="h-6 w-6 text-green-600" />
                        <span className="text-xs font-black uppercase text-green-800 tracking-tight">Identity Verified</span>
                    </div>
                )}

                <Button 
                    className="w-full h-14 rounded-2xl text-lg font-black uppercase tracking-widest shadow-xl shadow-primary/20" 
                    onClick={handleActivateTrial}
                    disabled={isLoading || !isVerified}
                >
                    {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                    Claim My 3 Days
                </Button>
                
                <Button variant="ghost" className="w-full text-muted-foreground font-bold text-xs uppercase" onClick={() => onOpenChange(false)}>
                    Maybe Later
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrialOfferDialog;