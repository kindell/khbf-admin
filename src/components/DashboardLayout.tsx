import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { Users, Key, Activity, Settings, MessageSquare, LogOut } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  userName?: string;
  onLogout?: () => void;
}

export function DashboardLayout({ children, userName, onLogout }: DashboardLayoutProps) {
  const location = useLocation();

  function isActive(path: string) {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary">KHBF Admin</h1>
          <p className="text-sm text-muted-foreground">Medlemshantering</p>
        </div>

        <nav className="space-y-1 px-3 flex-1">
          <a
            href="/"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/') && !isActive('/sms')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            Medlemmar
          </a>
          <a
            href="/sms"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/sms')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            SMS Inbox
          </a>
          <a
            href="/parakey-mapping"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/parakey-mapping')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Key className="h-4 w-4" />
            Parakey Mapping
          </a>
          <a
            href="/visits"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/visits')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Activity className="h-4 w-4" />
            Besök
          </a>
          <a
            href="/settings"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/settings')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Settings className="h-4 w-4" />
            Inställningar
          </a>
        </nav>

        {/* User info and logout */}
        {userName && onLogout && (
          <div className="p-4 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-medium text-primary">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm font-medium truncate">{userName}</span>
              </div>
              <button
                onClick={onLogout}
                className="p-2 hover:bg-accent rounded-lg transition-colors flex-shrink-0"
                title="Logga ut"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 max-w-7xl">
          {children}
        </div>
      </main>
    </div>
  );
}
