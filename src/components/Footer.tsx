"use client";

import { Link } from 'react-router-dom';
import { MadeWithDyad } from './made-with-dyad';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SquareWhatsapp, MapPin } from 'lucide-react'; // Corrected import from Whatsapp to SquareWhatsapp

interface StaticPageLink {
  slug: string;
  title: string;
}

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const { toast } = useToast();
  const [footerLinks, setFooterLinks] = useState<StaticPageLink[]>([]);

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
  }, [toast]);

  // Separate links into Quick Links and Legal based on title keywords for organization
  const quickLinks = footerLinks.filter(link => !link.title.toLowerCase().includes('policy') && !link.title.toLowerCase().includes('terms'));
  const legalLinks = footerLinks.filter(link => link.title.toLowerCase().includes('policy') || link.title.toLowerCase().includes('terms'));

  const whatsappNumber = "+923146616970";
  const address = "Muhalla Boarding House Chawinda, Sialkot";

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
              <SquareWhatsapp className="h-4 w-4 text-green-500 flex-shrink-0" />
              <a 
                href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                {whatsappNumber}
              </a>
            </div>

            {/* Address */}
            <div className="flex items-start justify-center md:justify-start space-x-2 text-sm text-muted-foreground pt-1">
              <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>{address}</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <h4 className="text-lg font-semibold">Quick Links</h4>
            <nav className="flex flex-col space-y-1 text-sm">
              {quickLinks.map((link) => (
                <Link key={link.slug} to={`/${link.slug}`} className="text-muted-foreground hover:text-foreground transition-colors">
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
                <Link key={link.slug} to={`/${link.slug}`} className="text-muted-foreground hover:text-foreground transition-colors">
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