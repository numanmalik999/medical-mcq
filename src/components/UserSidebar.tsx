"use client";

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { MenuIcon, LayoutDashboard, User, BookOpenText, LogOut, ClipboardCheck, CreditCard, FilePlus } from 'lucide-react'; // Import FilePlus icon
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSession } from './SessionContextProvider';

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isMobile?: boolean;
  onLinkClick?: () => void;
  disabled?: boolean;
}

const NavLink = ({ to, icon, label, isMobile, onLinkClick, disabled }: NavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link to={to} onClick={onLinkClick} className={disabled ? "pointer-events-none opacity-50" : ""}>
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start gap-2",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-foreground hover:bg-accent hover:text-accent-foreground",
          isMobile && "text-base py-3"
        )}
        disabled={disabled}
      >
        {icon}
        <span>{label}</span>
      </Button>
    </Link>
  );
};

const UserSidebar = () => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = React.useState(false);
  const { toast } = useToast();
  const { user } = useSession();

  const handleLinkClick = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Error logging out:", error);
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    }
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const navItems = [
    { to: "/user/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard" },
    { to: "/user/profile", icon: <User className="h-4 w-4" />, label: "Profile" },
    { to: "/quiz", icon: <BookOpenText className="h-4 w-4" />, label: "Take Quiz" },
    { 
      to: "/user/take-test", 
      icon: <ClipboardCheck className="h-4 w-4" />, 
      label: "Take A Test",
      disabled: !user?.has_active_subscription
    },
    { to: "/user/subscriptions", icon: <CreditCard className="h-4 w-4" />, label: "My Subscriptions" },
    { to: "/user/submit-mcq", icon: <FilePlus className="h-4 w-4" />, label: "Submit MCQ" }, // New link
  ];

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50">
            <MenuIcon className="h-6 w-6" />
            <span className="sr-only">Toggle navigation</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-4 bg-background flex flex-col">
          <h2 className="text-2xl font-bold text-foreground mb-6">User Panel</h2>
          <nav className="flex flex-col gap-2 flex-grow">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                isMobile={true}
                onLinkClick={handleLinkClick}
                disabled={item.disabled}
              />
            ))}
          </nav>
          <div className="mt-auto pt-4 border-t border-border">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-foreground hover:bg-accent hover:text-accent-foreground"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className="w-64 min-h-screen bg-background text-foreground p-4 border-r border-border flex flex-col">
      <h2 className="text-2xl font-bold text-foreground mb-6">User Panel</h2>
      <nav className="flex flex-col gap-2 flex-grow">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} disabled={item.disabled} />
        ))}
      </nav>
      <div className="mt-auto pt-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-foreground hover:bg-accent hover:text-accent-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </div>
    </aside>
  );
};

export default UserSidebar;