import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNavBar } from './BottomNavBar';

export function AppLayout() {
  return (
    <div className="flex w-full bg-background overflow-hidden" style={{ height: 'var(--app-height, 100dvh)' }}>
      <Sidebar />
      <main className="flex-1 lg:ml-0 pb-16 lg:pb-0 h-full overflow-hidden">
        <Outlet />
      </main>
      <BottomNavBar />
    </div>
  );
}
