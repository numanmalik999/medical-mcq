"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom'; // Import useLocation

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
  const location = useLocation(); // Get current location
  const isMounted = useRef(true); // Use useRef for isMounted flag

  useEffect(() => {
    isMounted.current = true; // Set to true on mount
    console.log('SessionContextProvider: useEffect mounted.');

    const fetchUserProfile = async (supabaseUser: User) => {
      if (!isMounted.current) return null;
      console.log(`Fetching profile for user ID: ${supabaseUser.id}`);
      const { data: profileDataArray, error: profileError } = await supabase
        .from('profiles')
        .select('is_admin, first_name, last_name, phone_number, whatsapp_number, has_active_subscription, trial_taken')
        .eq('id', supabaseUser.id);

      if (profileError && profileError.code !== 'PGRST116') {
        console.error(`Error fetching profile (code: ${profileError.code}):`, profileError);
        // Even if there's an error, we should still return the basic user info
        // to prevent 'user' from being null and blocking protected routes.
        return {
          ...supabaseUser,
          is_admin: false, // Default to false on error
          has_active_subscription: false, // Default to false on error
          trial_taken: false, // Default to false on error
        } as AuthUser;
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

    // Function to handle session changes and update state
    const updateSessionAndUser = async (currentSession: Session | null, event?: string) => {
      if (!isMounted.current) return;

      if (!currentSession) {
        console.log('No session, clearing user and session.');
        setSession(null);
        setUser(null);
        // Only navigate to login if not already on login/signup
        if (location.pathname !== '/login' && location.pathname !== '/signup') {
          navigate('/login');
        }
        setIsLoading(false); // Ensure loading is false when no session
        return;
      }

      // Determine if we need to fetch/re-fetch user profile
      // This is true for initial load, SIGNED_IN, USER_UPDATED, or if the user object is not yet populated
      const shouldFetchProfile = !user || user.id !== currentSession.user.id || event === 'SIGNED_IN' || event === 'USER_UPDATED';

      if (shouldFetchProfile) {
        setIsLoading(true); // Only set loading true if we are fetching profile
        const authUser = await fetchUserProfile(currentSession.user);
        if (isMounted.current) {
          setSession(currentSession);
          setUser(authUser);
          setIsLoading(false); // Set loading false after profile fetch
        }
      } else {
        // For events like TOKEN_REFRESH where user data is already loaded and stable
        setSession(currentSession);
        setIsLoading(false); // Ensure loading is false if no profile fetch was needed
      }
    };

    // Initial session check
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      if (isMounted.current) {
        console.log('Initial Session Check Result:', initialSession);
        await updateSessionAndUser(initialSession, 'INITIAL_LOAD'); // Pass event type
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!isMounted.current) return;
      console.log('onAuthStateChange: Event:', event, 'Session:', currentSession);

      if (event === 'SIGNED_OUT') {
        console.log('SIGNED_OUT event, clearing session and user, navigating to /login');
        setSession(null);
        setUser(null);
        navigate('/login');
        setIsLoading(false);
      } else if (currentSession) {
        await updateSessionAndUser(currentSession, event); // Pass event type
      } else {
        // Fallback for unexpected null session
        setSession(null);
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => {
      isMounted.current = false; // Set to false on unmount
      console.log('SessionContextProvider: useEffect cleanup, unsubscribing from auth state changes.');
      subscription.unsubscribe();
    };
  }, [navigate]); // Removed 'user' and 'location.pathname' from dependencies

  // Dedicated useEffect for redirection after login/signup
  useEffect(() => {
    if (!isLoading && user && (location.pathname === '/login' || location.pathname === '/signup')) {
      console.log('Redirecting after login/signup based on user role.');
      if (user.is_admin) {
        navigate('/admin/dashboard');
      } else {
        navigate('/user/dashboard');
      }
    }
  }, [user, isLoading, navigate, location.pathname]);

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