import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { apiClient } from './api-client';

import type { LoginResponse } from '@/types/api';

interface AuthUser {
  id: string;
  email: string;
  name: string;
}

interface AuthOrganization {
  id: string;
  name: string;
  slug: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  organization: AuthOrganization | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [organization, setOrganization] = useState<AuthOrganization | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const navigate = useNavigate();

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiClient.post<LoginResponse>('/v1/auth/login', {
        email,
        password,
      });

      setUser(response.user);
      setOrganization(response.organization);
      setToken(response.token);
      apiClient.setToken(response.token);
      navigate('/');
    },
    [navigate],
  );

  const logout = useCallback(() => {
    setUser(null);
    setOrganization(null);
    setToken(null);
    apiClient.setToken(null);
    navigate('/login');
  }, [navigate]);

  const value = useMemo(
    () => ({
      user,
      organization,
      token,
      isAuthenticated: token !== null,
      login,
      logout,
    }),
    [user, organization, token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
