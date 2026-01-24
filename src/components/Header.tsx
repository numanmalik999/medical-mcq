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
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface StaticPageLink {
  slug: string;
  title: string;
}

const Header = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [headerLinks, setHeaderLinks] = useState<StaticPageLink[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/quiz?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-3 shadow-xl backdrop-blur-md bg-opacity-95 border-b border-white/10 h-16 flex items-center">
      <div className="container mx-auto flex justify-between items-center h-full gap-4">
        <div className="flex items-center gap-6 shrink-0 h-full">
          <Button
            variant="ghost"
            className={cn(
              "p-0 h-full hover:bg-transparent hover:opacity-90 transition-opacity",
              "focus-visible:ring-offset-primary focus-visible:ring-primary"
            )}
            onClick={handleAppTitleClick}
            aria-label="Study Prometric - Home"
          >
            <Logo />
          </Button>
          <nav className="hidden xl:flex space-x-6 items-center h-full">
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

        {/* Global Search Bar */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md relative group mx-4">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search specialties..."
            className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-10 pr-10 focus-visible:bg-white/20 transition-all rounded-full border-2"
          />
          <Button type="submit" variant="ghost" size="icon" className="absolute right-0 top-0 h-10 w-10 text-white/40 group-hover:text-white">
            <Search className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex justify-end items-center gap-3 shrink-0">
          {hasCheckedInitialSession && !user && (
            <>
              <Link to="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-white/10 font-bold uppercase tracking-wider">
                  Login
                </Button>
              </Link>
              <Link to="/signup">
                <Button variant="secondary" size="sm" className="text-primary font-extrabold shadow-sm uppercase tracking-wider px-6 rounded-full">
                  Register
                </Button>
              </Link>
            </>
          )}
          {user && (
             <Button 
                variant="outline" 
                size="sm" 
                className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-full font-bold uppercase"
                onClick={handleAppTitleClick}
              >
                Dashboard
              </Button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;