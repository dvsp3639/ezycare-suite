import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface UserProfile {
  full_name: string;
  phone?: string;
  avatar_url?: string;
}

interface UserRole {
  role: string;
  hospital_id?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  roles: UserRole[];
  allowedModules: string[];
  session: Session | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isSuperAdmin: boolean;
  isHospitalAdmin: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [allowedModules, setAllowedModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserData = useCallback(async (accessToken: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-api/me", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!error && data) {
        setProfile(data.profile);
        setRoles(data.roles || []);
        setAllowedModules(data.allowed_modules || []);
      }
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.access_token) {
          // Defer data fetch to avoid deadlock
          setTimeout(() => fetchUserData(newSession.access_token), 0);
        } else {
        setProfile(null);
        setRoles([]);
        setAllowedModules([]);
      }
        setLoading(false);
      }
    );

    // THEN check existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      if (existingSession?.access_token) {
        fetchUserData(existingSession.access_token);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setAllowedModules([]);
  }, []);

  const isSuperAdmin = roles.some(r => r.role === "super_admin");
  const isHospitalAdmin = roles.some(r => r.role === "hospital_admin");

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        roles,
        session,
        login,
        logout,
        isAuthenticated: !!user,
        isSuperAdmin,
        isHospitalAdmin,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
};
