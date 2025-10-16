"use client";

import { useNavigate } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom'; // Import Link for the Login button

const Header = () => {
  const { user, hasCheckedInitialSession } = useSession();
  const navigate = useNavigate();

  const handleAppTitleClick = () => {
    if (!hasCheckedInitialSession) {
      // Still loading session, do nothing or show a loading indicator
      return;
    }
    if (user) {
      // If logged in, go directly to the appropriate dashboard
      if (user.is_admin) {
        navigate('/admin/dashboard');
      } else {
        navigate('/user/dashboard');
      }
    } else {
      // If not logged in, go to the landing page
      navigate('/');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground p-4 shadow-md">
      <div className="container mx-auto flex justify-between items-center h-full"> {/* Changed to justify-between */}
        <div className="w-16"> {/* Placeholder for left alignment if needed, or for mobile menu */}
          {/* You can add a mobile menu trigger here if desired */}
        </div>
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
        <div className="w-16 flex justify-end"> {/* Container for right-aligned items */}
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