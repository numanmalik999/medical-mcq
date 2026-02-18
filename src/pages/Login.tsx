"use client";

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';

const Login = () => {
  const { hasCheckedInitialSession, session, user } = useSession();
  const navigate = useNavigate();

  // Automatic redirect if session is detected
  useEffect(() => {
    if (hasCheckedInitialSession && session && user) {
      console.log("[Auth] Active session detected, redirecting to dashboard...");
      navigate('/redirect');
    }
  }, [hasCheckedInitialSession, session, user, navigate]);

  // Clear any existing session fragments if the user is on the login page but not fully logged in
  useEffect(() => {
    const clearStaleSession = async () => {
      if (!session && !window.location.hash.includes('access_token')) {
        await supabase.auth.signOut();
      }
    };
    clearStaleSession();
  }, [session]);

  const redirectToUrl = `${window.location.origin}/redirect`;

  if (!hasCheckedInitialSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 pt-16">
        <p className="text-gray-700">Loading security protocols...</p>
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
        />
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;