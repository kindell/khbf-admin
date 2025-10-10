import { ReactNode } from 'react';
import { Users, Key, Activity, Settings } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary">KHBF Admin</h1>
          <p className="text-sm text-muted-foreground">Medlemshantering</p>
        </div>

        <nav className="space-y-1 px-3">
          <a
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Users className="h-4 w-4" />
            Medlemmar
          </a>
          <a
            href="/parakey-mapping"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Key className="h-4 w-4" />
            Parakey Mapping
          </a>
          <a
            href="/visits"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Activity className="h-4 w-4" />
            Besök
          </a>
          <a
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            Inställningar
          </a>
        </nav>
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
