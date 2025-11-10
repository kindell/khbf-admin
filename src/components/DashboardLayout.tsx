import { type ReactNode } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Users, Key, Activity, Settings, MessageSquare, LogOut, UsersRound, ScrollText, FileText, ShieldAlert, Bot } from 'lucide-react';
import { MobileHeader } from './layout/MobileHeader';
import { useSidebar } from '../contexts/SidebarContext';

interface DashboardLayoutProps {
  children: ReactNode;
  userName?: string;
  onLogout?: () => void;
  title?: string;
}

export function DashboardLayout({ children, userName, onLogout, title = 'KHBF Admin' }: DashboardLayoutProps) {
  const location = useLocation();
  const { sidebarOpen, openSidebar, closeSidebar } = useSidebar();

  function isActive(path: string) {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-background">
      {/* Mobile Header (only on pages with title) */}
      <MobileHeader title={title} onMenuClick={openSidebar} />

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/30 z-[150] transition-opacity"
          onClick={closeSidebar}
          aria-label="Stäng meny"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 border-r bg-card flex flex-col
        fixed lg:static
        inset-y-0 left-0
        z-[200]
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary">KHBF Admin</h1>
          <p className="text-sm text-muted-foreground">Medlemshantering</p>
        </div>

        <nav className="space-y-1 px-3 flex-1">
          <Link
            to="/ai-chat"
            onClick={(e) => {
              // Don't navigate if already on AI Chat - preserve query params
              if (location.pathname === '/ai-chat') {
                e.preventDefault();
              }
              closeSidebar();
            }}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/ai-chat')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Bot className="h-4 w-4" />
            AI Chat
          </Link>
          <Link
            to="/members"
            onClick={closeSidebar}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/members')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Users className="h-4 w-4" />
            Medlemmar
          </Link>
          <Link
            to="/messages"
            onClick={closeSidebar}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/messages') && !isActive('/messages/groups')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            Meddelanden
          </Link>
          <Link
            to="/messages/groups"
            onClick={closeSidebar}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ml-4 ${
              isActive('/messages/groups')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <UsersRound className="h-4 w-4" />
            Grupper
          </Link>
          <Link
            to="/messages/templates"
            onClick={closeSidebar}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ml-4 ${
              isActive('/messages/templates')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <FileText className="h-4 w-4" />
            Mallar
          </Link>
          <Link
            to="/messages/logs"
            onClick={closeSidebar}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ml-4 ${
              isActive('/messages/logs')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <ScrollText className="h-4 w-4" />
            Loggar
          </Link>
          <Link
            to="/parakey-mapping"
            onClick={closeSidebar}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/parakey-mapping')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Key className="h-4 w-4" />
            Parakey Mapping
          </Link>
          <Link
            to="/aptus"
            onClick={closeSidebar}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/aptus')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            Aptus
          </Link>
          <Link
            to="/visits"
            onClick={closeSidebar}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/visits')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Activity className="h-4 w-4" />
            Besök
          </Link>
          <Link
            to="/settings"
            onClick={closeSidebar}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive('/settings')
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <Settings className="h-4 w-4" />
            Inställningar
          </Link>
        </nav>

        {/* User info and logout */}
        {userName && onLogout && (
          <div className="min-h-[72px] p-4 border-t flex items-center flex-shrink-0">
            <div className="flex items-center justify-between w-full">
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
