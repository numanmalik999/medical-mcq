"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { MadeWithDyad } from '@/components/made-with-dyad';
// Removed useToast as handleAuthError is no longer needed
// import { useToast } from '@/hooks/use-toast';

const Login = () => {
  // Removed handleAuthError function as onError prop is not supported
  // const { toast } = useToast();
  // const handleAuthError = (error: Error) => {
  //   console.error("Supabase Auth Error:", error);
  //   toast({
  //     title: "Authentication Error",
  //     description: error.message,
  //     variant: "destructive",
  //   });
  // };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-6">Welcome Back!</h1>
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
          view="sign_in" // Default to sign_in view, users can switch to sign_up within the UI
          // Removed onError prop
        />
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Login;