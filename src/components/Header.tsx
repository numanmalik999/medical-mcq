"use client";

import { useNavigate } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import Logo from './Logo';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigationData } from '@/hooks/useNavigationData';

const Header = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const navigate = useNavigate();
  const { headerLinks } = useNavigationData();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/quiz?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const homeDestination = user 
    ? (user.is_admin ? "/admin/dashboard" : "/user/dashboard") 
    : "/";

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-3 shadow-xl backdrop-blur-md bg-opacity-95 border-b border-white/10 h-16 flex items-center">
      <div className="container mx-auto flex justify-between items-center h-full gap-4">
        <div className="flex items-center gap-6 shrink-0 h-full">
          <Link
            to={homeDestination}
            className="flex items-center hover:opacity-90 transition-opacity rounded-xl"
            aria-label="Study Prometric - Home"
          >
            <Logo />
          </Link>
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
  );
};

export default Header;