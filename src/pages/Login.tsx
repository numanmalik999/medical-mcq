"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Link } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';

const Login = () => {
  const { hasCheckedInitialSession } = useSession();

  // Use VITE_PUBLIC_BASE_URL for production redirect, fallback to current origin for development
  const baseUrl = import.meta.env.VITE_PUBLIC_BASE_URL || window.location.origin;
  const redirectToUrl = `${baseUrl}/redirect`;

  if (!hasCheckedInitialSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 pt-16">
        <p className="text-gray-700">Loading login page...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 pt-16">
      <div className="w-full max-w-md bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 mb-6">Login</h1>
        <Auth
          supabaseClient={supabase}
          providers={['google']}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(var(--primary))',
                  brandAccent: 'hsl(var(--primary-foreground))',
                },
              },
            },
          }}
          theme="light"
          view="sign_in"
          redirectTo={redirectToUrl}
          localization={{
            variables: {
              sign_in: {
                link_text: '',
              },
              sign_up: {
                link_text: '',
              },
            },
          }}
        />
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