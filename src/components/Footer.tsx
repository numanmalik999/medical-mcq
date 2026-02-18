"use client";

import { Link, useLocation } from 'react-router-dom';
import { MessageSquare, MapPin, Twitter, Facebook, Instagram, Linkedin, Globe, Youtube, ShieldCheck, Rss, Music2, Stethoscope, ArrowRight } from 'lucide-react';
import { useGlobalSettings, SocialLink } from '@/hooks/useGlobalSettings';
import { useNavigationData } from '@/hooks/useNavigationData';

const getRouteFromSlug = (slug: string): string => {
  const map: Record<string, string> = {
    'privacy': '/privacy',
    'terms': '/terms',
    'refund': '/refund',
    'about': '/about',
    'contact': '/contact',
    'faq': '/faq',
    'road-to-gulf': '/road-to-gulf',
    'editorial-guidelines': '/editorial-guidelines',
    'team': '/team'
  };
  return map[slug] || `/${slug}`;
};

const getSocialIcon = (platform: string) => {
  const lowerPlatform = platform.toLowerCase();
  if (lowerPlatform.includes('twitter') || lowerPlatform.includes('x')) return <Twitter className="h-5 w-5" />;
  if (lowerPlatform.includes('facebook')) return <Facebook className="h-5 w-5" />;
  if (lowerPlatform.includes('instagram')) return <Instagram className="h-5 w-5" />;
  if (lowerPlatform.includes('linkedin')) return <Linkedin className="h-5 w-5" />;
  if (lowerPlatform.includes('youtube')) return <Youtube className="h-5 w-5" />;
  if (lowerPlatform.includes('tiktok')) return <Music2 className="h-5 w-5" />;
  return <Globe className="h-5 w-5" />;
};

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const location = useLocation();
  const { footerLinks } = useNavigationData();
  const { settings } = useGlobalSettings();

  // Hide footer on focused study pages
  const isStudyMode = location.pathname.startsWith('/quiz') || location.pathname.includes('/take-test');
  if (isStudyMode) return null;

  const legalLinks = footerLinks.filter(link => 
    link.title.toLowerCase().includes('policy') || 
    link.title.toLowerCase().includes('terms')
  );

  const whatsappNumber = "+92 317 4636479";
  const contactEmail = "support@studyprometric.com";

  return (
    <footer className="bg-slate-950 text-slate-400 py-16 border-t border-white/5 relative overflow-hidden">
      {/* Background decoration matching hero */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary rounded-full blur-[100px] translate-y-1/2 translate-x-1/4"></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 mb-16">
          
          <div className="lg:col-span-4 space-y-6">
            <div className="flex items-center gap-3 group cursor-default">
              <div className="bg-primary p-2 rounded-xl shadow-lg ring-1 ring-white/10 group-hover:scale-110 transition-transform">
                <Stethoscope className="h-6 w-6 text-white" strokeWidth={3} />
              </div>
              <div className="flex flex-col leading-none">
                <span className="text-xl font-black tracking-tight text-white uppercase italic">Study Prometric</span>
                <span className="text-[9px] font-black tracking-[0.3em] text-primary-foreground/40 uppercase mt-1">Medical Education</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed max-w-sm">
              The premier platform for healthcare professionals preparing for Gulf licensing exams. We use clinical AI to transform complex blueprints into high-yield practice scenarios.
            </p>
            <div className="flex items-center gap-3 pt-2">
              {settings.socialLinks.map((link: SocialLink, index: number) => (
                <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white hover:bg-primary hover:text-white hover:border-primary transition-all" title={link.platform}>
                  {getSocialIcon(link.platform)}
                </a>
              ))}
              <a href="https://uvhlyitcrogvssmcqtni.supabase.co/functions/v1/rss-feed" target="_blank" rel="noopener noreferrer" className="h-10 w-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white hover:bg-orange-500 hover:text-white hover:border-orange-500 transition-all" title="RSS Feed">
                <Rss className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <h4 className="text-sm font-black uppercase tracking-widest text-white">Curriculum</h4>
            <nav className="flex flex-col space-y-3 text-sm">
              <Link to="/quiz" className="hover:text-primary transition-colors flex items-center gap-2 group"><ArrowRight className="h-3 w-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all" /> Practice Quizzes</Link>
              <Link to="/user/take-test" className="hover:text-primary transition-colors flex items-center gap-2 group"><ArrowRight className="h-3 w-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all" /> Simulated Exams</Link>
              <Link to="/quiz-of-the-day" className="hover:text-primary transition-colors flex items-center gap-2 group"><ArrowRight className="h-3 w-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all" /> Question of the Day</Link>
              <Link to="/blog" className="hover:text-primary transition-colors flex items-center gap-2 group"><ArrowRight className="h-3 w-3 opacity-0 -ml-5 group-hover:opacity-100 group-hover:ml-0 transition-all" /> Study Guides</Link>
            </nav>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <h4 className="text-sm font-black uppercase tracking-widest text-white">Support</h4>
            <nav className="flex flex-col space-y-3 text-sm">
              <Link to="/contact" className="hover:text-primary transition-colors">Contact Center</Link>
              <Link to="/faq" className="hover:text-primary transition-colors">Exam FAQs</Link>
              <Link to="/road-to-gulf" className="hover:text-primary transition-colors">Road to Gulf Guide</Link>
              <a href={`mailto:${contactEmail}`} className="hover:text-primary transition-colors truncate">{contactEmail}</a>
            </nav>
          </div>

          <div className="lg:col-span-4 space-y-6 bg-white/5 p-6 rounded-3xl border border-white/10">
            <h4 className="text-sm font-black uppercase tracking-widest text-white">Global Presence</h4>
            <div className="space-y-4 text-xs">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span className="leading-relaxed font-medium">Healthcare City, Phase 2, <br/>Dubai, United Arab Emirates</span>
              </div>
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-green-500 shrink-0 fill-green-500/10" />
                <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-white font-bold transition-colors">{whatsappNumber}</a>
              </div>
              <div className="pt-4 border-t border-white/10 flex items-center gap-3">
                <ShieldCheck className="h-8 w-8 text-white/20" />
                <p className="text-[10px] leading-tight opacity-60">Verified clinical accuracy and DMCA protected content.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-[10px] font-black uppercase tracking-widest">
            {legalLinks.map((link) => (
              <Link key={link.slug} to={getRouteFromSlug(link.slug)} className="hover:text-white transition-colors">
                {link.title}
              </Link>
            ))}
          </div>
          <p className="text-[10px] font-bold tracking-widest uppercase">
            &copy; {currentYear} Study Prometric MCQs. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;