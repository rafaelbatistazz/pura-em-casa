import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { BarChart3, MessageSquare, Columns3, Settings } from 'lucide-react';

const menuItems = [
  { icon: BarChart3, label: 'Dashboard', path: '/dashboard', adminOnly: true },
  { icon: MessageSquare, label: 'Conversas', path: '/conversas', adminOnly: false },
  { icon: Columns3, label: 'Kanban', path: '/kanban', adminOnly: false },
  { icon: Settings, label: 'Config', path: '/config', adminOnly: false },
];

export function BottomNavBar() {
  const { role } = useAuth();

  const filteredItems = menuItems.filter(
    (item) => !item.adminOnly || role === 'admin'
  );

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {filteredItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-1 flex-1 h-full py-2 touch-manipulation transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
