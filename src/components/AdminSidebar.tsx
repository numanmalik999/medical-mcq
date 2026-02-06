"use client";

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { 
    MenuIcon, 
    LayoutDashboard, 
    PlusCircle, 
    BookOpenText, 
    FolderKanban, 
    CreditCard, 
    Users, 
    LogOut, 
    UploadCloud, 
    MessageSquareWarning, 
    FileQuestion, 
    Settings, 
    GraduationCap, 
    CalendarDays, 
    Layout, 
    Lightbulb, 
    Youtube, 
    Search,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isMobile?: boolean;
  onLinkClick?: () => void;
  isCollapsed?: boolean;
}

const NavLink = ({ to, icon, label, isMobile, onLinkClick, isCollapsed }: NavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link to={to} onClick={onLinkClick} title={isCollapsed ? label : undefined}>
      <Button
        variant="ghost"
        className={cn(
          "w-full transition-all duration-200 gap-2",
          isCollapsed ? "justify-center px-0" : "justify-start px-4",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isMobile && "text-base py-3"
        )}
      >
        <div className="shrink-0">{icon}</div>
        {!isCollapsed && <span className="flex-grow text-left truncate">{label}</span>}
      </Button>
    </Link>
  );
};

interface AdminSidebarProps {
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
}

const AdminSidebar = ({ isCollapsed, onToggleCollapse }: AdminSidebarProps) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleLinkClick = () => {
    if (isMobile) setIsOpen(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    if (isMobile) setIsOpen(false);
    navigate('/login');
  };

  const navItems = [
    { to: "/admin/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard" },
    { to: "/admin/manage-landing-page", icon: <Layout className="h-4 w-4" />, label: "Manage Landing Page" },
    { to: "/admin/seo", icon: <Search className="h-4 w-4" />, label: "SEO & Content Audit" },
    { to: "/admin/add-mcq", icon: <PlusCircle className="h-4 w-4" />, label: "Add MCQ" },
    { to: "/admin/bulk-upload-mcqs", icon: <UploadCloud className="h-4 w-4" />, label: "Bulk Upload MCQs" },
    { to: "/admin/manage-mcqs", icon: <BookOpenText className="h-4 w-4" />, label: "Manage MCQs" },
    { to: "/admin/manage-daily-mcqs", icon: <CalendarDays className="h-4 w-4" />, label: "Manage Daily MCQs" },
    { to: "/admin/manage-submitted-mcqs", icon: <FileQuestion className="h-4 w-4" />, label: "Submitted MCQs" },
    { to: "/admin/manage-categories", icon: <FolderKanban className="h-4 w-4" />, label: "Manage Categories" },
    { to: "/admin/manage-courses", icon: <GraduationCap className="h-4 w-4" />, label: "Manage Courses" },
    { to: "/admin/manage-videos", icon: <Youtube className="h-4 w-4" />, label: "Manage Videos" },
    { to: "/admin/manage-subscriptions", icon: <CreditCard className="h-4 w-4" />, label: "Manage Subscriptions" },
    { to: "/admin/manage-users", icon: <Users className="h-4 w-4" />, label: "Manage Users" },
    { to: "/admin/manage-feedback", icon: <MessageSquareWarning className="h-4 w-4" />, label: "Manage Feedback" },
    { to: "/admin/manage-suggestions", icon: <Lightbulb className="h-4 w-4" />, label: "Manage Suggestions" },
    { to: "/admin/settings", icon: <Settings className="h-4 w-4" />, label: "Settings" },
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
          <h2 className="text-2xl font-bold text-sidebar-primary-foreground mb-6">Admin Panel</h2>
          <div className="flex-1 overflow-y-auto pr-2 -mr-2">
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} isMobile={true} onLinkClick={handleLinkClick} />
              ))}
            </nav>
          </div>
          <div className="mt-auto pt-4 border-t border-sidebar-border">
            <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout}><LogOut className="h-4 w-4" /><span>Logout</span></Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside className={cn(
        "min-h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border flex flex-col transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
    )}>
      <div className={cn("p-4 flex items-center mb-4 transition-all duration-300", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && <h2 className="text-xl font-bold text-sidebar-primary-foreground truncate px-2">Admin Panel</h2>}
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={onToggleCollapse} 
            className={cn("h-8 w-8 rounded-full bg-muted/50 hover:bg-muted transition-all", isCollapsed && "mt-2")}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex flex-col gap-1 px-2 flex-grow overflow-y-auto pr-1 scrollbar-hide">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} isCollapsed={isCollapsed} />
        ))}
      </nav>
      
      <div className="mt-auto p-2 border-t border-sidebar-border">
        <Button 
            variant="ghost" 
            className={cn("w-full transition-all duration-200", isCollapsed ? "justify-center px-0" : "justify-start gap-2 px-4")} 
            onClick={handleLogout}
            title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!isCollapsed && <span>Logout</span>}
        </Button>
      </div>
    </aside>
  );
};

export default AdminSidebar;