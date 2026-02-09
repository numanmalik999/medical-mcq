"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MessageCircle, Send, X, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

const WhatsappChatBubble = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  
  const whatsappNumber = "923174636479"; // Formatted for the link

  const handleStartChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    setIsOpen(false);
    setMessage('');
  };

  return (
    <div className="fixed bottom-6 left-6 z-50 flex flex-col items-start gap-4">
      {/* Chat Box */}
      {isOpen && (
        <Card className="w-72 sm:w-80 shadow-2xl border-none rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
          <CardHeader className="bg-[#25D366] text-white p-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold">Study Prometric</CardTitle>
                  <p className="text-[10px] opacity-90 font-medium">Typically replies in minutes</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 text-white hover:bg-white/10 rounded-full"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4 bg-[#f0f2f5] dark:bg-slate-900">
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl rounded-tl-none shadow-sm mb-4">
              <p className="text-xs text-slate-700 dark:text-slate-200">
                Hi there! 👋 How can we help you with your Prometric exam preparation today?
              </p>
            </div>
            
            <form onSubmit={handleStartChat} className="flex gap-2">
              <Input 
                placeholder="Type your message..." 
                className="h-10 rounded-xl bg-white border-none shadow-inner text-sm"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button 
                type="submit" 
                size="icon" 
                className="h-10 w-10 shrink-0 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl shadow-md"
                disabled={!message.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Trigger Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-14 w-14 rounded-full shadow-2xl transition-all duration-300 group",
          isOpen ? "bg-slate-200 text-slate-600 rotate-90" : "bg-[#25D366] hover:bg-[#128C7E] text-white"
        )}
        size="icon"
      >
        {isOpen ? <X className="h-7 w-7" /> : <MessageCircle className="h-7 w-7" />}
        {!isOpen && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500"></span>
            </span>
        )}
      </Button>
    </div>
  );
};

export default WhatsappChatBubble;