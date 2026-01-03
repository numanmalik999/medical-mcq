"use client";

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import * as LucideIcons from 'lucide-react'; 
import { Check, Loader2, Globe, BookOpenText, ArrowRight, ClipboardCheck, Video, GraduationCap, Trophy } from 'lucide-react';
import { useSession } from '@/components/SessionContextProvider';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { useLandingPageSettings } from '@/hooks/useLandingPageSettings';
import LoadingBar from '@/components/LoadingBar';

const getIconComponent = (iconName: string) => {
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className="h-8 w-8 text-primary" /> : <Globe className="h-8 w-8 text-primary" />;
};

const getFeatureBlogLink = (title: string) => {
  const mapping: { [key: string]: string } = {
    "AI Clinical Cases": "/blog/ai-clinical-cases",
    "Verified Accuracy": "/blog/verified-accuracy",
    "Simulated Tests": "/blog/simulated-tests",
    "Curated Video Library": "/blog/curated-video-library",
    "AI Medical Assistant": "/blog/ai-medical-assistant",
    "Daily Challenge": "/blog/daily-challenge"
  };
  return mapping[title] || "/subscription";
};

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

const marketingFormSchema = z.object({
  email: z.string().email("Invalid email address.").min(1, "Email is required."),
});

const LandingPage = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const { toast } = useToast();
  const { settings, isLoading: isLoadingSettings } = useLandingPageSettings();
  
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subscriptionTiers, setSubscriptionTiers] = useState<SubscriptionTier[]>([]);

  const isSubscribed = user?.has_active_subscription;

  const marketingForm = useForm<z.infer<typeof marketingFormSchema>>({
    resolver: zodResolver(marketingFormSchema),
    defaultValues: {
      email: "",
    },
  });

  useEffect(() => {
    if (!isLoadingSettings) {
      document.title = settings.seo.metaTitle;
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
    const fetchSubscriptionTiers = async () => {
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
    };

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
          toast({ title: "Already Subscribed", description: "This email is already on our mailing list!" });
        } else {
          throw error;
        }
      } else {
        toast({ title: "Subscription Successful!", description: data.message || "Check your inbox for confirmation." });
        marketingForm.reset();
      }
    } catch (error: any) {
      toast({ title: "Subscription Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsSubscribing(false);
    }
  };

  if (!hasCheckedInitialSession || isLoadingSettings) {
    return <LoadingBar />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground pt-16">
      {/* Hero Section */}
      <section className="relative w-full py-8 md:py-12 bg-primary text-primary-foreground text-center overflow-hidden">
        <div className="container mx-auto px-4 relative z-10">
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-3 animate-fade-in-up">
            {settings.hero.mainTitle}
          </h1>
          <p className="text-lg md:text-xl mb-6 max-w-3xl mx-auto opacity-90 animate-fade-in-up delay-200">
            {settings.hero.subtitle}
          </p>
          
          <div className="flex flex-col items-center gap-4 animate-fade-in-up delay-400">
            {/* Primary Action Row */}
            <div className="flex flex-col justify-center gap-3 w-full max-w-md lg:max-w-none lg:flex-row">
              <Link to={user ? "/user/dashboard" : "/subscription"} className="w-full lg:w-auto">
                <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 w-full min-w-[200px]">
                  {user ? "Go to Dashboard" : settings.hero.ctaPrimaryText}
                </Button>
              </Link>
              <Link to="/quiz" className="w-full lg:w-auto">
                <Button size="lg" variant="secondary" className="flex items-center gap-2 w-full min-w-[200px]">
                  <BookOpenText className="h-5 w-5" /> Take a Free Quiz
                </Button>
              </Link>
              <Link to="/quiz-of-the-day" className="w-full lg:w-auto">
                <Button size="lg" variant="outline" className="bg-white/10 hover:bg-white/20 border-white/30 text-white flex items-center gap-2 w-full min-w-[200px]">
                  <Trophy className="h-5 w-5 text-yellow-400" /> Quiz of the Day
                </Button>
              </Link>
            </div>

            {/* Quick Feature Access Row */}
            <div className="flex flex-wrap justify-center gap-2">
              <Link to={isSubscribed ? "/user/take-test" : "/subscription"}>
                <Button variant="outline" size="sm" className="bg-white/10 hover:bg-white/20 border-white/30 text-white flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" /> Take a Test
                </Button>
              </Link>
              <Link to={isSubscribed ? "/user/videos" : "/subscription"}>
                <Button variant="outline" size="sm" className="bg-white/10 hover:bg-white/20 border-white/30 text-white flex items-center gap-2">
                  <Video className="h-4 w-4" /> Video Lessons
                </Button>
              </Link>
              <Link to={isSubscribed ? "/user/courses" : "/subscription"}>
                <Button variant="outline" size="sm" className="bg-white/10 hover:bg-white/20 border-white/30 text-white flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Medical Courses
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-10 md:py-14 bg-background">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Powerful Learning Tools</h2>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            Everything you need to master your medical licensing exams.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {settings.features.map((feature, index) => (
              <Card key={index} className="flex flex-col items-center p-6 text-center hover:shadow-lg transition-all hover:-translate-y-1">
                <div className="mb-4 p-3 rounded-full bg-primary/10">
                  {getIconComponent(feature.icon)}
                </div>
                <CardTitle className="text-xl mb-2">{feature.title}</CardTitle>
                <CardDescription className="text-muted-foreground">{feature.description}</CardDescription>
                <CardFooter className="mt-auto pt-4 w-full">
                  <Link to={getFeatureBlogLink(feature.title)} className="w-full">
                    <Button variant="ghost" className="w-full group">
                      Learn More <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Subscription Tiers Section */}
      <section className="py-12 md:py-16 bg-slate-900 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-2 text-white">{settings.pricingCta.title}</h2>
          <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
            {settings.pricingCta.subtitle}
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {subscriptionTiers.map((tier) => (
              <Card key={tier.id} className="flex flex-col text-left shadow-lg hover:shadow-xl transition-all border-slate-800 bg-slate-950">
                <CardHeader className="pb-4">
                  <CardTitle className="text-2xl text-white">{tier.name}</CardTitle>
                  <CardDescription className="text-slate-400">{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-4 border-b border-slate-800 pb-6">
                  <p className="text-4xl font-bold text-white">
                    {tier.currency} {tier.price.toFixed(2)}
                    <span className="text-lg font-normal text-slate-400"> / {tier.duration_in_months} month{tier.duration_in_months > 1 ? 's' : ''}</span>
                  </p>
                  {tier.features && tier.features.length > 0 && (
                    <ul className="space-y-2">
                      {tier.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-slate-300">
                          <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
                <CardFooter className="pt-6">
                  <Link to={user ? `/user/payment/${tier.id}?priceId=${tier.stripe_price_id}` : `/signup?tierId=${tier.id}`} className="w-full">
                    <Button className="w-full bg-white text-slate-900 hover:bg-slate-200" disabled={!tier.stripe_price_id && !!user}>
                      {user ? 'Subscribe Now' : 'Sign Up & Subscribe'}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Marketing Email Subscription Section */}
      <section className="py-12 md:py-16 bg-primary text-primary-foreground text-center">
        <div className="container mx-auto px-4 max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold mb-2">Join our community</h2>
          <p className="text-lg mb-8 opacity-90">
            Subscribe to our newsletter for daily quiz updates, clinical tips, and exclusive offers.
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
                        className="h-12 text-lg bg-white text-black"
                        disabled={isSubscribing}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-left" />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" variant="secondary" className="h-12 text-lg w-full sm:w-auto" disabled={isSubscribing}>
                {isSubscribing ? <Loader2 className="animate-spin h-5 w-5" /> : "Subscribe"}
              </Button>
            </form>
          </Form>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;