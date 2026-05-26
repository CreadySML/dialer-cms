"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, setToken } from "./api";
import { clearCache } from "./cache";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const loadUser = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.get("/auth/me");
      setUser(user);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = async (email, password) => {
    const { token, user } = await api.post("/auth/login", { email, password });
    setToken(token);
    setUser(user);
    return user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    clearCache();
    router.push("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
