"use client";

import { MadeWithDyad } from '@/components/made-with-dyad';
import { Link } from 'react-router-dom';

const SignUp = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <h1 className="text-5xl font-extrabold text-green-600 dark:text-green-400 mb-8">MINIMAL SIGN UP TEST</h1>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        This is a test page. If you see this, the routing is working!
      </p>
      <Link to="/login" className="text-primary hover:underline mt-4">
        Go to Login
      </Link>
      <MadeWithDyad />
    </div>
  );
};

export default SignUp;