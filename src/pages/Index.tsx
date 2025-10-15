"use client";

import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/SessionContextProvider"; // Import useSession

const Index = () => {
  const { user, hasCheckedInitialSession } = useSession(); // Use hasCheckedInitialSession

  if (!hasCheckedInitialSession) { // Show loading only until initial session check is done
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <p className="text-gray-700 dark:text-gray-300">Loading user session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">Welcome to Your Medical Education Platform</h1>
        <p className="text-xl text-gray-600 dark:text-gray-400">
          Start building your amazing project here!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          {user ? ( // Conditionally render dashboard links if logged in
            <>
              {user.is_admin ? (
                <Link to="/admin/dashboard">
                  <Button size="lg">Go to Admin Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link to="/user/dashboard">
                    <Button size="lg">Go to User Dashboard</Button>
                  </Link>
                  {!user.has_active_subscription && !user.trial_taken && (
                    <Link to="/quiz">
                      <Button size="lg" variant="outline">Start Free Trial</Button>
                    </Link>
                  )}
                  {!user.has_active_subscription && user.trial_taken && (
                    <Link to="/user/subscriptions">
                      <Button size="lg" variant="outline">Subscribe Now</Button>
                    </Link>
                  )}
                  {user.has_active_subscription && (
                    <Link to="/quiz">
                      <Button size="lg" variant="outline">Continue Quizzing</Button>
                    </Link>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              <Link to="/login">
                <Button size="lg">Login</Button>
              </Link>
              <Link to="/user/subscriptions"> {/* Changed from /signup to /user/subscriptions */}
                <Button size="lg" variant="outline">Sign Up & Subscribe</Button>
              </Link>
              <Link to="/quiz">
                <Button size="lg" variant="ghost">Continue as Guest</Button>
              </Link>
            </>
          )}
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;