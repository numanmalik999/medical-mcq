"use client";

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MadeWithDyad } from "@/components/made-with-dyad";
import { HelpCircle, BookOpen, CreditCard } from "lucide-react";

const faqs = [
  {
    category: "General",
    icon: <HelpCircle className="h-5 w-5 text-primary" />,
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
    category: "Study Tools",
    icon: <BookOpen className="h-5 w-5 text-primary" />,
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
    icon: <CreditCard className="h-5 w-5 text-primary" />,
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 pt-24">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">Frequently Asked Questions</h1>
          <p className="text-lg text-muted-foreground">Everything you need to know about preparing with Study Prometric.</p>
        </div>

        <div className="space-y-8">
          {faqs.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <div className="flex items-center gap-2 border-b pb-2">
                {section.icon}
                <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">{section.category}</h2>
              </div>
              <Accordion type="single" collapsible className="w-full space-y-2">
                {section.items.map((item, i) => (
                  <AccordionItem key={i} value={`item-${idx}-${i}`} className="bg-white dark:bg-gray-800 border rounded-lg px-4">
                    <AccordionTrigger className="hover:no-underline font-medium text-left">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          ))}
        </div>

        <Card className="mt-16 bg-primary text-primary-foreground border-none">
          <CardHeader className="text-center">
            <CardTitle>Still have questions?</CardTitle>
            <CardDescription className="text-primary-foreground/80">We're here to help you succeed.</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Link to="/contact">
              <Button variant="secondary" size="lg">Contact Support Team</Button>
            </Link>
          </CardContent>
        </Card>
        
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default FaqPage;