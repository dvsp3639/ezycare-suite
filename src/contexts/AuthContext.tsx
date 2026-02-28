import React, { createContext, useContext, useState, useCallback } from "react";

interface User {
  username: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const SAMPLE_USERS = [
  { username: "admin", password: "admin123", name: "Dr. Admin", role: "Administrator" },
  { username: "doctor", password: "doctor123", name: "Dr. Sharma", role: "Doctor" },
  { username: "nurse", password: "nurse123", name: "Nurse Priya", role: "Nurse" },
];

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  const login = useCallback((username: string, password: string) => {
    const found = SAMPLE_USERS.find(u => u.username === username && u.password === password);
    if (found) {
      setUser({ username: found.username, name: found.name, role: found.role });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => setUser(null), []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be within AuthProvider");
  return ctx;
};
