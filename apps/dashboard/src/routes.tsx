import { Route, Routes } from 'react-router';

import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute } from '@/components/layout/protected-route';
import { DashboardPage } from '@/pages/dashboard';
import { LoginPage } from '@/pages/login';
import { NotFoundPage } from '@/pages/not-found';
import { RunDetailPage } from '@/pages/run-detail';
import { RunsPage } from '@/pages/runs';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/runs/:id" element={<RunDetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
