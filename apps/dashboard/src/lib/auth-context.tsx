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
  register: (
    name: string,
    email: string,
    password: string,
    organizationName: string,
  ) => Promise<void>;
  logout: () => void;
  switchOrganization: (organizationId: string) => Promise<void>;
}

const STORAGE_KEYS = {
  token: 'assertly_token',
  refreshToken: 'assertly_refresh_token',
  user: 'assertly_user',
  org: 'assertly_org',
} as const;

function loadSessionState(): {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  organization: AuthOrganization | null;
} {
  try {
    const token = sessionStorage.getItem(STORAGE_KEYS.token);
    if (!token) return { token: null, refreshToken: null, user: null, organization: null };

    const user = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.user) ?? 'null') as AuthUser | null;
    const organization = JSON.parse(
      sessionStorage.getItem(STORAGE_KEYS.org) ?? 'null',
    ) as AuthOrganization | null;

    if (!user || !organization) {
      clearSessionStorage();
      return { token: null, refreshToken: null, user: null, organization: null };
    }

    const refreshToken = sessionStorage.getItem(STORAGE_KEYS.refreshToken);

    apiClient.setToken(token);
    apiClient.setRefreshToken(refreshToken);
    return { token, refreshToken, user, organization };
  } catch {
    clearSessionStorage();
    return { token: null, refreshToken: null, user: null, organization: null };
  }
}

function persistSession(
  token: string,
  refreshToken: string,
  user: AuthUser,
  organization: AuthOrganization,
): void {
  sessionStorage.setItem(STORAGE_KEYS.token, token);
  sessionStorage.setItem(STORAGE_KEYS.refreshToken, refreshToken);
  sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  sessionStorage.setItem(STORAGE_KEYS.org, JSON.stringify(organization));
}

function clearSessionStorage(): void {
  sessionStorage.removeItem(STORAGE_KEYS.token);
  sessionStorage.removeItem(STORAGE_KEYS.refreshToken);
  sessionStorage.removeItem(STORAGE_KEYS.user);
  sessionStorage.removeItem(STORAGE_KEYS.org);
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionState] = useState(loadSessionState);
  const [user, setUser] = useState<AuthUser | null>(sessionState.user);
  const [organization, setOrganization] = useState<AuthOrganization | null>(
    sessionState.organization,
  );
  const [token, setToken] = useState<string | null>(sessionState.token);
  const [refreshToken, setRefreshToken] = useState<string | null>(sessionState.refreshToken);
  const navigate = useNavigate();

  const handleAuthSuccess = useCallback(
    (response: LoginResponse) => {
      setUser(response.user);
      setOrganization(response.organization);
      setToken(response.token);
      setRefreshToken(response.refreshToken);
      apiClient.setToken(response.token);
      apiClient.setRefreshToken(response.refreshToken);
      persistSession(response.token, response.refreshToken, response.user, response.organization);
      navigate('/');
    },
    [navigate],
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiClient.post<LoginResponse>('/v1/auth/login', {
        email,
        password,
      });
      handleAuthSuccess(response);
    },
    [handleAuthSuccess],
  );

  const register = useCallback(
    async (name: string, email: string, password: string, organizationName: string) => {
      const response = await apiClient.post<LoginResponse>('/v1/auth/register', {
        name,
        email,
        password,
        organizationName,
      });
      handleAuthSuccess(response);
    },
    [handleAuthSuccess],
  );

  const switchOrganization = useCallback(
    async (organizationId: string) => {
      const response = await apiClient.post<LoginResponse>('/v1/auth/switch-organization', {
        organizationId,
      });
      handleAuthSuccess(response);
    },
    [handleAuthSuccess],
  );

  const logout = useCallback(() => {
    // Fire-and-forget server-side revocation
    if (refreshToken) {
      apiClient.post('/v1/auth/logout', { refreshToken }).catch(() => {});
    }

    setUser(null);
    setOrganization(null);
    setToken(null);
    setRefreshToken(null);
    apiClient.setToken(null);
    apiClient.setRefreshToken(null);
    clearSessionStorage();
    navigate('/login');
  }, [navigate, refreshToken]);

  // Persist tokens after silent refresh
  useEffect(() => {
    apiClient.setOnTokenRefresh((newToken, newRefreshToken) => {
      setToken(newToken);
      setRefreshToken(newRefreshToken);
      sessionStorage.setItem(STORAGE_KEYS.token, newToken);
      sessionStorage.setItem(STORAGE_KEYS.refreshToken, newRefreshToken);
    });
    return () => apiClient.setOnTokenRefresh(null);
  }, []);

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
      register,
      logout,
      switchOrganization,
    }),
    [user, organization, token, login, register, logout, switchOrganization],
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
