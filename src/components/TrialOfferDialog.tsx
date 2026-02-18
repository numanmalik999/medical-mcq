"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Sparkles, MessageSquare, Loader2, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TrialOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

const TrialOfferDialog = ({ open, onOpenChange, userId }: TrialOfferDialogProps) => {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSendOtp = async () => {
    if (!phoneNumber.trim()) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('send-whatsapp-otp', {
        body: { user_id: userId, phone_number: phoneNumber },
      });
      if (error) throw error;

      toast({ title: "Code Sent", description: "Check your WhatsApp for the 6-digit code." });
      setStep('otp');
    } catch (error: any) {
      toast({ title: "Failed to send", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length < 6) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-whatsapp-otp', {
        body: { user_id: userId, code: otpCode },
      });

      if (error || data?.error) throw new Error(error?.message || data?.error);

      toast({ title: "Success!", description: "Account verified. Enjoy your 3-day trial." });
      setTimeout(() => window.location.reload(), 1500);

    } catch (error: any) {
      toast({ title: "Verification Failed", description: error.message, variant: "destructive" });
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
                <DialogTitle className="text-3xl font-black uppercase italic tracking-tighter leading-none mb-2">Verified Access</DialogTitle>
                <DialogDescription className="text-primary-foreground/80 font-medium text-sm">
                    Protect your account and unlock your 3-day premium pass.
                </DialogDescription>
            </div>
        </div>

        <div className="p-8 space-y-6">
            {step === 'phone' ? (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Mobile Number</Label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input 
                                placeholder="+971..." 
                                className="pl-10 h-12 rounded-xl" 
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">Enter your WhatsApp number with country code.</p>
                    </div>

                    <Button 
                        className="w-full h-12 rounded-xl font-black uppercase tracking-widest shadow-lg" 
                        onClick={handleSendOtp}
                        disabled={isLoading || !phoneNumber}
                    >
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4 mr-2" />}
                        Send WhatsApp Code
                    </Button>
                </div>
            ) : (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                    <div className="space-y-2 text-center">
                        <Label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Enter 6-Digit Code</Label>
                        <Input 
                            placeholder="000000" 
                            className="h-14 text-center text-2xl font-black tracking-[0.5em] rounded-xl"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                        />
                    </div>
                    <Button 
                        className="w-full h-14 rounded-2xl text-lg font-black uppercase tracking-widest shadow-xl" 
                        onClick={handleVerifyOtp}
                        disabled={isLoading || otpCode.length < 6}
                    >
                        {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Verify & Activate"}
                    </Button>
                    <Button variant="ghost" className="w-full text-[10px] font-bold uppercase" onClick={() => setStep('phone')}>
                        Change Phone Number
                    </Button>
                </div>
            )}
            
            <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3 opacity-60">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-tight text-slate-500">Secure Meta Verification</span>
                </div>
                <Button variant="ghost" className="w-full text-muted-foreground font-bold text-[10px] uppercase" onClick={() => onOpenChange(false)}>
                    Maybe Later
                </Button>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrialOfferDialog;