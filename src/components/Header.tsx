"use client";

import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import Logo from './Logo';

interface StaticPageLink {
  slug: string;
  title: string;
}

const Header = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [headerLinks, setHeaderLinks] = useState<StaticPageLink[]>([]);
  const location = useLocation();

  useEffect(() => {
    const fetchHeaderLinks = async () => {
      const { data, error } = await supabase
        .from('static_pages')
        .select('slug, title, location')
        .contains('location', ['header'])
        .order('title', { ascending: true });

      if (error) {
        console.error('Error fetching header links:', error);
        toast({ title: "Error", description: "Failed to load header links.", variant: "destructive" });
        setHeaderLinks([]);
      } else {
        setHeaderLinks(data || []);
      }
    };
    fetchHeaderLinks();
  }, [location.pathname, toast]);

  const handleAppTitleClick = () => {
    if (!hasCheckedInitialSession) {
      return;
    }
    if (user) {
      if (user.is_admin) {
        navigate('/admin/dashboard');
      } else {
        navigate('/user/dashboard');
      }
    } else {
      navigate('/');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-3 shadow-lg backdrop-blur-md bg-opacity-95">
      <div className="container mx-auto flex justify-between items-center h-full">
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            className={cn(
              "p-0 h-auto hover:bg-transparent hover:opacity-90 transition-opacity",
              "focus-visible:ring-offset-primary focus-visible:ring-primary"
            )}
            onClick={handleAppTitleClick}
            aria-label="Go to Dashboard"
          >
            <Logo />
          </Button>
          <nav className="hidden md:flex space-x-6">
            {headerLinks.map((link) => (
              <Link
                key={link.slug}
                to={`/${link.slug}`}
                className="text-sm font-bold uppercase tracking-wide text-primary-foreground/70 hover:text-primary-foreground transition-colors"
              >
                {link.title}
              </Link>
            ))}
            <Link
              to="/blog"
              className="text-sm font-bold uppercase tracking-wide text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              Blog
            </Link>
            <Link
              to="/subscription"
              className="text-sm font-bold uppercase tracking-wide text-primary-foreground/70 hover:text-primary-foreground transition-colors"
            >
              Pricing
            </Link>
          </nav>
        </div>
        <div className="flex justify-end items-center gap-3">
          {hasCheckedInitialSession && !user && (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10 font-bold uppercase tracking-wider">
                  Login
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="secondary" size="sm" className="text-primary font-bold shadow-sm uppercase tracking-wider">
                  Register
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;