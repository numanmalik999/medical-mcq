"use client";

import { useEffect, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { 
  Check, 
  Star, 
  ArrowRight, 
  BookOpen, 
  Users, 
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

const LandingPage = () => {
  const [tiers, setTiers] = useState<any[]>([]);
  const { settings, isLoading: settingsLoading } = useLandingPageSettings();

  useEffect(() => {
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
        // Filter out trial and free tiers to keep the focus on premium offers
        setTiers(data.filter(t => 
          !t.name.toLowerCase().includes('trial') && 
          !t.name.toLowerCase().includes('free') &&
          t.price > 0
        ));
      }
    };
    fetchTiers();
  }, []);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Stethoscope': return <Stethoscope className="w-12 h-12 text-primary" />;
      case 'ClipboardCheck': return <ClipboardCheck className="w-12 h-12 text-primary" />;
      case 'Zap': return <Zap className="w-12 h-12 text-primary" />;
      case 'Youtube': return <Youtube className="w-12 h-12 text-primary" />;
      case 'CalendarCheck': return <CalendarCheck className="w-12 h-12 text-primary" />;
      case 'ShieldCheck': return <ShieldCheck className="w-12 h-12 text-primary" />;
      default: return <BookOpen className="w-12 h-12 text-primary" />;
    }
  };

  if (settingsLoading) return <LoadingBar />;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-background">
        <div className="container px-4 mx-auto relative z-10">
          <div className="flex flex-wrap items-center -mx-4">
            <div className="w-full lg:w-1/2 px-4 mb-12 lg:mb-0">
              <div className="max-w-xl">
                <div className="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-primary/10 text-primary mb-6 animate-fade-in">
                  <Star className="w-4 h-4 mr-2 fill-primary" />
                  <span>Trusted by 10,000+ Medical Professionals</span>
                </div>
                <h1 className="text-5xl lg:text-7xl font-black tracking-tight text-gray-900 dark:text-white mb-8 leading-[1.1]">
                  {settings.hero.mainTitle}
                </h1>
                <p className="text-xl text-gray-600 dark:text-gray-400 mb-10 leading-relaxed">
                  {settings.hero.subtitle}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link to="/signup">
                    <Button size="lg" className="h-14 px-8 text-lg font-bold rounded-2xl w-full sm:w-auto shadow-xl shadow-primary/25">
                      {settings.hero.ctaPrimaryText}
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Link to="/quiz">
                    <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-bold rounded-2xl w-full sm:w-auto border-2">
                      {settings.hero.ctaSecondaryText}
                    </Button>
                  </Link>
                </div>
                
                <div className="mt-10 pt-10 border-t border-gray-200 dark:border-gray-800">
                   <Link to="/quiz-of-the-day" className="inline-flex items-center gap-2 text-primary font-black uppercase tracking-widest text-sm hover:underline">
                      <Zap className="w-5 h-5 fill-primary" /> {settings.hero.ctaQodText}
                   </Link>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-1/2 px-4">
              <div className="relative mx-auto max-w-lg lg:max-w-none">
                <div className="absolute -top-10 -left-10 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl animate-pulse"></div>
                <div className="relative rounded-3xl overflow-hidden border shadow-2xl bg-white dark:bg-gray-800 p-2 transform hover:scale-[1.02] transition-transform duration-500">
                   <img 
                    src="https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&q=80&w=2070" 
                    alt="Medical Students Studying" 
                    className="rounded-2xl w-full object-cover aspect-[4/3]"
                   />
                   <div className="absolute bottom-6 left-6 right-6 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-6 rounded-2xl border shadow-lg">
                      <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                          {[1,2,3,4].map(i => (
                            <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden">
                              <img src={`https://i.pravatar.cc/150?u=${i}`} alt="user" />
                            </div>
                          ))}
                        </div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                          Join 500+ students studying right now
                        </p>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 border-y bg-white dark:bg-gray-950">
        <div className="container px-4 mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <h3 className="text-4xl font-black text-primary mb-1">50,000+</h3>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Questions Solved</p>
            </div>
            <div className="text-center">
              <h3 className="text-4xl font-black text-primary mb-1">10,000+</h3>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Active Users</p>
            </div>
            <div className="text-center">
              <h3 className="text-4xl font-black text-primary mb-1">98%</h3>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Pass Rate</p>
            </div>
            <div className="text-center">
              <h3 className="text-4xl font-black text-primary mb-1">15+</h3>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Specialties</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-gray-50 dark:bg-gray-900">
        <div className="container px-4 mx-auto text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-black mb-6">Built for Medical Success</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Our platform is engineered using cognitive science to help you retain information longer and pass your exams on the first attempt.
          </p>
        </div>
        <div className="container px-4 mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {settings.features.map((feature, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 p-10 rounded-[2.5rem] border shadow-sm hover:shadow-xl transition-all duration-300 group">
                <div className="mb-8 p-4 bg-primary/5 rounded-3xl w-fit group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                  {getIcon(feature.icon)}
                </div>
                <h3 className="text-2xl font-black mb-4">{feature.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 bg-white dark:bg-background">
        <div className="container px-4 mx-auto text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-black mb-6">{settings.pricingCta.title}</h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-10">
            {settings.pricingCta.subtitle}
          </p>
        </div>
        
        <div className="container px-4 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto items-stretch">
            {tiers.map((tier) => {
                const isPopular = tier.name.includes('6');
                const monthlyPrice = (tier.price / tier.duration_in_months).toFixed(2);

                return (
                    <div key={tier.id} className={cn(
                        "relative flex flex-col p-8 bg-white dark:bg-gray-800 rounded-[2.5rem] border-2 transition-all",
                        isPopular ? "border-primary shadow-2xl scale-105 z-10" : "border-slate-100 shadow-sm hover:shadow-lg"
                    )}>
                        {isPopular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-full">
                            Most Popular
                        </div>
                        )}
                        <div className="mb-8">
                        <h3 className="text-2xl font-black mb-2">{tier.name}</h3>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-black">${monthlyPrice}</span>
                            <span className="text-muted-foreground font-bold">/month</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-tighter">Billed as single payment of ${tier.price.toFixed(2)}</p>
                        </div>
                        <ul className="space-y-4 mb-10 flex-1">
                        {tier.features?.map((feature: string, idx: number) => (
                            <li key={idx} className="flex items-start gap-3">
                            <div className="mt-1 bg-green-100 dark:bg-green-900/30 p-0.5 rounded-full shrink-0">
                                <Check className="w-3 h-3 text-green-600" />
                            </div>
                            <span className="text-sm font-medium leading-tight">{feature}</span>
                            </li>
                        ))}
                        <li className="flex items-start gap-3">
                            <div className="mt-1 bg-blue-100 p-0.5 rounded-full shrink-0">
                                <Check className="w-3 h-3 text-blue-600" />
                            </div>
                            <span className="text-sm font-bold text-primary">Full Flashcard Access</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="mt-1 bg-blue-100 p-0.5 rounded-full shrink-0">
                                <Check className="w-3 h-3 text-blue-600" />
                            </div>
                            <span className="text-sm font-bold text-primary">Daily AI Study Plan</span>
                        </li>
                        </ul>
                        <Link to="/signup" className="mt-auto">
                        <Button className={cn(
                            "w-full h-14 rounded-2xl text-base font-black uppercase tracking-widest",
                            isPopular ? "shadow-xl shadow-primary/25" : ""
                        )} variant={isPopular ? 'default' : 'outline'}>
                            Subscribe Now
                        </Button>
                        </Link>
                    </div>
                );
            })}
          </div>
          
          <div className="mt-16 max-w-3xl mx-auto text-center p-8 bg-blue-50 dark:bg-gray-900 rounded-[2rem] border-2 border-dashed border-blue-200 dark:border-blue-900">
             <div className="inline-flex items-center justify-center p-3 bg-white dark:bg-gray-800 rounded-2xl shadow-sm mb-4">
                <ShieldCheck className="w-6 h-6 text-primary" />
             </div>
             <h4 className="text-xl font-black mb-2">Academic Pass Guarantee</h4>
             <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
               All premium plans include a pass guarantee. If you don't pass your licensing exam after completing 90% of our question bank, we provide an additional 3 months of access for free.
             </p>
          </div>
        </div>
      </section>

      {/* Outbound Links Section */}
      <section className="py-12 bg-slate-50 border-y overflow-hidden" aria-label="Official Licensing Resources">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-xs font-black mb-8 text-slate-400 uppercase tracking-[0.3em]">Official Licensing Bodies</h2>
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
                className="flex items-center gap-2 text-xs font-black text-slate-400 hover:text-primary transition-all group grayscale hover:grayscale-0"
              >
                {body.name}
                <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100" />
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
           <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
           <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
        </div>
        <div className="container px-4 mx-auto text-center relative z-10">
          <h2 className="text-4xl lg:text-6xl font-black mb-8 italic tracking-tighter uppercase">Ready to Start Your Career?</h2>
          <p className="text-xl mb-12 max-w-2xl mx-auto font-medium opacity-80">
            Join thousands of doctors and nurses who have successfully aced their Prometric exams using Study Prometric.
          </p>
          <Link to="/signup">
            <Button size="lg" variant="secondary" className="h-20 px-12 text-2xl font-black rounded-[2rem] bg-white text-primary hover:bg-gray-100 shadow-2xl border-4 border-white/20 active:scale-95 transition-all">
              Join the Platform Today
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-24 bg-white dark:bg-gray-950 border-t">
        <div className="container px-4 mx-auto">
          <div className="flex flex-wrap -mx-4">
            <div className="w-full lg:w-1/3 px-4 mb-16 lg:mb-0">
              <Link to="/" className="text-3xl font-black tracking-tighter mb-8 block italic uppercase">
                Study<span className="text-primary">Prometric</span>
              </Link>
              <p className="text-gray-500 dark:text-gray-400 max-w-xs mb-10 font-medium leading-relaxed">
                The leading medical education technology platform for Gulf licensing preparation.
              </p>
              <div className="flex gap-6">
                <div className="h-6 w-6 text-slate-400 hover:text-primary transition-colors cursor-pointer"><Users className="h-full w-full" /></div>
                <div className="h-6 w-6 text-slate-400 hover:text-primary transition-colors cursor-pointer"><MonitorPlay className="h-full w-full" /></div>
                <div className="h-6 w-6 text-slate-400 hover:text-primary transition-colors cursor-pointer"><Stethoscope className="h-full w-full" /></div>
              </div>
            </div>
            <div className="w-full sm:w-1/2 lg:w-1/6 px-4 mb-12 sm:mb-0">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-8 text-slate-400">Exam Center</h4>
              <ul className="space-y-4">
                <li><Link to="/quiz" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">DHA Dubai</Link></li>
                <li><Link to="/quiz" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">SMLE Saudi</Link></li>
                <li><Link to="/quiz" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">MOH Licensing</Link></li>
                <li><Link to="/quiz" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">DOH Abu Dhabi</Link></li>
              </ul>
            </div>
            <div className="w-full sm:w-1/2 lg:w-1/6 px-4 mb-12 sm:mb-0">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-8 text-slate-400">Study Tools</h4>
              <ul className="space-y-4">
                <li><Link to="/blog" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">Masterclass Blog</Link></li>
                <li><Link to="/quiz-of-the-day" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">Question of the Day</Link></li>
                <li><Link to="/user/videos" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">Clinical Videos</Link></li>
                <li><Link to="/user/flashcards" className="text-sm font-bold text-gray-600 hover:text-primary transition-colors">Active Recall</Link></li>
              </ul>
            </div>
            <div className="w-full lg:w-1/3 px-4">
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-8 text-slate-400">Join the Mailing List</h4>
              <p className="text-sm text-gray-500 mb-8 font-medium leading-relaxed">Daily clinical pearls and exam updates sent to your professional inbox.</p>
              <div className="flex gap-2">
                <input type="email" placeholder="Email address" className="bg-slate-100 dark:bg-gray-800 border-none rounded-2xl px-6 py-4 flex-1 text-sm outline-none focus:ring-2 ring-primary/20 font-bold" />
                <Button className="rounded-2xl font-black px-8">JOIN</Button>
              </div>
            </div>
          </div>
          <div className="mt-24 pt-12 border-t flex flex-col md:flex-row justify-between items-center gap-6 text-xs font-black uppercase tracking-widest text-slate-400">
            <p>© {new Date().getFullYear()} Study Prometric MCQs. All rights reserved.</p>
            <div className="flex gap-8">
               <Link to="/privacy" className="hover:text-primary transition-colors">Privacy</Link>
               <Link to="/terms" className="hover:text-primary transition-colors">Terms</Link>
               <Link to="/contact" className="hover:text-primary transition-colors">Contact</Link>
            </div>
          </div>
        </div>
      </footer>
      <MadeWithDyad />
    </div>
  );
};

export default LandingPage;