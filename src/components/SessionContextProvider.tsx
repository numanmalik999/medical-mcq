"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

// Extend the User type to include profile fields
interface AuthUser extends User {
  is_admin?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  phone_number?: string | null;
  whatsapp_number?: string | null;
  has_active_subscription?: boolean;
  trial_taken?: boolean;
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
  const [isLoading, setIsLoading] = useState(true); // Start as true for initial load
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates on unmounted component
    console.log('SessionContextProvider: useEffect mounted.');

    const fetchUserProfile = async (supabaseUser: User) => {
      if (!isMounted) return null; // Prevent fetching if component unmounted
      console.log(`Fetching profile for user ID: ${supabaseUser.id}`);
      const { data: profileDataArray, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin, first_name, last_name, phone_number, whatsapp_number, has_active_subscription, trial_taken')
        .eq('id', supabaseUser.id);

      if (profileError && profileError.code !== 'PGRST116') {
        console.error(`Error fetching profile (code: ${profileError.code}):`, profileError);
        return null;
      }

      const profileData = profileDataArray && profileDataArray.length > 0 ? profileDataArray[0] : null;
      console.log('Profile data fetched:', profileData);

      return {
        ...supabaseUser,
        is_admin: profileData?.is_admin || false,
        first_name: profileData?.first_name || null,
        last_name: profileData?.last_name || null,
        phone_number: profileData?.phone_number || null,
        whatsapp_number: profileData?.whatsapp_number || null,
        has_active_subscription: profileData?.has_active_subscription || false,
        trial_taken: profileData?.trial_taken || false,
      } as AuthUser;
    };

    const handleSessionChange = async (currentSession: Session | null) => {
      if (!isMounted) return;

      if (!currentSession) {
        console.log('No session, clearing user and session.');
        setSession(null);
        setUser(null);
        if (location.pathname !== '/login' && location.pathname !== '/signup') {
          navigate('/login');
        }
        setIsLoading(false);
        return;
      }

      // Only set loading when we are actively fetching profile or handling a new session
      setIsLoading(true); 
      const authUser = await fetchUserProfile(currentSession.user);
      if (isMounted) {
        setSession(currentSession);
        setUser(authUser);
        setIsLoading(false);

        if (location.pathname === '/login' || location.pathname === '/signup') {
          console.log('On /login or /signup page, redirecting...');
          if (authUser?.is_admin) {
            navigate('/admin/dashboard');
          } else {
            navigate('/user/dashboard');
          }
        }
      }
    };

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (isMounted) {
        console.log('Initial Session Check Result:', initialSession);
        await handleSessionChange(initialSession);
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted) return;
      console.log('onAuthStateChange: Event:', event, 'Session:', currentSession);

      if (event === 'SIGNED_OUT') {
        console.log('SIGNED_OUT event, clearing session and user, navigating to /login');
        setSession(null);
        setUser(null);
        navigate('/login');
        setIsLoading(false); // No loading needed after sign out
      } else if (currentSession) {
        // For SIGNED_IN, USER_UPDATED, or other events where a session exists
        // Only re-fetch profile if the user ID has changed or it's a new sign-in
        if (!user || user.id !== currentSession.user.id || event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          await handleSessionChange(currentSession);
        } else {
          // For other events like TOKEN_REFRESH, if user is already set, just update session
          setSession(currentSession);
          setIsLoading(false); // Ensure loading is false if no profile fetch is needed
        }
      } else {
        // This case should ideally be covered by SIGNED_OUT, but as a fallback
        setSession(null);
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false; // Cleanup: set flag to false
      console.log('SessionContextProvider: useEffect cleanup, unsubscribing from auth state changes.');
      subscription.unsubscribe();
    };
  }, [navigate, user]); // Added 'user' to dependencies to react to user ID changes for profile re-fetch

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