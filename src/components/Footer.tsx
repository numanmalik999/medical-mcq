"use client";

import { Link, useLocation } from 'react-router-dom';
import { MadeWithDyad } from './made-with-dyad';
import { MessageSquare, Mail, MapPin, Twitter, Facebook, Instagram, Linkedin, Globe, Youtube, ShieldCheck, Rss, Music2 } from 'lucide-react';
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

  const quickLinks = footerLinks.filter(link => 
    !link.title.toLowerCase().includes('policy') && 
    !link.title.toLowerCase().includes('terms')
  );
  const legalLinks = footerLinks.filter(link => 
    link.title.toLowerCase().includes('policy') || 
    link.title.toLowerCase().includes('terms')
  );

  const whatsappNumber = "+92 317 4636479";
  const contactEmail = "support@studyprometric.com";
  const officeAddress = "Healthcare City, Phase 2, Dubai, UAE";
  const rssUrl = "https://uvhlyitcrogvssmcqtni.supabase.co/functions/v1/rss-feed";

  return (
    <footer className="bg-card text-card-foreground py-12 border-t border-border mt-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-center md:text-left">
          
          <div className="space-y-4">
            <h4 className="text-xl font-bold tracking-tight">Study Prometric MCQs</h4>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Empowering healthcare professionals to master their Gulf licensing exams with AI-enhanced clinical questions and expert-curated study paths.
            </p>
            <div className="flex items-center justify-center md:justify-start gap-4 pt-2">
              {settings.socialLinks.map((link: SocialLink, index: number) => (
                <a key={index} href={link.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title={link.platform}>
                  {getSocialIcon(link.platform)}
                </a>
              ))}
              <a href={rssUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-orange-500 transition-colors" title="RSS Feed">
                <Rss className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Contact & Support</h4>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span>{officeAddress}</span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-3">
                <Mail className="h-4 w-4 text-primary shrink-0" />
                <a href={`mailto:${contactEmail}`} className="hover:text-primary transition-colors">{contactEmail}</a>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-3">
                <MessageSquare className="h-4 w-4 text-green-500 shrink-0 fill-green-500/10" />
                <a href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">{whatsappNumber}</a>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Quick Access</h4>
            <nav className="flex flex-col space-y-2 text-sm">
              <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">Home</Link>
              <Link to="/blog" className="text-muted-foreground hover:text-primary transition-colors">Exam Insights Blog</Link>
              <Link to="/sitemap" className="text-muted-foreground hover:text-primary transition-colors">Site Map</Link>
              {quickLinks.map((link) => (
                <Link key={link.slug} to={getRouteFromSlug(link.slug)} className="text-muted-foreground hover:text-primary transition-colors">
                  {link.title}
                </Link>
              ))}
            </nav>
          </div>

          <div className="space-y-4">
            <h4 className="text-lg font-semibold">Legal & Compliance</h4>
            <nav className="flex flex-col space-y-2 text-sm">
              {legalLinks.map((link) => (
                <Link key={link.slug} to={getRouteFromSlug(link.slug)} className="text-muted-foreground hover:text-primary transition-colors">
                  {link.title}
                </Link>
              ))}
              <div className="pt-4 flex items-center justify-center md:justify-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-blue-500" />
                <span>DMCA Protected & Secure</span>
              </div>
            </nav>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border flex flex-col items-center gap-4 text-sm text-muted-foreground">
          <p className="font-medium">&copy; {currentYear} Study Prometric MCQs. All rights reserved.</p>
          <MadeWithDyad />
        </div>
      </div>
    </footer>
  );
};

export default Footer;