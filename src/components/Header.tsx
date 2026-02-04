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
import { Search, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { differenceInDays, parseISO } from 'date-fns';

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/quiz?search=\${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const homeDestination = user 
    ? (user.is_admin ? "/admin/dashboard" : "/user/dashboard") 
    : "/";

  // Subscription Warning Logic
  const daysRemaining = user?.subscription_end_date 
    ? differenceInDays(parseISO(user.subscription_end_date), new Date()) 
    : null;
  const showWarning = user?.has_active_subscription && daysRemaining !== null && daysRemaining <= 5;

  return (
    <>
      {showWarning && (
        <div className="fixed top-0 left-0 right-0 z-[60] bg-red-600 text-white py-1.5 px-4 text-center text-xs font-bold flex items-center justify-center gap-2 animate-in slide-in-from-top duration-300">
          <AlertTriangle className="h-3 w-3" />
          <span>Your premium subscription expires in {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}. Renew now to keep full access!</span>
          <Link to="/user/subscriptions" className="underline ml-2 hover:text-white/80 transition-colors">Renew Access</Link>
        </div>
      )}
      <header className={cn(
        "fixed left-0 right-0 z-50 bg-primary text-primary-foreground p-3 shadow-xl backdrop-blur-md bg-opacity-95 border-b border-white/10 h-16 flex items-center transition-all",
        showWarning ? "top-[28px]" : "top-0"
      )}>
        <div className="container mx-auto flex justify-between items-center h-full gap-4">
          <div className="flex items-center gap-6 shrink-0 h-full">
            <Link
              to={homeDestination}
              className={cn(
                "flex items-center hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-primary focus-visible:ring-white rounded-xl"
              )}
              aria-label="Study Prometric - Home"
            >
              <Logo />
            </Link>
            <nav className="hidden xl:flex space-x-6 items-center h-full">
              {headerLinks.map((link) => (
                <Link
                  key={link.slug}
                  to={`/\${link.slug}`}
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
              <Link to={homeDestination}>
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20 rounded-full font-bold uppercase"
                  >
                    Dashboard
                  </Button>
                </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Header;