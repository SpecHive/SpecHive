import { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router';

import { usePlugins } from '@/contexts/plugin-registry';
import { LoginPage } from '@/features/auth/login-page';
import { RegisterPage } from '@/features/auth/register-page';
import { ProjectComparisonPage } from '@/features/comparison/comparison-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { ErrorExplorerPage } from '@/features/error-explorer/error-explorer-page';
import { RunDetailPage } from '@/features/run-detail/run-detail-page';
import { RunsPage } from '@/features/runs/runs-page';
import { MembersPage } from '@/features/settings/members/members-page';
import { ProfilePage } from '@/features/settings/profile/profile-page';
import { TokensPage } from '@/features/tokens/tokens-page';
import { AppLayout } from '@/layout/app-layout';
import { ProtectedRoute } from '@/layout/protected-route';
import { SettingsLayout } from '@/layout/settings-layout';
import { NotFoundPage } from '@/shared/components/not-found-page';

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
          <Route path="/comparison" element={<ProjectComparisonPage />} />
          <Route path="/tokens" element={<TokensPage />} />
          <Route path="/errors" element={<ErrorExplorerPage />} />
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
