"use client";

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const Header = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const navigate = useNavigate();

  const handleAppTitleClick = () => {
    if (!hasCheckedInitialSession) {
      // Still loading session, do nothing or show a loading indicator
      return;
    }
    if (user) {
      if (user.is_admin) {
        navigate('/admin/dashboard');
      } else {
        navigate('/user/dashboard');
      }
    } else {
      navigate('/'); // Redirect unauthenticated users to the home page
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-4 shadow-md">
      <div className="container mx-auto flex justify-center items-center h-full">
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
      </div>
    </header>
  );
};

export default Header;