"use client";

import { Link, useLocation } from 'react-router-dom';
import { MadeWithDyad } from './made-with-dyad';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Twitter, Facebook, Instagram, Linkedin, Globe } from 'lucide-react';
import { useGlobalSettings, SocialLink } from '@/hooks/useGlobalSettings'; // Import hook

interface StaticPageLink {
  slug: string;
  title: string;
}

// Helper to map database slugs to simplified routes
const getRouteFromSlug = (slug: string): string => {
  if (slug.includes('privacy')) return '/privacy';
  if (slug.includes('terms')) return '/terms';
  if (slug.includes('refund')) return '/refund';
  if (slug.includes('about')) return '/about';
  if (slug.includes('contact')) return '/contact';
  if (slug.includes('faq')) return '/faq';
  return `/${slug}`;
};

const getSocialIcon = (platform: string) => {
  const lowerPlatform = platform.toLowerCase();
  if (lowerPlatform.includes('twitter') || lowerPlatform.includes('x')) return <Twitter className="h-5 w-5" />;
  if (lowerPlatform.includes('facebook')) return <Facebook className="h-5 w-5" />;
  if (lowerPlatform.includes('instagram')) return <Instagram className="h-5 w-5" />;
  if (lowerPlatform.includes('linkedin')) return <Linkedin className="h-5 w-5" />;
  return <Globe className="h-5 w-5" />;
};

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { toast } = useToast();
  const [footerLinks, setFooterLinks] = useState<StaticPageLink[]>([]);
  const location = useLocation();
  const { settings } = useGlobalSettings(); // Use the new hook

  useEffect(() => {
    const fetchFooterLinks = async () => {
      const { data, error } = await supabase
        .from('static_pages')
        .select('slug, title, location')
        .contains('location', ['footer'])
        .order('title', { ascending: true });

      if (error) {
        console.error('Error fetching footer links:', error);
        toast({ title: "Error", description: "Failed to load footer links.", variant: "destructive" });
        setFooterLinks([]);
      } else {
        setFooterLinks(data || []);
      }
    };
    fetchFooterLinks();
  }, [location.pathname, toast]);

  // Separate links into Quick Links and Legal based on title keywords for organization
  const quickLinks = footerLinks.filter(link => !link.title.toLowerCase().includes('policy') && !link.title.toLowerCase().includes('terms'));
  const legalLinks = footerLinks.filter(link => link.title.toLowerCase().includes('policy') || link.title.toLowerCase().includes('terms'));

  const whatsappNumber = "+923174636479";

  return (
    <footer className="bg-card text-card-foreground py-8 border-t border-border mt-12">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
          {/* Company Info */}
          <div className="space-y-2">
            <h4 className="text-lg font-semibold">Study Prometric MCQs</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Your partner in medical education excellence.
            </p>
            
            {/* WhatsApp Contact */}
            <div className="flex items-center justify-center md:justify-start space-x-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4 text-green-500 flex-shrink-0 fill-green-500" />
              <a 
                href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {whatsappNumber}
              </a>
            </div>

            {/* Social Media Icons */}
            {settings.socialLinks.length > 0 && (
              <div className="flex items-center justify-center md:justify-start space-x-4 pt-4">
                {settings.socialLinks.map((link: SocialLink, index: number) => (
                  <a 
                    key={index} 
                    href={link.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary transition-colors"
                    title={link.platform}
                  >
                    {getSocialIcon(link.platform)}
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <h4 className="text-lg font-semibold">Quick Links</h4>
            <nav className="flex flex-col space-y-1 text-sm">
              {quickLinks.map((link) => (
                <Link key={link.slug} to={getRouteFromSlug(link.slug)} className="text-muted-foreground hover:text-foreground transition-colors">
                  {link.title}
                </Link>
              ))}
            </nav>
          </div>

          {/* Legal */}
          <div className="space-y-2">
            <h4 className="text-lg font-semibold">Legal</h4>
            <nav className="flex flex-col space-y-1 text-sm">
              {legalLinks.map((link) => (
                <Link key={link.slug} to={getRouteFromSlug(link.slug)} className="text-muted-foreground hover:text-foreground transition-colors">
                  {link.title}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-border text-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} Study Prometric MCQs. All rights reserved.</p>
          <MadeWithDyad />
        </div>
      </div>
    </footer>
  );
};

export default Footer;