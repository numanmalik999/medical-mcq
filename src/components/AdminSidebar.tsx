"use client";

import React from 'react';
import { Link, useLocation } from 'react-router-dom'; // Removed useNavigate
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { MenuIcon, LayoutDashboard, PlusCircle, BookOpenText, FolderKanban, CreditCard, Users, LogOut, UploadCloud, MessageSquareWarning, FileQuestion } from 'lucide-react'; // Import LogOut, UploadCloud, MessageSquareWarning, FileQuestion icon
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client'; // Import supabase client

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isMobile?: boolean;
  onLinkClick?: () => void;
}

const NavLink = ({ to, icon, label, isMobile, onLinkClick }: NavLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link to={to} onClick={onLinkClick}>
      <Button
        variant="ghost"
        className={cn(
          "w-full justify-start gap-2",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          isMobile && "text-base py-3"
        )}
      >
        {icon}
        <span>{label}</span>
      </Button>
    </Link>
  );
};

const AdminSidebar = () => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = React.useState(false);

  const handleLinkClick = () => {
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // The SessionContextProvider will handle the navigation to /login
    if (isMobile) {
      setIsOpen(false);
    }
  };

  const navItems = [
    { to: "/admin/dashboard", icon: <LayoutDashboard className="h-4 w-4" />, label: "Dashboard" },
    { to: "/admin/add-mcq", icon: <PlusCircle className="h-4 w-4" />, label: "Add MCQ" },
    { to: "/admin/bulk-upload-mcqs", icon: <UploadCloud className="h-4 w-4" />, label: "Bulk Upload MCQs" },
    { to: "/admin/manage-mcqs", icon: <BookOpenText className="h-4 w-4" />, label: "Manage MCQs" },
    { to: "/admin/manage-submitted-mcqs", icon: <FileQuestion className="h-4 w-4" />, label: "Submitted MCQs" }, // New link
    { to: "/admin/manage-categories", icon: <FolderKanban className="h-4 w-4" />, label: "Manage Categories" },
    { to: "/admin/manage-subscriptions", icon: <CreditCard className="h-4 w-4" />, label: "Manage Subscriptions" },
    { to: "/admin/manage-users", icon: <Users className="h-4 w-4" />, label: "Manage Users" },
    { to: "/admin/manage-feedback", icon: <MessageSquareWarning className="h-4 w-4" />, label: "Manage Feedback" }, // New link
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
        <SheetContent side="left" className="w-64 p-4 bg-sidebar flex flex-col">
          <h2 className="text-2xl font-bold text-sidebar-primary-foreground mb-6">Admin Panel</h2>
          <nav className="flex flex-col gap-2 flex-grow">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                isMobile={true}
                onLinkClick={handleLinkClick}
              />
            ))}
          </nav>
          <div className="mt-auto pt-4 border-t border-sidebar-border">
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
    <aside className="w-64 min-h-screen bg-sidebar text-sidebar-foreground p-4 border-r border-sidebar-border flex flex-col">
      <h2 className="text-2xl font-bold text-sidebar-primary-foreground mb-6">Admin Panel</h2>
      <nav className="flex flex-col gap-2 flex-grow">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
        ))}
      </nav>
      <div className="mt-auto pt-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </div>
    </aside>
  );
};

export default AdminSidebar;