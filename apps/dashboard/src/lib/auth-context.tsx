import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';

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
  switchOrganization: (organizationId: string) => Promise<void>;
}

const STORAGE_KEYS = {
  token: 'assertly_token',
  user: 'assertly_user',
  org: 'assertly_org',
} as const;

function loadSessionState(): {
  token: string | null;
  user: AuthUser | null;
  organization: AuthOrganization | null;
} {
  try {
    const token = sessionStorage.getItem(STORAGE_KEYS.token);
    if (!token) return { token: null, user: null, organization: null };

    const user = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.user) ?? 'null') as AuthUser | null;
    const organization = JSON.parse(
      sessionStorage.getItem(STORAGE_KEYS.org) ?? 'null',
    ) as AuthOrganization | null;

    if (!user || !organization) {
      clearSessionStorage();
      return { token: null, user: null, organization: null };
    }

    apiClient.setToken(token);
    return { token, user, organization };
  } catch {
    clearSessionStorage();
    return { token: null, user: null, organization: null };
  }
}

function persistSession(token: string, user: AuthUser, organization: AuthOrganization): void {
  sessionStorage.setItem(STORAGE_KEYS.token, token);
  sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  sessionStorage.setItem(STORAGE_KEYS.org, JSON.stringify(organization));
}

function clearSessionStorage(): void {
  sessionStorage.removeItem(STORAGE_KEYS.token);
  sessionStorage.removeItem(STORAGE_KEYS.user);
  sessionStorage.removeItem(STORAGE_KEYS.org);
}

const EXPIRY_WARNING_MS = 5 * 60 * 1000;

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!)) as { exp?: number };
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionState] = useState(loadSessionState);
  const [user, setUser] = useState<AuthUser | null>(sessionState.user);
  const [organization, setOrganization] = useState<AuthOrganization | null>(
    sessionState.organization,
  );
  const [token, setToken] = useState<string | null>(sessionState.token);
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
      persistSession(response.token, response.user, response.organization);
      navigate('/');
    },
    [navigate],
  );

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      const response = await apiClient.post<LoginResponse>('/v1/auth/switch-organization', {
        organizationId,
      });
      setUser(response.user);
      setOrganization(response.organization);
      setToken(response.token);
      apiClient.setToken(response.token);
      persistSession(response.token, response.user, response.organization);
      navigate('/');
    },
    [navigate],
  );

  const logout = useCallback(() => {
    setUser(null);
    setOrganization(null);
    setToken(null);
    apiClient.setToken(null);
    clearSessionStorage();
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    if (!token) return;
    const expiresAt = getTokenExpiry(token);
    if (!expiresAt) return;

    const now = Date.now();
    const timeUntilExpiry = expiresAt - now;

    if (timeUntilExpiry <= 0) {
      logout();
      return;
    }

    const warningTime = timeUntilExpiry - EXPIRY_WARNING_MS;
    if (warningTime <= 0) {
      toast.warning('Your session expires in 5 minutes. Please save your work.', {
        id: 'session-expiry-warning',
      });
      return;
    }

    const timer = setTimeout(() => {
      toast.warning('Your session expires in 5 minutes. Please save your work.', {
        id: 'session-expiry-warning',
      });
    }, warningTime);
    return () => clearTimeout(timer);
  }, [token, logout]);

  useEffect(() => {
    apiClient.setOnUnauthorized(() => {
      toast.error('Session expired. Please log in again.');
      logout();
    });
    return () => apiClient.setOnUnauthorized(null);
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      organization,
      token,
      isAuthenticated: token !== null,
      login,
      logout,
      switchOrganization,
    }),
    [user, organization, token, login, logout, switchOrganization],
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
