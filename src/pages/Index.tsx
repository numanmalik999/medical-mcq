"use client";

import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Index = () => {
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
          <Link to="/admin/dashboard">
            <Button size="lg" variant="outline">Go to Admin Dashboard</Button>
          </Link>
        </div>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;