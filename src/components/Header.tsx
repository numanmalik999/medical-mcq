"use client";

import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
    <header className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center h-full">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            className={cn(
              "text-xl font-bold text-primary-foreground hover:text-primary-foreground/90",
              "focus-visible:ring-offset-primary focus-visible:ring-primary"
            )}
            onClick={handleAppTitleClick}
            aria-label="Go to Dashboard"
          >
            Study Prometric MCQs
          </Button>
          <nav className="hidden md:flex space-x-4">
            {headerLinks.map((link) => (
              <Link
                key={link.slug}
                to={`/${link.slug}`}
                className="text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors"
              >
                {link.title}
              </Link>
            ))}
            <Link
              to="/blog"
              className="text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors"
            >
              Blog
            </Link>
            <Link
              to="/subscription"
              className="text-sm font-medium text-primary-foreground/80 hover:text-primary-foreground transition-colors"
            >
              Pricing
            </Link>
          </nav>
        </div>
        <div className="flex justify-end items-center gap-2">
          {hasCheckedInitialSession && !user && (
            <Link to="/login">
              <Button variant="secondary" size="sm" className="text-primary">
                Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;