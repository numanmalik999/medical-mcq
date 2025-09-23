"use client";

import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/SessionContextProvider"; // Import useSession

const Index = () => {
  const { user, isLoading } = useSession(); // Use session context

  if (isLoading) {
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
          <Link to="/quiz">
            <Button size="lg">Start Quiz</Button>
          </Link>
          {user ? ( // Conditionally render dashboard links if logged in
            <>
              {user.is_admin ? (
                <Link to="/admin/dashboard">
                  <Button size="lg" variant="outline">Go to Admin Dashboard</Button>
                </Link>
              ) : (
                <Link to="/user/dashboard">
                  <Button size="lg" variant="outline">Go to User Dashboard</Button>
                </Link>
              )}
            </>
          ) : (
            <Link to="/login">
              <Button size="lg" variant="outline">Login</Button>
            </Link>
          )}
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;