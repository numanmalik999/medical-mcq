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
      console.log('Auth State Change Event:', event);
      console.log('Auth State Change Session:', currentSession);
      setIsLoading(true); // Start loading for auth state change
      if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        navigate('/login');
        setIsLoading(false); // Ensure loading is false after sign out
      } else if (currentSession) {
        try {
          // Fetch profile to get is_admin status
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', currentSession.user.id)
            .single();

          let isAdmin = false;
          if (profileError) {
            console.error('Error fetching profile for session (onAuthStateChange):', profileError);
            // If no profile found (PGRST116), isAdmin remains false, which is correct.
            // If it's another error, we log it.
          } else if (profileData) {
            isAdmin = profileData.is_admin || false;
            console.log('Profile data fetched (onAuthStateChange):', profileData);
            console.log('Is Admin status (onAuthStateChange):', isAdmin);
          }
          
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
        } catch (err) {
          console.error('Unhandled error during profile fetch in SessionContextProvider (onAuthStateChange):', err);
          setSession(null);
          setUser(null);
          if (location.pathname !== '/login') {
            navigate('/login');
          }
        } finally {
          setIsLoading(false); // Ensure loading is always false
        }
      } else {
        setSession(null);
        setUser(null);
        if (location.pathname !== '/login') {
          navigate('/login');
        }
        setIsLoading(false); // Ensure loading is false if no session
      }
    });

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('Initial Session Check:', initialSession);
      if (initialSession) {
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', initialSession.user.id)
            .single();

          let isAdmin = false;
          if (profileError) {
            console.error('Error fetching profile for initial session:', profileError);
          } else if (profileData) {
            isAdmin = profileData.is_admin || false;
            console.log('Profile data fetched (initial session):', profileData);
            console.log('Is Admin status (initial session):', isAdmin);
          }

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
        } catch (err) {
          console.error('Unhandled error during profile fetch in SessionContextProvider (initial session):', err);
          setSession(null);
          setUser(null);
          if (location.pathname !== '/login') {
            navigate('/login');
          }
        } finally {
          setIsLoading(false); // Ensure loading is always false
        }
      } else {
        setSession(null);
        setUser(null);
        if (location.pathname !== '/login') {
          navigate('/login');
        }
        setIsLoading(false); // Ensure loading is false if no initial session
      }
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