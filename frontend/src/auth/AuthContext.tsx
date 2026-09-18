import { createContext, useContext, useState, type ReactNode } from "react";
import { authApi } from "../api/endpoints";
import type { UserRole } from "../api/types";

interface AuthUser {
  userId: number;
  username: string;
  fullName: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(username: string, password: string) {
    const res = await authApi.login(username, password);
    const authUser: AuthUser = {
      userId: res.data.userId,
      username: res.data.username,
      fullName: res.data.fullName,
      email: res.data.email,
      role: res.data.role as UserRole,
    };
    localStorage.setItem("token", res.data.token);
    localStorage.setItem("user", JSON.stringify(authUser));
    setUser(authUser);
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  function hasRole(...roles: UserRole[]) {
    return !!user && roles.includes(user.role);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
