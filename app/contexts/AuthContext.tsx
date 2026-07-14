import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Linking } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type OAuthProvider = 'google' | 'apple';

type AuthContextValue = {
  session: Session | null;
  initializing: boolean;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: OAuthProvider) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setInitializing(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      initializing,
      signUpWithEmail: async (email, password) => {
        const { error } = await supabase.auth.signUp({ email, password });
        return { error: error?.message ?? null };
      },
      signInWithEmail: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signInWithOAuth: async (provider) => {
        // Requires the provider to be configured in the Supabase Dashboard
        // (Authentication -> Providers) with a client ID/secret before this
        // will actually complete a login.
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { skipBrowserRedirect: true },
        });
        if (error) return { error: error.message };
        if (data?.url) await Linking.openURL(data.url);
        return { error: null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, initializing]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
