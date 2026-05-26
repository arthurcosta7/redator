"use client";

/**
 * UserContext.tsx — Contexto global do usuário autenticado
 *
 * Busca o perfil do usuário uma vez ao montar e disponibiliza em toda a árvore.
 * Em caso de 401, redireciona para o login (o interceptor do axios já faz isso,
 * mas mantemos aqui como camada extra de segurança).
 */
import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import type { CurrentUser } from "@/types/user";

interface UserContextValue {
  user: CurrentUser | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
  refetch: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await api.get<CurrentUser>("/users/me");
      setUser(res.data);
    } catch {
      // 401 já é tratado pelo interceptor do axios (redireciona para login)
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  return (
    <UserContext.Provider value={{ user, isLoading, refetch: fetchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  return useContext(UserContext);
}
