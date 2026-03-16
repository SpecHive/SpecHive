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
  role: string | null;
  isAuthenticated: boolean;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    organizationName: string,
    inviteToken?: string,
  ) => Promise<void>;
  logout: () => void;
  switchOrganization: (organizationId: string) => Promise<void>;
  updateUser: (updates: Partial<AuthUser>) => void;
}

const STORAGE_KEYS = {
  user: 'spechive_user',
  org: 'spechive_org',
  role: 'spechive_role',
} as const;

function loadSessionState(): {
  user: AuthUser | null;
  organization: AuthOrganization | null;
  role: string | null;
} {
  try {
    const user = JSON.parse(sessionStorage.getItem(STORAGE_KEYS.user) ?? 'null') as AuthUser | null;
    const organization = JSON.parse(
      sessionStorage.getItem(STORAGE_KEYS.org) ?? 'null',
    ) as AuthOrganization | null;
    const role = sessionStorage.getItem(STORAGE_KEYS.role);

    if (!user || !organization) {
      clearSessionStorage();
      return { user: null, organization: null, role: null };
    }

    return { user, organization, role };
  } catch {
    clearSessionStorage();
    return { user: null, organization: null, role: null };
  }
}

function persistSession(user: AuthUser, organization: AuthOrganization, role: string): void {
  sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
  sessionStorage.setItem(STORAGE_KEYS.org, JSON.stringify(organization));
  sessionStorage.setItem(STORAGE_KEYS.role, role);
}

function clearSessionStorage(): void {
  sessionStorage.removeItem(STORAGE_KEYS.user);
  sessionStorage.removeItem(STORAGE_KEYS.org);
  sessionStorage.removeItem(STORAGE_KEYS.role);
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessionState] = useState(loadSessionState);
  const [user, setUser] = useState<AuthUser | null>(sessionState.user);
  const [organization, setOrganization] = useState<AuthOrganization | null>(
    sessionState.organization,
  );
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(sessionState.role);
  const [initializing, setInitializing] = useState(() => sessionState.user !== null);
  const navigate = useNavigate();

  // On mount: if we have a stored session, silently refresh the access token from the httpOnly cookie
  useEffect(() => {
    // Only runs once — sessionState.user is captured in the initializing state initializer
    let cancelled = false;
    if (sessionState.user) {
      apiClient.silentRefresh().then((newToken: string | null) => {
        if (cancelled) return;
        if (newToken) {
          setToken(newToken);
          apiClient.setToken(newToken);
        } else {
          setUser(null);
          setOrganization(null);
          setRole(null);
          clearSessionStorage();
        }
        setInitializing(false);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [sessionState.user]);

  const handleAuthSuccess = useCallback(
    (response: LoginResponse) => {
      setUser(response.user);
      setOrganization(response.organization);
      setToken(response.token);
      setRole(response.role);
      apiClient.setToken(response.token);
      persistSession(response.user, response.organization, response.role);
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
    async (
      name: string,
      email: string,
      password: string,
      organizationName: string,
      inviteToken?: string,
    ) => {
      const body = inviteToken
        ? { name, email, password, inviteToken }
        : { name, email, password, organizationName };
      const response = await apiClient.post<LoginResponse>('/v1/auth/register', body);
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

  const updateUser = useCallback((updates: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, ...updates };
      sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const logout = useCallback(() => {
    // Fire-and-forget server-side revocation (cookie sent automatically)
    apiClient.post('/v1/auth/logout', {}).catch(() => {});

    setUser(null);
    setOrganization(null);
    setToken(null);
    setRole(null);
    apiClient.setToken(null);
    clearSessionStorage();
    navigate('/login');
  }, [navigate]);

  useEffect(() => {
    apiClient.setOnTokenRefresh((newToken) => {
      setToken(newToken);
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
      role,
      isAuthenticated: token !== null,
      initializing,
      login,
      register,
      logout,
      switchOrganization,
      updateUser,
    }),
    [
      user,
      organization,
      token,
      role,
      initializing,
      login,
      register,
      logout,
      switchOrganization,
      updateUser,
    ],
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
