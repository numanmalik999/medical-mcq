"use client";

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Check, 
  Star, 
  ArrowRight, 
  BookOpen, 
  Stethoscope,
  ClipboardCheck,
  Zap,
  Youtube,
  CalendarCheck,
  ShieldCheck,
  ExternalLink,
  MonitorPlay
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

  const getIcon = (iconName: string) => {
    const iconClass = "w-10 h-10 text-primary";
    switch (iconName) {
      case 'Stethoscope': return <Stethoscope className={iconClass} />;
      case 'ClipboardCheck': return <ClipboardCheck className={iconClass} />;
      case 'Zap': return <Zap className={iconClass} />;
      case 'Youtube': return <Youtube className={iconClass} />;
      case 'CalendarCheck': return <CalendarCheck className={iconClass} />;
      case 'ShieldCheck': return <ShieldCheck className={iconClass} />;
      default: return <BookOpen className={iconClass} />;
    }
  };

  if (settingsLoading) return <LoadingBar />;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden bg-gradient-to-b from-slate-50 to-white dark:from-slate-900 dark:to-background">
        <div className="container px-4 mx-auto relative z-10">
          <div className="flex flex-wrap items-center -mx-4">
            <div className="w-full lg:w-1/2 px-4 mb-16 lg:mb-0">
              <div className="max-w-xl">
                <div className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-bold bg-primary/10 text-primary mb-8 border border-primary/20 tracking-wider uppercase">
                  <Star className="w-4 h-4 mr-2 fill-primary" />
                  <span>Trusted by 10,000+ Professionals</span>
                </div>
                <h1 className="text-5xl lg:text-7xl font-black tracking-tighter text-slate-900 dark:text-white mb-8 leading-[1.05] italic uppercase">
                  {settings.hero.mainTitle}
                </h1>
                <p className="text-xl text-slate-600 dark:text-slate-400 mb-10 leading-relaxed font-medium">
                  {settings.hero.subtitle}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link to="/signup" className="w-full sm:w-auto">
                    <Button size="lg" className="h-14 px-10 text-lg font-black uppercase tracking-widest rounded-2xl w-full shadow-2xl shadow-primary/20">
                      {settings.hero.ctaPrimaryText}
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Link to="/quiz" className="w-full sm:w-auto">
                    <Button size="lg" variant="outline" className="h-14 px-10 text-lg font-black uppercase tracking-widest rounded-2xl w-full border-2 border-primary/10 hover:bg-primary/5">
                      {settings.hero.ctaSecondaryText}
                    </Button>
                  </Link>
                </div>
                
                <div className="mt-12 pt-10 border-t border-slate-200 dark:border-slate-800">
                   <Link to="/quiz-of-the-day" className="inline-flex items-center gap-3 text-primary font-black uppercase tracking-[0.2em] text-xs hover:gap-4 transition-all">
                      <Zap className="w-5 h-5 fill-primary" /> {settings.hero.ctaQodText} <ArrowRight className="h-4 w-4" />
                   </Link>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-1/2 px-4">
              <div className="relative mx-auto max-w-lg lg:max-w-none">
                <div className="absolute -top-10 -left-10 w-72 h-72 bg-primary/10 rounded-full blur-[120px]"></div>
                <div className="absolute -bottom-10 -right-10 w-72 h-72 bg-blue-500/10 rounded-full blur-[120px]"></div>
                <div className="relative rounded-[2.5rem] overflow-hidden border shadow-2xl bg-white dark:bg-slate-800 p-3 transform hover:rotate-1 transition-transform duration-700">
                   <img 
                    src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=2070" 
                    alt="Clinical Excellence" 
                    className="rounded-[2rem] w-full object-cover aspect-[4/3]"
                   />
                   <div className="absolute bottom-10 left-10 right-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md p-6 rounded-3xl border shadow-2xl flex items-center gap-4">
                      <div className="bg-primary/10 p-3 rounded-2xl">
                        <MonitorPlay className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-black uppercase tracking-tight text-slate-900 dark:text-white">Active Learners</p>
                        <p className="text-xs font-bold text-slate-500">500+ doctors studying now</p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Verification Bar */}
      <section className="py-12 border-y bg-slate-50 dark:bg-slate-900/50">
        <div className="container px-4 mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {[
              { val: "50,000+", label: "MCQs Solved" },
              { val: "10,000+", label: "Verified Users" },
              { val: "98%", label: "First-Time Pass" },
              { val: "15+", label: "Specialties" }
            ].map((stat, i) => (
              <div key={i} className="text-center border-l-2 first:border-none border-slate-200 dark:border-slate-800">
                <h3 className="text-3xl lg:text-4xl font-black text-slate-900 dark:text-white mb-1 tracking-tighter">{stat.val}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 lg:py-32 bg-white dark:bg-background">
        <div className="container px-4 mx-auto text-center mb-20">
          <Badge className="mb-4 rounded-full px-4 py-1.5 bg-primary/5 text-primary border-none font-bold uppercase tracking-widest text-[10px]">The Clinical Advantage</Badge>
          <h2 className="text-4xl lg:text-6xl font-black mb-6 tracking-tighter text-slate-900 dark:text-white uppercase italic">Built for Medical Success</h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium">
            Our platform is engineered using cognitive science and clinical AI to help you master the DHA, SMLE, and MOH blueprints.
          </p>
        </div>
        <div className="container px-4 mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-10">
            {settings.features.map((feature, index) => (
              <div key={index} className="bg-slate-50 dark:bg-slate-900/50 p-10 rounded-[3rem] border border-transparent hover:border-primary/10 hover:bg-white hover:shadow-2xl transition-all duration-500 group">
                <div className="mb-8 p-5 bg-white dark:bg-slate-800 rounded-3xl w-fit shadow-sm group-hover:bg-primary group-hover:text-white transition-colors duration-500">
                  {getIcon(feature.icon)}
                </div>
                <h3 className="text-2xl font-black mb-4 text-slate-900 dark:text-white uppercase tracking-tight">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 lg:py-32 bg-slate-50 dark:bg-slate-900/20 relative">
        <div className="container px-4 mx-auto text-center mb-20">
          <h2 className="text-4xl lg:text-6xl font-black mb-6 tracking-tighter text-slate-900 dark:text-white uppercase italic">{settings.pricingCta.title}</h2>
          <p className="text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-medium">
            {settings.pricingCta.subtitle}
          </p>
        </div>
        
        <div className="container px-4 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            {tiers.map((tier) => {
                const isPopular = tier.name.toLowerCase().includes('6');
                const monthlyPrice = (tier.price / tier.duration_in_months).toFixed(2);

                return (
                    <div key={tier.id} className={cn(
                        "relative flex flex-col p-10 bg-white dark:bg-slate-800 rounded-[3rem] border-2 transition-all duration-500",
                        isPopular ? "border-primary shadow-2xl lg:scale-110 z-10" : "border-slate-100 shadow-sm hover:shadow-xl"
                    )}>
                        {isPopular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-xl">
                            Recommended
                        </div>
                        )}
                        <div className="mb-10">
                          <h3 className="text-2xl font-black mb-3 text-slate-900 dark:text-white uppercase tracking-tight">{tier.name}</h3>
                          <div className="flex items-baseline gap-1">
                              <span className="text-5xl font-black text-slate-900 dark:text-white">${monthlyPrice}</span>
                              <span className="text-slate-400 font-black uppercase text-xs">/mo</span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-3 font-black uppercase tracking-widest">Single payment of ${tier.price.toFixed(2)}</p>
                        </div>
                        <ul className="space-y-5 mb-12 flex-1">
                        {tier.features?.map((feature: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-3">
                            <div className="mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full shrink-0">
                                <Check className="w-3 h-3 text-green-600" />
                            </div>
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-300 leading-tight">{feature}</span>
                            </li>
                        ))}
                        <li className="flex items-start gap-3">
                            <div className="mt-1 bg-primary/10 p-1 rounded-full shrink-0">
                                <Check className="w-3 h-3 text-primary" />
                            </div>
                            <span className="text-sm font-black text-primary uppercase tracking-tight">Full Flashcard Access</span>
                        </li>
                        </ul>
                        <Link to="/signup" className="mt-auto">
                        <Button className={cn(
                            "w-full h-16 rounded-[1.5rem] text-sm font-black uppercase tracking-[0.2em] transition-all",
                            isPopular ? "shadow-2xl shadow-primary/30" : ""
                        )} variant={isPopular ? 'default' : 'outline'}>
                            Enroll Now
                        </Button>
                        </Link>
                    </div>
                );
            })}
          </div>
          
          <div className="mt-20 max-w-3xl mx-auto text-center p-10 bg-primary text-primary-foreground rounded-[3rem] shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <ShieldCheck className="w-32 h-32" />
             </div>
             <div className="relative z-10">
                <h4 className="text-2xl font-black mb-3 uppercase italic tracking-tighter">Academic Pass Guarantee</h4>
                <p className="text-primary-foreground/80 font-medium leading-relaxed">
                  We are so confident in our high-yield curriculum that if you don't pass your licensing exam after completing 90% of our question bank, we will provide an additional 3 months of premium access for free.
                </p>
             </div>
          </div>
        </div>
      </section>

      {/* Authority Links Bar */}
      <section className="py-16 bg-white border-y">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-[10px] font-black mb-12 text-slate-400 uppercase tracking-[0.4em]">Official Licensing Resources</h2>
          <div className="flex flex-wrap justify-center gap-10 md:gap-20">
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
                className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-primary transition-all group grayscale hover:grayscale-0"
              >
                {body.name}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-24 lg:py-40 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-20">
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary rounded-full blur-[150px] -translate-y-1/2 translate-x-1/2"></div>
           <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600 rounded-full blur-[150px] translate-y-1/2 -translate-x-1/2"></div>
        </div>
        <div className="container px-4 mx-auto text-center relative z-10">
          <h2 className="text-4xl lg:text-7xl font-black mb-8 italic tracking-tighter uppercase leading-[0.9]">Start Your Medical <br/>Career in the Gulf</h2>
          <p className="text-xl mb-12 max-w-2xl mx-auto font-medium text-slate-400">
            Join thousands of successful candidates who used Study Prometric to pass their DHA, SMLE, and MOH exams.
          </p>
          <Link to="/signup">
            <Button size="lg" variant="secondary" className="h-20 px-16 text-xl font-black rounded-[2rem] bg-white text-slate-900 hover:bg-slate-100 shadow-2xl transition-all hover:scale-105 active:scale-95">
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