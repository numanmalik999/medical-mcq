"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';

const faqItems = [
  {
    category: "General Questions",
    questions: [
      {
        question: "What is Study Prometric MCQs?",
        answer: "Study Prometric MCQs is an online platform designed to help medical students and professionals prepare for their exams through interactive quizzes, simulated tests, and AI-powered explanations. We aim to provide a comprehensive and effective learning experience.",
      },
      {
        question: "Who is this platform for?",
        answer: "Our platform is ideal for anyone preparing for medical licensing exams, particularly those focusing on Prometric MCQs. This includes medical students, residents, and practicing physicians looking to refresh their knowledge.",
      },
      {
        question: "How do I get started?",
        answer: "You can start by signing up for a free trial to access a limited set of questions, or subscribe to one of our plans for full access to all features and our extensive question bank. Simply navigate to the 'Subscription' page to view our plans.",
      },
    ],
  },
  {
    category: "Account & Subscription",
    questions: [
      {
        question: "Is there a free trial?",
        answer: "Yes, we offer a free trial that allows you to attempt a limited number of trial questions to experience our platform before committing to a subscription. No credit card is required to start the trial.",
      },
      {
        question: "What payment methods do you accept?",
        answer: "We currently accept payments via PayPal, ensuring a secure and convenient transaction process. We are working to integrate more payment options in the future.",
      },
      {
        question: "How do I cancel my subscription?",
        answer: "You can manage your subscription directly through your PayPal account. For any issues, please contact our support team via the 'Contact Us' page.",
      },
      {
        question: "Can I upgrade or downgrade my subscription?",
        answer: "Currently, we offer a single subscription tier. If you wish to change your plan in the future, you may need to cancel your existing subscription and re-subscribe to a new plan.",
      },
    ],
  },
  {
    category: "Quizzes & Tests",
    questions: [
      {
        question: "How are the quizzes structured?",
        answer: "Our quizzes are organized by categories and subcategories, allowing you to focus on specific topics. Each question comes with a detailed explanation and AI-generated insights.",
      },
      {
        question: "What are simulated tests?",
        answer: "Simulated tests are designed to mimic real exam conditions. You can customize the number of questions, difficulty level, and set a time limit to practice under pressure.",
      },
      {
        question: "Can I review my past performance?",
        answer: "Yes, your user dashboard provides a comprehensive overview of your quiz performance, including accuracy rates, areas for improvement, and recent activity.",
      },
      {
        question: "What is the 'Attempt Incorrect' feature?",
        answer: "This feature allows subscribed users to specifically re-attempt questions they answered incorrectly in previous quizzes, helping to reinforce learning in weak areas.",
      },
    ],
  },
  {
    category: "Content & Feedback",
    questions: [
      {
        question: "Where do the MCQs come from?",
        answer: "Our question bank is curated by medical experts and continuously updated. Users can also submit their own MCQs for review and inclusion in the platform.",
      },
      {
        question: "How does AI help with explanations?",
        answer: "Our AI generates detailed explanations for each MCQ, breaking down why the correct answer is right and why others are wrong. It also provides insights into diagnostic tests and initial treatments.",
      },
      {
        question: "How can I submit feedback on a question?",
        answer: "While taking a quiz, you'll find an option to 'Add Notes or Feedback' for each MCQ. Your input helps us maintain the quality and accuracy of our content.",
      },
      {
        question: "Can I submit my own MCQs?",
        answer: "Absolutely! We encourage users to contribute. You can submit your MCQs through the 'Submit MCQ' page in your user panel. Our admin team will review them for approval.",
      },
    ],
  },
];

const FAQPage = () => {
  return (
    <div className="min-h-screen bg-background text-foreground pt-16 pb-12"> {/* Added pt-16 for fixed header */}
      <div className="container mx-auto px-4 max-w-4xl">
        <h1 className="text-4xl font-bold text-center mb-12">Frequently Asked Questions</h1>

        <div className="space-y-8">
          {faqItems.map((category, catIndex) => (
            <Card key={catIndex}>
              <CardHeader>
                <CardTitle className="text-2xl">{category.category}</CardTitle>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {category.questions.map((item, qIndex) => (
                    <AccordionItem key={qIndex} value={`item-${catIndex}-${qIndex}`}>
                      <AccordionTrigger className="text-left font-medium">{item.question}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default FAQPage;