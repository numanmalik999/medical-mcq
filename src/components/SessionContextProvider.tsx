"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

// Extend the User type to include is_admin
interface AuthUser extends User {
  is_admin?: boolean;
}

interface SessionContextType {
  session: Session | null;
  user: AuthUser | null;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      setIsLoading(true); // Start loading for auth state change
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        navigate('/login');
      } else if (currentSession) {
        // Fetch profile to get is_admin status
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', currentSession.user.id)
          .single();

        const isAdmin = profileData?.is_admin || false;
        const authUser: AuthUser = { ...currentSession.user, is_admin: isAdmin };

        setSession(currentSession);
        setUser(authUser);

        if (location.pathname === '/login') {
          if (isAdmin) {
            navigate('/admin/dashboard');
          } else {
            navigate('/user/dashboard');
          }
        }
      } else {
        setSession(null);
        setUser(null);
        if (location.pathname !== '/login') {
          navigate('/login');
        }
      }
      setIsLoading(false);
    });

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (initialSession) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', initialSession.user.id)
          .single();

        const isAdmin = profileData?.is_admin || false;
        const authUser: AuthUser = { ...initialSession.user, is_admin: isAdmin };

        setSession(initialSession);
        setUser(authUser);

        if (location.pathname === '/login') {
          if (isAdmin) {
            navigate('/admin/dashboard');
          } else {
            navigate('/user/dashboard');
          }
        }
      } else {
        setSession(null);
        setUser(null);
        if (location.pathname !== '/login') {
          navigate('/login');
        }
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  return (
    <SessionContext.Provider value={{ session, user, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};