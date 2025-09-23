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
  phone_number?: string | null;
  whatsapp_number?: string | null;
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
    console.log('SessionContextProvider: useEffect mounted, initial isLoading:', isLoading);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('SessionContextProvider: onAuthStateChange: Event:', event, 'Session:', currentSession);
      setIsLoading(true); // Start loading for any auth state change
      console.log('SessionContextProvider: onAuthStateChange: setIsLoading(true)');

      if (event === 'SIGNED_OUT') {
        console.log('SessionContextProvider: onAuthStateChange: SIGNED_OUT, clearing session and user, navigating to /login');
        setSession(null);
        setUser(null);
        navigate('/login');
        setIsLoading(false);
        console.log('SessionContextProvider: onAuthStateChange: setIsLoading(false) after SIGNED_OUT');
      } else if (currentSession) {
        console.log('SessionContextProvider: onAuthStateChange: Session exists, attempting to fetch profile...');
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin, first_name, last_name, phone_number, whatsapp_number') // Fetch new fields
            .eq('id', currentSession.user.id)
            .single();

          let isAdmin = false;
          let firstName = null;
          let lastName = null;
          let phoneNumber = null;
          let whatsappNumber = null;

          if (profileError) {
            console.error('SessionContextProvider: onAuthStateChange: Error fetching profile:', profileError);
            // If no profile found (PGRST116), fields remain null/false.
          } else if (profileData) {
            isAdmin = profileData.is_admin || false;
            firstName = profileData.first_name || null;
            lastName = profileData.last_name || null;
            phoneNumber = profileData.phone_number || null;
            whatsappNumber = profileData.whatsapp_number || null;
            console.log('SessionContextProvider: onAuthStateChange: Profile data fetched:', profileData);
          }
          
          const authUser: AuthUser = { 
            ...currentSession.user, 
            is_admin: isAdmin,
            first_name: firstName,
            last_name: lastName,
            phone_number: phoneNumber,
            whatsapp_number: whatsappNumber,
          };
          setSession(currentSession);
          setUser(authUser);
          console.log('SessionContextProvider: onAuthStateChange: Session and user set. User is_admin:', authUser.is_admin);

          if (location.pathname === '/login' || location.pathname === '/signup') {
            console.log('SessionContextProvider: onAuthStateChange: On /login or /signup page, redirecting...');
            if (isAdmin) {
              navigate('/admin/dashboard');
            } else {
              navigate('/user/dashboard');
            }
          }
        } catch (err: any) {
          console.error('SessionContextProvider: onAuthStateChange: Unhandled error during profile fetch:', err);
          setSession(null);
          setUser(null);
          if (location.pathname !== '/login' && location.pathname !== '/signup') {
            navigate('/login');
          }
        } finally {
          setIsLoading(false);
          console.log('SessionContextProvider: onAuthStateChange: setIsLoading(false) in finally block.');
        }
      } else {
        console.log('SessionContextProvider: onAuthStateChange: No current session, clearing session and user.');
        setSession(null);
        setUser(null);
        if (location.pathname !== '/login' && location.pathname !== '/signup') {
          navigate('/login');
        }
        setIsLoading(false);
        console.log('SessionContextProvider: onAuthStateChange: setIsLoading(false) for no session.');
      }
    });

    // Initial session check
    console.log('SessionContextProvider: Performing initial session check...');
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('SessionContextProvider: Initial Session Check Result:', initialSession);
      if (initialSession) {
        console.log('SessionContextProvider: Initial Session Check: Session exists, attempting to fetch profile...');
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('is_admin, first_name, last_name, phone_number, whatsapp_number') // Fetch new fields
            .eq('id', initialSession.user.id)
            .single();

          let isAdmin = false;
          let firstName = null;
          let lastName = null;
          let phoneNumber = null;
          let whatsappNumber = null;

          if (profileError) {
            console.error('SessionContextProvider: Initial Session Check: Error fetching profile:', profileError);
          } else if (profileData) {
            isAdmin = profileData.is_admin || false;
            firstName = profileData.first_name || null;
            lastName = profileData.last_name || null;
            phoneNumber = profileData.phone_number || null;
            whatsappNumber = profileData.whatsapp_number || null;
            console.log('SessionContextProvider: Initial Session Check: Profile data fetched:', profileData);
          }

          const authUser: AuthUser = { 
            ...initialSession.user, 
            is_admin: isAdmin,
            first_name: firstName,
            last_name: lastName,
            phone_number: phoneNumber,
            whatsapp_number: whatsappNumber,
          };
          setSession(initialSession);
          setUser(authUser);
          console.log('SessionContextProvider: Initial Session Check: Session and user set. User is_admin:', authUser.is_admin);

          if (location.pathname === '/login' || location.pathname === '/signup') {
            console.log('SessionContextProvider: Initial Session Check: On /login or /signup page, redirecting...');
            if (isAdmin) {
              navigate('/admin/dashboard');
            } else {
              navigate('/user/dashboard');
            }
          }
        } catch (err: any) {
          console.error('SessionContextProvider: Initial Session Check: Unhandled error during profile fetch:', err);
          setSession(null);
          setUser(null);
          if (location.pathname !== '/login' && location.pathname !== '/signup') {
            navigate('/login');
          }
        } finally {
          setIsLoading(false);
          console.log('SessionContextProvider: Initial Session Check: setIsLoading(false) in finally block.');
        }
      } else {
        console.log('SessionContextProvider: Initial Session Check: No initial session, clearing session and user.');
        setSession(null);
        setUser(null);
        if (location.pathname !== '/login' && location.pathname !== '/signup') {
          navigate('/login');
        }
        setIsLoading(false);
        console.log('SessionContextProvider: Initial Session Check: setIsLoading(false) for no initial session.');
      }
    });

    return () => {
      console.log('SessionContextProvider: useEffect cleanup, unsubscribing from auth state changes.');
      subscription.unsubscribe();
    };
  }, [navigate]); // Added navigate to dependency array

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