import { motion } from 'motion/react';
import { 
  LayoutDashboard, 
  Database, 
  Users, 
  ChevronRight, 
  Home,
  LogOut,
  Bell
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

interface AdminLayoutProps {
  user: any;
  onLogout: () => void;
}

export default function AdminLayout({ user, onLogout }: AdminLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { name: 'Dashboards', path: '/admin/dashboards', icon: LayoutDashboard },
    { name: 'Data Sources', path: '/admin/datasources', icon: Database },
    { name: 'User Management', path: '/admin/users', icon: Users },
  ];

  return (
    <div className="flex min-h-screen bg-[#020205] text-slate-200 font-sans">
      {/* Sidebar */}
      <aside className="w-72 border-r border-white/5 bg-black/40 backdrop-blur-xl flex flex-col z-20">
        <div className="p-8">
          <div className="flex items-center space-x-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Database className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold tracking-tight text-xl">ADMIN_CORE</h1>
              <p className="text-[10px] text-indigo-400 font-mono tracking-[0.2em] uppercase">Control Unit</p>
            </div>
          </div>

          <nav className="space-y-2">
            {menuItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                  location.pathname === item.path 
                    ? "bg-indigo-500/10 text-white border border-indigo-500/20 shadow-[0_0_20px_rgba(99,102,241,0.1)]" 
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className={cn("w-5 h-5", location.pathname === item.path ? "text-indigo-400" : "group-hover:text-slate-300")} />
                <span className="font-medium">{item.name}</span>
                {location.pathname === item.path && <ChevronRight className="w-4 h-4 ml-auto text-indigo-500" />}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-8 space-y-4">
          <button 
            onClick={() => navigate('/')}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-white/5 text-slate-400 transition-all border border-transparent hover:border-white/5"
          >
            <Home className="w-5 h-5" />
            <span className="font-medium">Exit Admin</span>
          </button>
          <button 
           onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-red-400 transition-all border border-transparent hover:border-red-500/10"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <div className="absolute inset-0 tech-grid opacity-10 pointer-events-none" />
        
        <header className="h-20 border-b border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between px-10 z-10">
          <div className="flex items-center space-x-2 text-sm">
             <span className="text-slate-500">ROOT</span>
             <ChevronRight className="w-4 h-4 text-slate-700" />
             <span className="text-indigo-400 font-mono uppercase tracking-widest">{location.pathname.split('/').pop()}</span>
          </div>

          <div className="flex items-center space-x-6">
            <button className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
              <Bell className="w-5 h-5 text-slate-400" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-indigo-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
            </button>
            <div className="flex items-center space-x-3 bg-white/5 px-4 py-2 rounded-xl border border-white/5">
              <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center font-bold text-xs">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-bold leading-none">{user.username}</p>
                <p className="text-[10px] text-slate-500 font-mono">SUPERUSER</p>
              </div>
            </div>
          </div>
        </header>

        <section className="flex-1 p-10 overflow-y-auto relative z-0">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
