import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  BarChart3,
  MessageSquare,
  Columns3,
  Settings,
  LogOut,
} from 'lucide-react';

const menuItems = [
  { icon: BarChart3, label: 'Dashboard', path: '/dashboard', adminOnly: true },
  { icon: MessageSquare, label: 'Conversas', path: '/conversas', adminOnly: false },
  { icon: Columns3, label: 'Kanban', path: '/kanban', adminOnly: false },
  { icon: Settings, label: 'Configurações', path: '/config', adminOnly: true },
];

export function Sidebar() {
  const { userData, role, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const filteredItems = menuItems.filter(
    (item) => !item.adminOnly || role === 'admin'
  );

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <aside className="hidden lg:block w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-4 flex items-center gap-3">
          <div className="h-10 w-auto rounded-xl overflow-hidden flex items-center justify-center">
            <img
              src="https://lhbwfbquxkutcyqazpnw.supabase.co/storage/v1/object/public/images/outro/logo-horizontal-1-scaled.webp"
              alt="Pura Em Casa"
              className="h-8 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

        </div>

        <Separator className="bg-sidebar-border" />

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {filteredItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  isActive
                    ? 'bg-primary/20 text-primary'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <Separator className="bg-sidebar-border" />

        {/* User section */}
        <div className="p-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent/50">
            <Avatar className="h-9 w-9 border-2 border-primary/20">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                {userData?.name ? getInitials(userData.name) : 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {userData?.name || 'Usuário'}
              </p>
              <p className="text-xs text-muted-foreground capitalize">
                {role || 'user'}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
