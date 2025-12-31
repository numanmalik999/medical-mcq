"use client";

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { HelpCircle, BookOpen, CreditCard } from "lucide-react";

const faqs = [
  {
    category: "General Information",
    icon: <HelpCircle className="h-5 w-5 text-blue-600" />,
    items: [
      {
        question: "What is Study Prometric MCQs?",
        answer: "Study Prometric is a specialized platform designed to help medical professionals (doctors, nurses, pharmacists) prepare for licensing exams in the Gulf region, including DHA, MOH, HAAD, SMLE, and more."
      },
      {
        question: "How accurate are the questions?",
        answer: "Our question bank is regularly updated and audited using clinical AI and expert review to ensure alignment with the latest exam patterns and medical guidelines."
      }
    ]
  },
  {
    category: "Our Study Tools",
    icon: <BookOpen className="h-5 w-5 text-blue-600" />,
    items: [
      {
        question: "What are AI Clinical Cases?",
        answer: "These are interactive, multi-step scenarios that simulate real patient encounters. They test your diagnostic logic and management skills beyond simple recall questions."
      },
      {
        question: "Can I take timed tests?",
        answer: "Yes! Our 'Take a Test' feature allows you to simulate real exam conditions with customizable timers, question counts, and difficulty levels."
      },
      {
        question: "Is there offline access?",
        answer: "If you are using our mobile application, you can download specific categories for offline study, allowing you to practice even without an internet connection."
      }
    ]
  },
  {
    category: "Subscription & Rewards",
    icon: <CreditCard className="h-5 w-5 text-blue-600" />,
    items: [
      {
        question: "How do I win a free month of subscription?",
        answer: "Participate in the 'Question of the Day'. Every correct answer earns you points. Accumulate 500 points to automatically unlock a free month of premium access!"
      },
      {
        question: "Is there a free trial?",
        answer: "Yes, new users can access a limited set of trial MCQs to experience the platform before committing to a paid plan."
      }
    ]
  }
];

const FaqPage = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 pt-24">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4">Frequently Asked Questions</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">Everything you need to know about preparing with Study Prometric.</p>
        </div>

        <div className="space-y-10">
          {faqs.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                    {section.icon}
                </div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200">{section.category}</h2>
              </div>
              <Accordion type="single" collapsible className="w-full space-y-3">
                {section.items.map((item, i) => (
                  <AccordionItem key={i} value={`item-${idx}-${i}`} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 shadow-sm overflow-hidden">
                    <AccordionTrigger className="hover:no-underline font-semibold text-left text-slate-900 dark:text-white py-4">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-slate-600 dark:text-slate-400 leading-relaxed pb-4 border-t border-slate-50 dark:border-slate-800 pt-3">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>

        <Card className="mt-16 bg-blue-600 text-white border-none shadow-xl rounded-3xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full translate-x-1/2 -translate-y-1/2 blur-2xl"></div>
          <CardHeader className="text-center relative z-10 pt-10">
            <CardTitle className="text-2xl text-white">Still have questions?</CardTitle>
            <CardDescription className="text-blue-100 text-lg">We're here to help you succeed in your medical career.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-10 relative z-10">
            <Link to="/contact">
              <Button variant="secondary" size="lg" className="bg-white text-blue-600 hover:bg-slate-100 px-8 py-6 text-lg font-bold shadow-lg">Contact Support Team</Button>
            </Link>
          </CardContent>
        </Card>
        
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default FaqPage;