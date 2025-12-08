import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { logout, getCurrentUser } from '@/lib/auth';
import { toast } from 'sonner';
import {

  Menu,
  X,
  LogOut,
  User as UserIcon,
  Download,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  sidebarItems: {
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    active: boolean;
  }[];
  headerContent?: React.ReactNode;
  title: string;
  user?: { name: string; role: string; email?: string };
}

/**
 * DashboardLayout Component
 * Provides consistent layout for all dashboard pages with sidebar navigation
 * Features: responsive sidebar, user menu, logout functionality
 */
export const DashboardLayout = ({ children, sidebarItems, title, headerContent, user: propUser }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
  const user = propUser || currentUser;

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-none h-16 border-b bg-card shadow-sm z-40">
        <div className="flex h-full items-center gap-4 px-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <div className="flex items-center gap-2 flex-shrink-0">
            <img src="/favicon%20dark.ico" alt="Logo" className="h-6 w-6" />
            <span className="font-semibold text-sm whitespace-nowrap">Edu Online</span>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {headerContent}
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar */}
        <aside
          className={`
            absolute lg:static top-0 left-0 z-30 h-full
            w-64 border-r bg-card transition-transform duration-300 flex flex-col
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          {/* Navigation Items (Scrollable) */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {sidebarItems.map((item, index) => (
              <button
                key={index}
                onClick={() => {
                  item.onClick();
                  setSidebarOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg
                  transition-smooth text-left
                  ${item.active
                    ? 'bg-primary text-primary-foreground shadow-md'
                    : 'hover:bg-muted'
                  }
                `}
              >
                {item.icon}
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </nav>

          {/* User Account Info (Fixed at Bottom) */}
          <div className="p-4 border-t bg-card/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <UserIcon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate capitalize">{user?.role}</p>
              </div>
            </div>
            {deferredPrompt && (
              <Button variant="outline" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground mb-2" onClick={handleInstallClick}>
                <Download className="h-4 w-4 mr-2" />
                Install App
              </Button>
            )}
            <Button variant="outline" size="sm" className="w-full justify-start text-muted-foreground hover:text-foreground" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 w-full overflow-y-auto bg-background p-4 sm:p-6 lg:p-8">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
          </div>
          <div className="w-full min-h-full flex flex-col">{children}</div>
        </main>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-20 bg-background/80 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </div>
    </div>
  );
};
