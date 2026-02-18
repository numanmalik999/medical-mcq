"use client";

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Check, 
  Star, 
  ArrowRight, 
  ExternalLink,
  MonitorPlay,
  Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MadeWithDyad } from "@/components/made-with-dyad";
import LoadingBar from "@/components/LoadingBar";
import { useLandingPageSettings } from '@/hooks/useLandingPageSettings';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const LandingPage = () => {
  const [tiers, setTiers] = useState<any[]>([]);
  const { settings, isLoading: settingsLoading } = useLandingPageSettings();

  useEffect(() => {
    // Set page title and meta description dynamically
    document.title = settings.seo.metaTitle;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', settings.seo.metaDescription);

    const fetchTiers = async () => {
      const { data, error } = await supabase
        .from('subscription_tiers')
        .select('*')
        .order('price', { ascending: true });
      
      if (error) {
        console.error("Error fetching tiers:", error);
        return;
      }
      
      if (data) {
        setTiers(data.filter(t => 
          !t.name.toLowerCase().includes('trial') && 
          !t.name.toLowerCase().includes('free') &&
          t.price > 0
        ));
      }
    };
    fetchTiers();
  }, [settings.seo]);

  if (settingsLoading) return <LoadingBar />;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-16 lg:py-24 overflow-hidden bg-slate-900 text-white">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary rounded-full blur-[120px] -translate-y-1/2 translate-x-1/2"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/2"></div>
        </div>
        
        <div className="container px-4 mx-auto relative z-10">
          <div className="flex flex-wrap items-center -mx-4">
            <div className="w-full lg:w-1/2 px-4 mb-12 lg:mb-0">
              <div className="max-w-xl">
                <div className="inline-flex items-center rounded-full px-4 py-1 text-xs font-bold bg-white/10 text-white mb-6 border border-white/20 tracking-wider uppercase">
                  <Star className="w-4 h-4 mr-2 fill-yellow-400 text-yellow-400" />
                  <span>Trusted by Professionals</span>
                </div>
                <h1 className="text-4xl lg:text-6xl font-black tracking-tighter text-white mb-6 leading-[1.1] uppercase italic">
                  {settings.hero.mainTitle}
                </h1>
                <p className="text-lg lg:text-xl text-white mb-8 leading-relaxed font-medium">
                  Your ultimate platform for interactive quizzes, simulated tests, and AI-powered explanations to ace your Saudi Arabia, UAE, Qatar, Oman, Kuwait & Bahrain Prometric Exam for medical professionals.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link to="/signup" className="w-full sm:w-auto">
                    <Button size="lg" className="h-12 px-8 text-base font-black uppercase tracking-widest rounded-xl w-full bg-white text-slate-900 hover:bg-slate-100 shadow-xl transition-all">
                      {settings.hero.ctaPrimaryText}
                      <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                  </Link>
                  <Link to="/quiz" className="w-full sm:w-auto">
                    <Button size="lg" className="h-12 px-8 text-base font-black uppercase tracking-widest rounded-xl w-full bg-white text-black border-2 border-white hover:bg-transparent hover:text-white transition-all shadow-xl">
                      {settings.hero.ctaSecondaryText}
                    </Button>
                  </Link>
                </div>
                
                <div className="mt-10 pt-8 border-t border-white/10">
                   <Link to="/quiz-of-the-day" className="inline-flex items-center gap-3 text-blue-400 font-black uppercase tracking-[0.2em] text-[10px] hover:text-white transition-all">
                      <Zap className="w-4 h-4 fill-current" /> {settings.hero.ctaQodText} <ArrowRight className="h-3 w-3" />
                   </Link>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-1/2 px-4">
              <div className="relative mx-auto max-w-lg lg:max-w-none">
                <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-slate-800 p-2">
                   <img 
                    src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=2070" 
                    alt="Clinical Excellence" 
                    className="rounded-2xl w-full object-cover aspect-[4/3] opacity-90"
                   />
                   <div className="absolute bottom-6 left-6 right-6 bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-white/10 shadow-2xl flex items-center gap-4">
                      <div className="bg-primary p-2 rounded-xl">
                        <MonitorPlay className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-tight text-white">Active Learners</p>
                        <p className="text-[10px] font-bold text-slate-400">Doctors & Nurses studying now</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <section className="py-10 border-y bg-slate-50 dark:bg-slate-900/50">
        <div className="container px-4 mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { val: "50,000+", label: "MCQs Solved" },
              { val: "Verified", label: "Medical Users" },
              { val: "98%", label: "First-Time Pass" },
              { val: "15+", label: "Specialties" }
            ].map((stat, i) => (
              <div key={i} className="text-center border-l first:border-none border-slate-200">
                <h3 className="text-2xl lg:text-3xl font-black text-slate-900 dark:text-white mb-0.5 tracking-tighter">{stat.val}</h3>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 lg:py-20 bg-white dark:bg-background">
        <div className="container px-4 mx-auto text-center mb-12">
          <Badge className="mb-3 rounded-full px-4 py-1 bg-primary/5 text-primary border-none font-bold uppercase tracking-widest text-[10px]">The Clinical Advantage</Badge>
          <h2 className="text-3xl lg:text-5xl font-black mb-4 tracking-tighter text-black uppercase italic">Built for Medical Success</h2>
          <p className="text-base lg:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
            Our platform is engineered using clinical AI to help you master the DHA, SMLE, and MOH blueprints.
          </p>
        </div>
        <div className="container px-4 mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {settings.features.map((feature, index) => (
              <div key={index} className="bg-slate-50 dark:bg-slate-900/50 p-8 rounded-3xl border border-transparent hover:border-primary/10 hover:bg-white hover:shadow-xl transition-all duration-300 group">
                {/* Heading explicitly forced to black on hover, even in dark mode */}
                <h3 className="text-xl font-black mb-3 text-slate-700 dark:text-slate-300 group-hover:text-black dark:group-hover:text-white uppercase tracking-tight transition-colors">
                  {feature.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 lg:py-20 bg-slate-50 dark:bg-slate-900/20">
        <div className="container px-4 mx-auto text-center mb-12">
          <h2 className="text-3xl lg:text-5xl font-black mb-4 tracking-tighter text-slate-900 dark:text-white uppercase italic">{settings.pricingCta.title}</h2>
          <p className="text-base lg:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium">
            {settings.pricingCta.subtitle}
          </p>
        </div>
        
        <div className="container px-4 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto items-stretch">
            {tiers.map((tier) => {
                const isPopular = tier.name.toLowerCase().includes('6');
                const monthlyPrice = (tier.price / tier.duration_in_months).toFixed(2);

                return (
                    <div key={tier.id} className={cn(
                        "relative flex flex-col p-8 bg-white dark:bg-slate-800 rounded-3xl border-2 transition-all duration-500",
                        isPopular ? "border-primary shadow-2xl lg:scale-105 z-10" : "border-slate-100 shadow-sm hover:shadow-lg"
                    )}>
                        {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg">
                            Recommended
                        </div>
                        )}
                        <div className="mb-8">
                          <h3 className="text-lg font-black mb-2 text-slate-900 dark:text-white uppercase tracking-tight">{tier.name}</h3>
                          <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-black text-slate-900 dark:text-white">${monthlyPrice}</span>
                              <span className="text-slate-400 font-black uppercase text-[10px]">/mo</span>
                          </div>
                          <p className="text-[9px] text-slate-400 mt-2 font-black uppercase tracking-widest">Total: ${tier.price.toFixed(2)}</p>
                        </div>
                        <ul className="space-y-4 mb-8 flex-1">
                        {tier.features?.map((feature: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-2">
                            <div className="mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full shrink-0">
                                <Check className="w-2.5 h-2.5 text-green-600" />
                            </div>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 leading-tight">{feature}</span>
                            </li>
                        ))}
                        </ul>
                        <Link to="/signup" className="mt-auto">
                        <Button className={cn(
                            "w-full h-12 rounded-xl text-xs font-black uppercase tracking-[0.2em] transition-all",
                            isPopular ? "shadow-lg" : ""
                        )} variant={isPopular ? 'default' : 'outline'}>
                            Enroll Now
                        </Button>
                        </Link>
                    </div>
                );
            })}
          </div>
          
          <div className="mt-16 max-w-2xl mx-auto text-center p-8 bg-primary text-primary-foreground rounded-3xl shadow-xl relative overflow-hidden">
             <div className="relative z-10">
                <h4 className="text-xl font-black mb-2 uppercase italic tracking-tighter">Academic Pass Guarantee</h4>
                <p className="text-xs text-primary-foreground/80 font-medium leading-relaxed">
                  If you don't pass your licensing exam after completing 90% of our question bank, we will provide an additional 3 months of premium access for free.
                </p>
             </div>
          </div>
        </div>
      </section>

      {/* Authority Links Bar */}
      <section className="py-12 bg-white border-y">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-[9px] font-black mb-8 text-slate-400 uppercase tracking-[0.4em]">Licensing Resources</h2>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            {[
              { name: "DHA Dubai", url: "https://www.dha.gov.ae" },
              { name: "SCFHS Saudi", url: "https://www.scfhs.org.sa" },
              { name: "DOH Abu Dhabi", url: "https://www.doh.gov.ae" },
              { name: "OMSB Oman", url: "https://www.omsb.gov.om" },
              { name: "NHRA Bahrain", url: "https://www.nhra.bh" }
            ].map((body, i) => (
              <a 
                key={i} 
                href={body.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex items-center gap-2 text-[9px] font-black text-slate-400 hover:text-primary transition-all group grayscale hover:grayscale-0"
              >
                {body.name}
                <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 lg:py-24 bg-slate-900 text-white relative overflow-hidden">
        <div className="container px-4 mx-auto text-center relative z-10">
          <h2 className="text-3xl lg:text-5xl font-black mb-6 italic tracking-tighter uppercase leading-[1]">Start Your Medical Career</h2>
          <p className="text-base mb-10 max-w-xl mx-auto font-medium text-slate-400">
            Join thousands of successful candidates who used Study Prometric to pass their exams.
          </p>
          <Link to="/signup">
            <Button size="lg" variant="secondary" className="h-14 px-10 text-lg font-black rounded-xl bg-white text-slate-900 hover:bg-slate-100 shadow-2xl transition-all">
              Get Started for Free
            </Button>
          </Link>
        </div>
      </section>

      <MadeWithDyad />
    </div>
  );
};

export default LandingPage;