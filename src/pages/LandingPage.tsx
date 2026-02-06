"use client";

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardTitle, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import * as LucideIcons from 'lucide-react'; 
import { Check, Loader2, Globe, BookOpenText, ArrowRight, Calendar, Trophy, ExternalLink } from 'lucide-react';
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
import { format } from 'date-fns';

const getIconComponent = (iconName: string) => {
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className="h-8 w-8 text-primary" /> : <Globe className="h-8 w-8 text-primary" />;
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

interface RecentBlog {
  title: string;
  slug: string;
  created_at: string;
  meta_description: string;
  image_url: string | null;
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
  const [recentBlogs, setRecentBlogs] = useState<RecentBlog[]>([]);

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
        let tag = document.querySelector(`meta[name="\${name}"]`);
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
    const fetchData = async () => {
      // Fetch Tiers
      const { data: tiersData } = await supabase
        .from('subscription_tiers')
        .select('*, stripe_price_id')
        .order('price', { ascending: true });
      if (tiersData) setSubscriptionTiers(tiersData);

      // Fetch Recent Blogs (for SEO/Authority)
      const { data: blogsData } = await supabase
        .from('blogs')
        .select('title, slug, created_at, meta_description, image_url')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(3);
      if (blogsData) setRecentBlogs(blogsData as RecentBlog[]);
    };

    fetchData();
  }, []);

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

  const hideSubscriptionSection = user?.has_active_subscription;

  return (
    <div className="bg-background text-foreground pt-16">
      {/* Hero Section */}
      <section className="relative w-full py-12 md:py-20 bg-primary text-primary-foreground text-center overflow-hidden" aria-label="Introduction">
        <div className="container mx-auto px-4 relative z-10">
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-4 animate-fade-in-up">
            {settings.hero.mainTitle}
          </h1>
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto opacity-90 animate-fade-in-up delay-200">
            {settings.hero.subtitle}
          </p>
          
          <div className="flex flex-col items-center gap-4 animate-fade-in-up delay-400">
            <div className="flex flex-col justify-center gap-4 w-full max-w-md lg:max-w-none lg:flex-row">
              <Link to={user ? "/user/dashboard" : "/subscription"} className="w-full lg:w-auto">
                <Button size="lg" className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 w-full min-w-[220px] text-lg font-bold shadow-lg">
                  {user ? "Go to Dashboard" : settings.hero.ctaPrimaryText}
                </Button>
              </Link>
              <Link to="/quiz" className="w-full lg:w-auto">
                <Button size="lg" variant="secondary" className="flex items-center gap-2 w-full min-w-[220px] text-lg font-bold shadow-md">
                  <BookOpenText className="h-5 w-5" /> {settings.hero.ctaSecondaryText}
                </Button>
              </Link>
              <Link to="/quiz-of-the-day" className="w-full lg:w-auto">
                <Button size="lg" className="flex items-center gap-2 w-full min-w-[220px] text-lg font-bold bg-white text-black hover:bg-white/90 shadow-md border-2 border-white">
                  <Trophy className="h-5 w-5" /> {settings.hero.ctaQodText}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Badges / Stats Section */}
      <section className="py-8 bg-muted/50 border-y" aria-label="Key Statistics">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap justify-center gap-8 md:gap-16 text-center">
            <div>
              <p className="text-2xl font-bold text-primary">5,000+</p>
              <p className="text-sm text-muted-foreground font-medium">Verified MCQs</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">10,000+</p>
              <p className="text-sm text-muted-foreground font-medium">Active Students</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">6 Countries</p>
              <p className="text-sm text-muted-foreground font-medium">Exam Blueprints</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-primary">95%</p>
              <p className="text-sm text-muted-foreground font-medium">Success Rate</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-background" aria-label="Platform Features">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Master Your Licensing Journey</h2>
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
            Our platform is engineered specifically for the rigors of the DHA, SMLE, and other Prometric exams.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {settings.features.map((feature, index) => (
              <Card key={index} className="flex flex-col items-center p-8 text-center hover:shadow-xl transition-all border-none shadow-sm bg-muted/30">
                <div className="mb-6 p-4 rounded-2xl bg-white shadow-sm">
                  {getIconComponent(feature.icon)}
                </div>
                <CardTitle className="text-2xl mb-3">{feature.title}</CardTitle>
                <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Outbound Links Section */}
      <section className="py-12 bg-white border-y" aria-label="Official Licensing Resources">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xl font-bold mb-6 text-muted-foreground uppercase tracking-widest">Official Licensing Resources</h2>
          <div className="flex flex-wrap justify-center gap-6 md:gap-12">
            {[
              { name: "Dubai Health Authority (DHA)", url: "https://www.dha.gov.ae" },
              { name: "Saudi Commission for Health Specialties (SCFHS)", url: "https://www.scfhs.org.sa" },
              { name: "Department of Health - Abu Dhabi (DOH)", url: "https://www.doh.gov.ae" },
              { name: "Oman Medical Specialty Board (OMSB)", url: "https://www.omsb.gov.om" }
            ].map((body, i) => (
              <a 
                key={i} 
                href={body.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-primary transition-colors group"
              >
                {body.name}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Latest from Blog Section */}
      {recentBlogs.length > 0 && (
        <section className="py-16 md:py-24 bg-muted/20" aria-label="Latest Blog Posts">
          <div className="container mx-auto px-4">
            <div className="flex justify-between items-end mb-12">
              <div className="text-left">
                <h2 className="text-3xl md:text-4xl font-bold mb-2">Expert Exam Guides</h2>
                <p className="text-muted-foreground">In-depth insights into the Gulf licensing process.</p>
              </div>
              <Button asChild variant="ghost" className="hidden md:flex">
                <Link to="/blog">View All Articles <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {recentBlogs.map((blog) => (
                <Card key={blog.slug} className="flex flex-col h-full hover:shadow-md transition-shadow overflow-hidden">
                  {blog.image_url && (
                    <div className="aspect-video w-full overflow-hidden">
                      <img 
                        src={blog.image_url} 
                        alt={blog.title} 
                        className="w-full h-full object-cover transition-transform hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <CardHeader className="flex-grow">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(blog.created_at), 'MMM dd, yyyy')}
                    </div>
                    <CardTitle className="text-xl mb-3 line-clamp-2">
                      <Link to={`/blog/\${blog.slug}`} className="hover:text-primary transition-colors">{blog.title}</Link>
                    </CardTitle>
                    <CardDescription className="line-clamp-3">{blog.meta_description}</CardDescription>
                  </CardHeader>
                  <CardFooter className="pt-0">
                    <Button asChild variant="link" className="p-0 h-auto">
                      <Link to={`/blog/\${blog.slug}`} className="flex items-center">Read More <ArrowRight className="ml-2 h-3 w-3" /></Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Subscription Tiers Section */}
      {!hideSubscriptionSection && (
        <section className="py-16 md:py-24 bg-slate-900 text-white" aria-label="Pricing and Subscription Plans">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">{settings.pricingCta.title}</h2>
            <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto">
              {settings.pricingCta.subtitle}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {subscriptionTiers.map((tier) => (
                <Card key={tier.id} className="flex flex-col text-left shadow-2xl transition-all border-slate-800 bg-slate-950 scale-100 hover:scale-[1.02]">
                  <CardHeader className="pb-6">
                    <CardTitle className="text-2xl text-white">{tier.name}</CardTitle>
                    <CardDescription className="text-slate-400 text-sm line-clamp-2">{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex-grow space-y-6 border-b border-slate-800 pb-8">
                    <div className="flex items-baseline">
                      <span className="text-3xl font-extrabold text-white">{tier.currency} {tier.price.toFixed(2)}</span>
                      <span className="text-sm text-slate-400 ml-2"> / {tier.duration_in_months} mo</span>
                    </div>
                    {tier.features && tier.features.length > 0 && (
                      <ul className="space-y-3">
                        {tier.features.slice(0, 5).map((feature, index) => (
                          <li key={index} className="flex items-start gap-2 text-slate-300 text-xs">
                            <Check className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                  <CardFooter className="pt-6">
                    <Link to={user ? `/user/payment/\${tier.id}?priceId=\${tier.stripe_price_id}` : `/signup?tierId=\${tier.id}`} className="w-full">
                      <Button className="w-full h-10 text-sm bg-white text-slate-900 hover:bg-slate-200 font-bold" disabled={!tier.stripe_price_id && !!user}>
                        {user ? 'Subscribe' : 'Sign Up'}
                      </Button>
                    </Link>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Marketing Email Subscription Section */}
      <section className="py-16 md:py-24 bg-primary text-primary-foreground text-center" aria-label="Newsletter Signup">
        <div className="container mx-auto px-4 max-w-3xl">
          <h2 className="text-3xl md:text-5xl font-bold mb-4">Join our community</h2>
          <p className="text-xl mb-10 opacity-90">
            Subscribe to our newsletter for daily high-yield questions, clinical tips, and exclusive offers.
          </p>
          <Form {...marketingForm}>
            <form onSubmit={marketingForm.handleSubmit(handleMarketingSubscribe)} className="flex flex-col sm:flex-row gap-4 max-w-lg mx-auto">
              <FormField
                control={marketingForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="flex-grow">
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="Enter your professional email"
                        className="h-14 text-lg bg-white text-black border-none"
                        disabled={isSubscribing}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-left text-white font-bold" />
                  </FormItem>
                )}
              />
              <Button type="submit" size="lg" variant="secondary" className="h-14 text-lg px-8 w-full sm:w-auto font-bold" disabled={isSubscribing}>
                {isSubscribing ? <Loader2 className="animate-spin h-6 w-6" /> : "Subscribe"}
              </Button>
            </form>
          </Form>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;