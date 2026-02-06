"use client";

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Lock, Sparkles, ArrowRight } from 'lucide-react';

interface SubscribePromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  description?: string;
}

const SubscribePromptDialog = ({ open, onOpenChange, featureName, description }: SubscribePromptDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] rounded-3xl p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-primary p-8 text-primary-foreground text-center relative">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-white rounded-full blur-2xl"></div>
             <div className="absolute bottom-[-10%] left-[-10%] w-32 h-32 bg-white rounded-full blur-2xl"></div>
          </div>
          <div className="mx-auto bg-white/20 p-4 rounded-full w-fit mb-4 backdrop-blur-sm shadow-inner">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <DialogTitle className="text-2xl font-black uppercase tracking-tight mb-2">Premium Access Required</DialogTitle>
          <p className="text-primary-foreground/80 text-sm font-medium">Unlock the full potential of your study session.</p>
        </div>
        
        <div className="p-8 space-y-6 bg-background">
          <div className="space-y-2">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> 
              {featureName}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {description || "To use this feature and access our full high-yield question bank, please choose a subscription plan that fits your schedule."}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <Link to="/user/subscriptions" className="w-full block">
              <Button className="w-full h-12 rounded-xl font-bold text-lg shadow-lg group">
                View Pricing Plans <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full text-muted-foreground hover:text-foreground">
              Maybe Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscribePromptDialog;