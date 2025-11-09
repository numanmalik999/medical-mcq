"use client";

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import * as LucideIcons from 'lucide-react'; // Import all Lucide icons
import { CalendarDays, Check, Loader2, Zap, Trophy, Globe, BookOpenText, GraduationCap } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useLandingPageSettings } from '@/hooks/useLandingPageSettings'; // Import new hook

// Helper to get Lucide Icon component by name
const getIconComponent = (iconName: string) => {
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className="h-8 w-8 text-primary" /> : <Globe className="h-8 w-8 text-primary" />;
};

// Define a type for FAQ items (simplified for landing page display)
interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  category: string;
  questions: FaqItem[];
}

interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_in_months: number;
  description: string | null;
  features: string[] | null;
  stripe_price_id: string | null;
}

const defaultFaqItems: FaqCategory[] = [
  {
    category: "General Questions",
    questions: [
      {
        question: "What is Study Prometric MCQs?",
        answer: "Study Prometric MCQs is an online platform designed to help medical students and professionals prepare for their exams through interactive quizzes, simulated tests, and AI-powered explanations.",
      },
      {
        question: "How do I get started?",
        answer: "You can start by signing up for a free trial to access a limited set of questions, or subscribe to one of our plans for full access to all features and our extensive question bank.",
      },
    ],
  },
];

const marketingFormSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
});

const LandingPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const { settings, isLoading: isLoadingSettings } = useLandingPageSettings();
  
  const [faqItems, setFaqItems] = useState<FaqCategory[]>(defaultFaqItems);
  const [isLoadingFaq, setIsLoadingFaq] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);
  const [isFetchingTiers, setIsFetchingTiers] = useState(true);

  const marketingForm = useForm<z.infer<typeof marketingFormSchema>>({
    resolver: zodResolver(marketingFormSchema),
    defaultValues: {
      email: "",
    },
  });

  // --- SEO and Meta Tag Update ---
  useEffect(() => {
    if (!isLoadingSettings) {
      document.title = settings.seo.metaTitle;
      
      // Helper function to update or create meta tags
      const updateMetaTag = (name: string, content: string) => {
        let tag = document.querySelector(`meta[name="${name}"]`);
        if (!tag) {
          tag = document.createElement('meta');
          tag.setAttribute('name', name);
          document.head.appendChild(tag);
        }
        tag.setAttribute('content', content);
      };

      updateMetaTag('description', settings.seo.metaDescription);
      if (settings.seo.keywords) {
        updateMetaTag('keywords', settings.seo.keywords);
      }
    }
  }, [isLoadingSettings, settings.seo]);

  useEffect(() => {
    const fetchFaqContent = async () => {
      setIsLoadingFaq(true);
      const { data, error } = await supabase
        .from('static_pages')
        .select('content')
        .eq('slug', 'faq')
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching FAQ content for landing page:', error);
      } else if (data) {
        try {
          const parsedContent = JSON.parse(data.content || '[]');
          if (Array.isArray(parsedContent) && parsedContent.every(item => 'category' in item && 'questions' in item)) {
            const landingPageFaqs = parsedContent.slice(0, 1).flatMap(cat => cat.questions.slice(0, 4));
            setFaqItems([{ category: "Frequently Asked Questions", questions: landingPageFaqs }]);
          } else {
            setFaqItems(defaultFaqItems);
          }
        } catch (parseError) {
          setFaqItems(defaultFaqItems);
        }
      }
      setIsLoadingFaq(false);
    };

    const fetchSubscriptionTiers = async () => {
      setIsFetchingTiers(true);
      const { data: tiersData, error: tiersError } = await supabase
        .from('subscription_tiers')
        .select('*, stripe_price_id')
        .order('price', { ascending: true });

      if (tiersError) {
        console.error('Error fetching subscription tiers:', tiersError);
        toast({ title: "Error", description: "Failed to load subscription plans.", variant: "destructive" });
        setSubscriptionTiers([]);
      } else {
        setSubscriptionTiers(tiersData || []);
      }
      setIsFetchingTiers(false);
    };

    fetchFaqContent();
    fetchSubscriptionTiers();
  }, [toast]);

  const handleMarketingSubscribe = async (values: z.infer<typeof marketingFormSchema>) => {
    setIsSubscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke('subscribe-marketing-email', {
        body: { email: values.email },
      });

      if (error) {
        if (error.status === 409) {
          toast({
            title: "Already Subscribed",
            description: "This email is already on our mailing list!",
            variant: "default",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Subscription Successful!",
          description: data.message || "Check your inbox for a confirmation email.",
          variant: "default",
        });
        marketingForm.reset();
      }
    } catch (error: any) {
      console.error("Client: Marketing subscription error:", error);
      toast({
        title: "Subscription Failed",
        description: `Failed to subscribe: ${error.message || 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  if (!hasCheckedInitialSession || isLoadingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      {/* Hero Section */}
      <section className="relative w-full py-20 md:py-32 bg-gradient-to-r from-primary to-blue-600 text-primary-foreground text-center overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 animate-fade-in-up">
            {settings.hero.mainTitle}
          </h1>
          <p className="text-lg md:text-xl mb-10 max-w-3xl mx-auto opacity-90 animate-fade-in-up delay-200">
            {settings.hero.subtitle}
          </p>
          <div className="flex flex-col justify-center gap-4 max-w-sm mx-auto sm:flex-row sm:max-w-none animate-fade-in-up delay-400">
            {user ? (
              <>
                <Link to={user.is_admin ? "/admin/dashboard" : "/user/dashboard"} className="w-full sm:w-auto">
                  <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 w-full">
                    Go to Dashboard
                  </Button>
                </Link>
                <Link to="/quiz-of-the-day" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="flex items-center gap-2 w-full">
                    <CalendarDays className="h-5 w-5" /> Question of the Day
                  </Button>
                </Link>
                <Link to="/quiz" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="flex items-center gap-2 w-full">
                    <BookOpenText className="h-5 w-5" /> Take a Quiz
                  </Button>
                </Link>
                <Link to="/user/courses" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="flex items-center gap-2 w-full">
                    <GraduationCap className="h-5 w-5" /> Browse Courses
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/signup" className="w-full sm:w-auto">
                  <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 w-full">
                    {settings.hero.ctaPrimaryText}
                  </Button>
                </Link>
                <Link to="/quiz" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="flex items-center gap-2 w-full">
                    <BookOpenText className="h-5 w-5" /> {settings.hero.ctaSecondaryText}
                  </Button>
                </Link>
                <Link to="/quiz-of-the-day" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="flex items-center gap-2 w-full">
                    <CalendarDays className="h-5 w-5" /> Question of the Day
                  </Button>
                </Link>
                <Link to="/user/courses" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="flex items-center gap-2 w-full">
                    <GraduationCap className="h-5 w-5" /> Browse Courses
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
        {/* Background shapes for visual appeal */}
        <div className="absolute inset-0 z-0 opacity-20">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute top-1/2 right-1/4 w-72 h-72 bg-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute bottom-1/4 left-1/2 w-80 h-80 bg-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose Us?</h2>
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            Unlock your full potential with our comprehensive and intelligent learning tools.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {settings.features.map((feature, index) => (
              <Card key={index} className="flex flex-col items-center p-6 text-center hover:shadow-lg transition-shadow duration-300">
                <div className="mb-4 p-3 rounded-full bg-primary/10">
                  {getIconComponent(feature.icon)}
                </div>
                <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                <CardDescription className="text-muted-foreground">{feature.description}</CardDescription>
              </Card>
            ))}
          </div>
        </div>
      </section>
      
      {/* New Section: Why We Are Different & Result Promise (Hardcoded for now) */}
      <section className="py-16 md:py-24 bg-secondary text-secondary-foreground">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* What Makes Us Different */}
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
                <Zap className="h-8 w-8 text-primary-foreground" /> What Makes Us Different?
              </h2>
              <p className="text-lg">
                We go beyond simple flashcards and static question banks. Our platform is built on three core pillars designed for modern medical education:
              </p>
              <ul className="space-y-4 text-base list-disc list-inside ml-4">
                <li>
                  <strong className="font-semibold">AI-Driven Insights:</strong> Every explanation is enhanced by AI to provide clinical context, diagnostic tests, and initial treatment plans, turning every question into a comprehensive learning module.
                </li>
                <li>
                  <strong className="font-semibold">Community-Curated Content:</strong> Our question bank is constantly growing and validated by both experts and a community of peers, ensuring high relevance and accuracy for Prometric exams.
                </li>
                <li>
                  <strong className="font-semibold">Adaptive Testing:</strong> Our system tracks your performance across categories and difficulties, allowing you to specifically target your weak areas with the "Attempt Incorrect" feature and personalized recommendations.
                </li>
              </ul>
            </div>

            {/* Result Promise */}
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
                <Trophy className="h-8 w-8 text-primary-foreground" /> What’s the Result Promise?
              </h2>
              <p className="text-lg">
                Our commitment is simple: **Confidence and Competence.**
              </p>
              <ul className="space-y-4 text-base list-disc list-inside ml-4">
                <li>
                  <strong className="font-semibold">Maximize Retention:</strong> By focusing on detailed explanations and spaced repetition through targeted practice, you won't just memorize answers—you'll understand the underlying concepts.
                </li>
                <li>
                  <strong className="font-semibold">Simulate Success:</strong> Our timed, full-length tests prepare you mentally and physically for the pressure of the actual exam, reducing anxiety on test day.
                </li>
                <li>
                  <strong className="font-semibold">Guaranteed Improvement:</strong> Consistent use of our platform leads to measurable gains in accuracy and speed, transforming your weakest subjects into areas of strength. We aim to make you exam-ready, not just quiz-ready.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Subscription Tiers Section */}
      <section className="py-16 md:py-24 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">{settings.pricingCta.title}</h2>
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            {settings.pricingCta.subtitle}
          </p>
          
          {isFetchingTiers ? (
            <div className="flex justify-center items-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : subscriptionTiers.length === 0 ? (
            <p className="text-center text-muted-foreground">No subscription plans available at the moment.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {subscriptionTiers.map((tier) => {
                const isStripePlanAvailable = !!tier.stripe_price_id;
                
                const ctaLink = user 
                  ? isStripePlanAvailable ? `/user/payment/${tier.id}?priceId=${tier.stripe_price_id}` : '#'
                  : `/signup?tierId=${tier.id}`;
                
                const ctaText = user 
                  ? isStripePlanAvailable ? 'Subscribe Now' : 'Payment Not Configured'
                  : 'Sign Up & Subscribe';

                return (
                  <Card key={tier.id} className="flex flex-col text-left shadow-lg hover:shadow-xl transition-shadow duration-300">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-2xl">{tier.name}</CardTitle>
                      <CardDescription>{tier.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-4 border-b pb-6">
                      <p className="text-4xl font-bold">
                        {tier.currency} {tier.price.toFixed(2)}
                        <span className="text-lg font-normal text-muted-foreground"> / {tier.duration_in_months} month{tier.duration_in_months > 1 ? 's' : ''}</span>
                      </p>
                      {tier.features && tier.features.length > 0 && (
                        <ul className="space-y-2">
                          {tier.features.map((feature, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-600 mt-1 flex-shrink-0" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </CardContent>
                    <CardFooter className="pt-6">
                      <Link to={ctaLink} className="w-full">
                        <Button className="w-full" disabled={!isStripePlanAvailable && !!user}>
                          {ctaText}
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Marketing Email Subscription Section */}
      <section className="py-16 md:py-24 bg-secondary text-secondary-foreground text-center">
        <div className="container mx-auto px-4 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Stay Updated!</h2>
          <p className="text-lg mb-8">
            Subscribe to our newsletter for daily quiz updates, study tips, and special offers.
          </p>
          <Form {...marketingForm}>
            <form onSubmit={marketingForm.handleSubmit(handleMarketingSubscribe)} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <FormField
                control={marketingForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        className="h-12 text-lg"
                        disabled={isSubscribing}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-left" />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" className="h-12 text-lg w-full sm:w-auto" disabled={isSubscribing}>
                {isSubscribing ? "Subscribing..." : "Subscribe"}
              </Button>
            </form>
          </Form>
        </div>
      </section>

      {/* FAQ Section (Embedded) */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="max-w-3xl mx-auto">
            {isLoadingFaq ? (
              <p className="text-center text-gray-600 dark:text-gray-400">Loading FAQs...</p>
            ) : (
              <Accordion type="single" collapsible className="w-full">
                {faqItems.flatMap((category, catIndex) =>
                  category.questions.map((item, qIndex) => (
                    <AccordionItem key={`${catIndex}-${qIndex}`} value={`item-${catIndex}-${qIndex}`}>
                      <AccordionTrigger className="text-left text-lg font-medium">{item.question}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground text-base">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))
                )}
              </Accordion>
            )}
            <p className="text-center text-muted-foreground mt-8">
              Have more questions? Visit our dedicated <Link to="/faq" className="text-primary hover:underline">FAQ Page</Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;