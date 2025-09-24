"use client";

import { MadeWithDyad } from '@/components/made-with-dyad';
import { Link } from 'react-router-dom';

const Login = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">Temporary Login Page</h1>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          This is a temporary login page to diagnose a routing issue.
        </p>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Please click the link below to go to the Sign Up page.
        </p>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Login;