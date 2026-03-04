import { Outlet } from 'react-router';
import { Toaster } from 'sonner';

import { Sidebar } from './sidebar';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8" role="main">
        <Outlet />
      </main>
      <Toaster position="bottom-right" />
    </div>
  );
}
