"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { Link, useSearchParams } from 'react-router-dom'; // Import useSearchParams
import { useSession } from '@/components/SessionContextProvider';

const Login = () => {
  const { hasCheckedInitialSession } = useSession();
  const [searchParams] = useSearchParams();
  const tierId = searchParams.get('tierId');

  // Determine the redirect URL based on whether a tierId is present
  const redirectToUrl = tierId 
    ? `${window.location.origin}/subscription?tierId=${tierId}`
    : `${window.location.origin}/redirect`; // Use /redirect for default dashboard routing

  if (!hasCheckedInitialSession) { // Show loading only until initial session check is done
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
          providers={[]}
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
          redirectTo={redirectToUrl} // Use the determined redirect URL
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
          <Link to={`/signup${tierId ? `?tierId=${tierId}` : ''}`} className="text-primary hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Login;