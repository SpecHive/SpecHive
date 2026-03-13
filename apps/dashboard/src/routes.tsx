import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { SettingsLayout } from '@/components/layout/settings-layout';
import { usePlugins } from '@/lib/plugin-registry';
import { DashboardPage } from '@/pages/dashboard';
import { LoginPage } from '@/pages/login';
import { NotFoundPage } from '@/pages/not-found';
import { RegisterPage } from '@/pages/register';
import { RunDetailPage } from '@/pages/run-detail';
import { RunsPage } from '@/pages/runs';
import { MembersPage } from '@/pages/settings/members';
import { ProfilePage } from '@/pages/settings/profile';
import { TokensPage } from '@/pages/tokens';

export function AppRoutes() {
  const plugins = usePlugins();
  const appRoutes = plugins.flatMap((p) => p.routes?.filter((r) => r.layout === 'app') ?? []);
  const settingsRoutes = plugins.flatMap(
    (p) => p.routes?.filter((r) => r.layout === 'settings') ?? [],
  );

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runs/:id" element={<RunDetailPage />} />
          <Route path="/tokens" element={<TokensPage />} />
          {appRoutes.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                <Suspense fallback={null}>
                  <route.element />
                </Suspense>
              }
            />
          ))}
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="profile" replace />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="members" element={<MembersPage />} />
            {settingsRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={
                  <Suspense fallback={null}>
                    <route.element />
                  </Suspense>
                }
              />
            ))}
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
