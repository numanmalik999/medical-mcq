"use client";

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { useSession } from '@/components/SessionContextProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Stethoscope } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

const Login = () => {
  const { hasCheckedInitialSession, session, user } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (hasCheckedInitialSession && session && user) {
      navigate('/redirect');
    }
  }, [hasCheckedInitialSession, session, user, navigate]);

  const redirectToUrl = `${window.location.origin}/redirect`;

  if (!hasCheckedInitialSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-700">Securing your session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-start bg-gray-50 p-4 pt-8 md:pt-12">
      <Card className="w-full max-w-md border-none shadow-2xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground py-10 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
             <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white rounded-full blur-2xl"></div>
          </div>
          <div className="bg-white/20 p-3 rounded-2xl w-fit mx-auto mb-4 backdrop-blur-md relative z-10">
            <Stethoscope className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-3xl font-black uppercase italic tracking-tighter leading-none mb-2 relative z-10">Welcome Back</CardTitle>
          <CardDescription className="text-primary-foreground/70 font-medium relative z-10">Log in to your clinical dashboard.</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <div className="space-y-6">
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
            
            <div className="flex items-center gap-4 py-2">
                <Separator className="flex-1" />
                <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                  <ShieldCheck className="h-3.5 w-3.5" /> Secure Access
                </div>
                <Separator className="flex-1" />
            </div>

            <div className="space-y-2 text-center text-sm text-muted-foreground">
              <p>
                <Link to="/forgot-password" className="text-primary font-black uppercase hover:underline">
                  Forgot Password?
                </Link>
              </p>
              <p>
                Don't have an account?{" "}
                <Link to="/signup" className="text-primary font-black uppercase hover:underline">
                  Sign Up
                </Link>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;