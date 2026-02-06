"use client";

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
    MenuIcon, 
    LayoutDashboard, 
    User, 
    BookOpenText, 
    LogOut, 
    ClipboardCheck, 
    CreditCard, 
    FilePlus, 
    Bookmark, 
    Lightbulb, 
    Youtube, 
    Stethoscope, 
    Lock,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useSession } from './SessionContextProvider';

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isMobile?: boolean;
  onLinkClick?: () => void;
  isPremium?: boolean;
  isSubscribed?: boolean;
  isCollapsed?: boolean;
}

const NavLink = ({ to, icon, label, isMobile, onLinkClick, isPremium, isSubscribed, isCollapsed }: NavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link to={to} onClick={onLinkClick} title={isCollapsed ? label : undefined}>
      <Button
        variant="ghost"
        className={cn(
          "w-full gap-2 transition-all duration-200 h-9",
          isCollapsed ? "justify-center px-0" : "justify-start px-3",
          isActive
            ? "bg-accent text-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isMobile && "text-base py-3 h-12"
        )}
      >
        <div className="shrink-0">{icon}</div>
        {!isCollapsed && <span className="flex-grow text-left truncate text-sm font-medium">{label}</span>}
        {!isCollapsed && isPremium && !isSubscribed && <Lock className="h-3 w-3 ml-auto text-muted-foreground opacity-50" />}
      </Button>
    </Link>
  );
};

interface UserSidebarProps {
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

const UserSidebar = ({ isCollapsed, onToggleCollapse }: UserSidebarProps) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = React.useState(false);
  const { user } = useSession();
  const navigate = useNavigate();

  const isSubscribed = !!user?.has_active_subscription;

  const handleLinkClick = () => {
    if (isMobile) setIsOpen(false);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Error logging out:", error);
    if (isMobile) setIsOpen(false);
    navigate('/login');
  };

  const navItems = [
    { to: "/user/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard", premium: false },
    { to: "/user/profile", icon: <User className="h-4 w-4" />, label: "Profile", premium: false },
    { to: "/quiz", icon: <BookOpenText className="h-4 w-4" />, label: "Take Quiz", premium: false },
    { to: "/user/take-test", icon: <ClipboardCheck className="h-4 w-4" />, label: "Take A Test", premium: true },
    { to: "/user/case-studies", icon: <Stethoscope className="h-4 w-4" />, label: "Case Studies", premium: true },
    { to: "/user/videos", icon: <Youtube className="h-4 w-4" />, label: "Videos", premium: true },
    { to: "/user/subscriptions", icon: <CreditCard className="h-4 w-4" />, label: "My Subscriptions", premium: false },
    { to: "/user/submit-mcq", icon: <FilePlus className="h-4 w-4" />, label: "Submit MCQ", premium: false },
    { to: "/user/bookmarked-mcqs", icon: <Bookmark className="h-4 w-4" />, label: "Bookmarked MCQs", premium: false },
    { to: "/user/suggestions", icon: <Lightbulb className="h-4 w-4" />, label: "Suggestions", premium: false },
  ];

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="fixed top-4 left-4 z-50 text-primary-foreground hover:bg-primary/50">
            <MenuIcon className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-4 bg-sidebar flex flex-col">
          <h2 className="text-xl font-bold text-sidebar-primary-foreground mb-4">User Panel</h2>
          <div className="flex-1 overflow-y-auto">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <NavLink 
                  key={item.to} 
                  to={item.to} 
                  icon={item.icon} 
                  label={item.label} 
                  isMobile={true} 
                  onLinkClick={handleLinkClick} 
                  isPremium={item.premium}
                  isSubscribed={isSubscribed}
                />
              ))}
            </nav>
          </div>
          <div className="mt-auto pt-4 border-t border-sidebar-border">
            <Button variant="ghost" className="w-full justify-start gap-2 h-10" onClick={handleLogout}><LogOut className="h-4 w-4" /><span>Logout</span></Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className={cn(
        "min-h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-all duration-300 relative",
        isCollapsed ? "w-14" : "w-60"
    )}>
      <div className={cn("p-3 flex items-center mb-2 transition-all duration-300", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && <h2 className="text-lg font-bold text-sidebar-primary-foreground truncate px-1">User Panel</h2>}
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggleCollapse} 
            className={cn("h-7 w-7 rounded-full bg-muted/50 hover:bg-muted transition-all")}
        >
          {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </Button>
      </div>
      
      <nav className="flex flex-col gap-0.5 flex-grow px-1.5">
        {navItems.map((item) => (
          <NavLink 
            key={item.to} 
            to={item.to} 
            icon={item.icon} 
            label={item.label} 
            isPremium={item.premium}
            isSubscribed={isSubscribed}
            isCollapsed={isCollapsed}
          />
        ))}
      </nav>

      <div className="mt-auto p-1.5 border-t border-sidebar-border">
        <Button 
            variant="ghost" 
            className={cn("w-full transition-all duration-200 h-9", isCollapsed ? "justify-center px-0" : "justify-start gap-2 px-3")} 
            onClick={handleLogout}
            title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span className="text-sm font-medium">Logout</span>}
        </Button>
      </div>
    </aside>
  );
};

export default UserSidebar;