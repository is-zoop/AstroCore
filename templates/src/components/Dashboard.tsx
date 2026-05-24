import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  Box,
  Calendar,
  ChevronDown,
  Cpu,
  Database,
  Filter,
  Globe,
  LayoutDashboard,
  Layers,
  LogOut,
  MoreHorizontal,
  PanelLeft,
  PieChart,
  Search,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Table,
  TrendingUp,
  User as UserIcon,
  Users,
  Zap,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api, ApiUser, assetUrl, DashboardRecord } from '../lib/api';
import { applyBrowserBrandingWithIcon } from '../lib/browserBranding';
import DashboardAdmin from './admin/DashboardAdmin';
import UserAdmin from './admin/UserAdmin';
import DatasourceAdmin from './admin/DatasourceAdmin';
import DatasetAdmin from './admin/DatasetAdmin';
import SystemSettings from './admin/SystemSettings';
import UserSettings from './UserSettings';

interface DashboardProps {
  user: ApiUser;
  onLogout: () => void;
  onUserUpdated: (user: ApiUser) => void;
}

const ICON_MAP: Record<string, any> = {
  Zap,
  Activity,
  Box,
  Layers,
  Cpu,
  Globe,
  BarChart3,
  PieChart,
  TrendingUp,
  ShoppingBag,
  Users,
  Award,
};

export default function Dashboard({ user, onLogout, onUserUpdated }: DashboardProps) {
  const [selectedDashboard, setSelectedDashboard] = useState<DashboardRecord | null>(null);
  const [dashboardView, setDashboardView] = useState<DashboardRecord | null>(null);
  const [dashboards, setDashboards] = useState<DashboardRecord[]>([]);
  const [activeTab, setActiveTab] = useState('my');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDashboardsExpanded, setIsDashboardsExpanded] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [systemName, setSystemName] = useState('AstroCore');
  const [systemIcon, setSystemIcon] = useState('Zap');
  const [systemLogo, setSystemLogo] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<DashboardRecord[]>([]);
  const [frameKey, setFrameKey] = useState(0);

  const canManageAll = user.role === 'system_admin';
  const canManageDatasets = user.role === 'system_admin' || user.role === 'admin';

  const menuItems = useMemo(
    () => [
      { id: 'my', label: '我的看板', icon: LayoutDashboard, visible: true, hasSubmenu: true },
      { id: 'admin_db', label: '看板管理', icon: Settings, visible: canManageAll },
      { id: 'admin_dataset', label: '数据集管理', icon: Table, visible: canManageDatasets },
      { id: 'admin_ds', label: '数据连接', icon: Database, visible: canManageAll },
      { id: 'admin_users', label: '用户管理', icon: Users, visible: canManageAll },
      { id: 'admin_system', label: '系统设置', icon: ShieldAlert, visible: canManageAll },
    ],
    [canManageAll, canManageDatasets],
  );

  const CurrentIcon = ICON_MAP[systemIcon] || Zap;

  const loadDashboards = async () => {
    const list = await api.dashboards();
    setDashboards(list);
  };

  useEffect(() => {
    api.systemSettings().then((settings) => {
      setSystemName(settings.system_name || 'AstroCore');
      setSystemIcon(settings.system_icon || 'Zap');
      setSystemLogo(settings.logo_url || null);
      applyBrowserBrandingWithIcon(settings.system_name || 'AstroCore', settings.logo_url || null, settings.system_icon || 'Zap');
    });
    loadDashboards();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      api.searchDashboards(search).then(setSearchResults).catch(() => setSearchResults([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const openDashboard = async (item: DashboardRecord) => {
    setActiveTab('my');
    setSelectedDashboard(item);
    const view = await api.dashboardView(item.id);
    setDashboardView(view);
    setFrameKey((prev) => prev + 1);
    setSearch('');
    setSearchResults([]);
  };

  const onSystemUpdated = (settings: any) => {
    setSystemName(settings.system_name || 'AstroCore');
    setSystemIcon(settings.system_icon || 'Zap');
    setSystemLogo(settings.logo_url || null);
    applyBrowserBrandingWithIcon(settings.system_name || 'AstroCore', settings.logo_url || null, settings.system_icon || 'Zap');
  };

  const activeLabel = menuItems.find((item) => item.id === activeTab)?.label || '我的看板';

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      <motion.aside
        initial={false}
        animate={{ width: isSidebarCollapsed ? 72 : 320 }}
        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
        onMouseLeave={() => setIsUserMenuOpen(false)}
        className="bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm relative overflow-hidden"
      >
        <div className="p-4 flex flex-col flex-1 overflow-hidden px-2">
          <div className={cn('flex items-center mb-8 h-10', !isSidebarCollapsed ? 'justify-between px-3' : 'justify-center')}>
            {!isSidebarCollapsed ? (
              <>
                <div className="flex items-center space-x-3 overflow-hidden">
                  <div className="w-8 h-8 shrink-0 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20 overflow-hidden p-1.5">
                    {systemLogo ? (
                      <img src={assetUrl(systemLogo) || ''} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <CurrentIcon className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="whitespace-nowrap">
                    <h1 className="font-bold tracking-tight text-lg text-slate-900 leading-none">{systemName}</h1>
                    <p className="text-[10px] text-blue-600 font-mono tracking-widest uppercase mt-0.5">Data Platform</p>
                  </div>
                </div>
                <button onClick={() => setIsSidebarCollapsed(true)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400">
                  <PanelLeft className="w-5 h-5" />
                </button>
              </>
            ) : (
              <button onClick={() => setIsSidebarCollapsed(false)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100/50 text-blue-600">
                <PanelLeft className="w-5 h-5 rotate-180" />
              </button>
            )}
          </div>

          <nav className="space-y-2">
            {menuItems.filter((item) => item.visible).map((item) => (
              <div key={item.id}>
                <button
                  onClick={() => {
                    if (item.hasSubmenu) {
                      setActiveTab('my');
                      setIsDashboardsExpanded(!isDashboardsExpanded);
                      if (isSidebarCollapsed) setIsSidebarCollapsed(false);
                    } else {
                      setActiveTab(item.id);
                    }
                  }}
                  className={cn(
                    'w-full flex items-center rounded-xl transition-all group relative px-2.5 py-3',
                    activeTab === item.id ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900',
                    !isSidebarCollapsed ? 'justify-start space-x-3' : 'justify-center',
                  )}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {!isSidebarCollapsed && <span className="text-sm whitespace-nowrap">{item.label}</span>}
                  {!isSidebarCollapsed && item.hasSubmenu && <ChevronDown className={cn('ml-auto w-4 h-4 transition-transform', isDashboardsExpanded && 'rotate-180')} />}
                </button>

                <AnimatePresence>
                  {!isSidebarCollapsed && item.hasSubmenu && isDashboardsExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden bg-slate-50/50 rounded-xl mt-1 mx-1 p-1 space-y-1">
                      {dashboards.map((db) => {
                        const DBIcon = ICON_MAP[db.icon] || LayoutDashboard;
                        return (
                          <button
                            key={db.id}
                            onClick={() => openDashboard(db)}
                            className={cn(
                              'w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs transition-colors',
                              selectedDashboard?.id === db.id ? 'bg-white shadow-sm border border-slate-200 font-bold text-blue-600' : 'text-slate-500 hover:bg-white hover:text-slate-900',
                            )}
                          >
                            <DBIcon className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate pr-2">{db.name}</span>
                          </button>
                        );
                      })}
                      {dashboards.length === 0 && <p className="px-3 py-3 text-xs text-slate-400">暂无已发布看板</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </nav>
        </div>

        <div className="mt-auto p-4 border-t border-slate-100">
          <div className="relative">
            <div className={cn('flex items-center px-1.5 py-3 mb-1 overflow-hidden', !isSidebarCollapsed ? 'space-x-3' : 'justify-center')}>
              <div className="w-8 h-8 shrink-0 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-xs shadow-md">
                {user.avatar_url ? (
                  <img src={assetUrl(user.avatar_url) || ''} alt={user.username} className="w-full h-full rounded-full object-cover" />
                ) : (
                  user.username.charAt(0).toUpperCase()
                )}
              </div>
              {!isSidebarCollapsed && (
                <>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-slate-900 truncate">{user.username}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest truncate">{user.role}</p>
                  </div>
                  <button onClick={() => setIsUserMenuOpen(!isUserMenuOpen)} className="p-1 hover:bg-slate-100 rounded-lg">
                    <MoreHorizontal className="w-4 h-4 text-slate-400" />
                  </button>
                </>
              )}
            </div>

            <AnimatePresence>
              {isUserMenuOpen && !isSidebarCollapsed && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute bottom-full left-0 w-full mb-2 bg-white border border-slate-200 shadow-2xl rounded-2xl p-2 z-50">
                  <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-slate-50 text-slate-700 font-bold text-xs uppercase tracking-widest mb-1">
                    <UserIcon className="w-4 h-4 text-blue-600" />
                    <span>个人设置</span>
                  </button>
                  <button onClick={onLogout} className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl hover:bg-red-50 text-red-600 font-bold text-xs uppercase tracking-widest">
                    <LogOut className="w-4 h-4" />
                    <span>退出系统</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.aside>

      <main className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute inset-0 tech-grid pointer-events-none opacity-40" />

        <header className="h-16 border-b border-slate-200 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 z-10">
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            {activeTab === 'my' && selectedDashboard ? selectedDashboard.name : activeLabel}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                type="text"
                placeholder="搜索看板..."
                className="bg-slate-100 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs text-slate-900 focus:outline-none focus:border-blue-500 transition-all w-64 shadow-inner"
              />
              {searchResults.length > 0 && (
                <div className="absolute right-0 top-11 w-80 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 z-50">
                  {searchResults.map((item) => (
                    <button key={item.id} onClick={() => openDashboard(item)} className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50">
                      <p className="text-sm font-bold text-slate-900">{item.name}</p>
                      <p className="text-[11px] text-slate-400">{item.category || '未分类'}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button className="p-2 rounded-xl bg-slate-100 text-slate-500 border border-transparent">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className={cn('flex-1 overflow-y-auto relative', activeTab === 'my' && selectedDashboard ? 'p-4' : 'p-8')}>
          {activeTab === 'my' && !selectedDashboard && (
            <div className="h-full flex flex-col items-center justify-center space-y-6">
              <div className="w-24 h-24 rounded-[2rem] bg-white shadow-xl shadow-slate-200 flex items-center justify-center border border-slate-100">
                <LayoutDashboard className="w-10 h-10 text-blue-600" />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black text-slate-900">欢迎进入分析核心</h3>
                <p className="text-slate-400 text-sm max-w-xs mt-2">请从左侧选择一个已发布看板，加载对应的数据分析视图。</p>
              </div>
            </div>
          )}

          {activeTab === 'my' && selectedDashboard && (
            <div className="h-full min-h-[calc(100vh-6rem)]">
              <div className="hidden">
                <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold">2024-01-01 - 2024-12-31</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>
                <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-slate-200 shadow-sm">
                  <Filter className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold">筛选条件：全部</span>
                  <ChevronDown className="w-3 h-3 text-slate-400" />
                </div>
                <button onClick={() => setFrameKey((prev) => prev + 1)} className="ml-auto bg-slate-900 hover:bg-black text-white font-bold px-8 py-2.5 rounded-xl text-xs uppercase tracking-widest shadow-lg">
                  运行查询
                </button>
              </div>

              <div className="bg-white rounded-xl p-1 shadow-xl shadow-slate-200/40 border border-slate-100 relative overflow-hidden min-h-[calc(100vh-7rem)]">
                {dashboardView?.iframe_url ? (
                  <iframe
                    key={frameKey}
                    src={assetUrl(dashboardView.iframe_url) || undefined}
                    title={selectedDashboard.name}
                    className="w-full h-[calc(100vh-7.5rem)] min-h-[720px] rounded-lg border-0 bg-white"
                  />
                ) : (
                  <div className="h-[calc(100vh-7.5rem)] min-h-[720px] flex items-center justify-center text-slate-400">
                    <div className="text-center space-y-3">
                      <LayoutDashboard className="w-14 h-14 mx-auto text-slate-300" />
                      <p className="text-sm font-bold">该看板还没有上传 HTML 文件</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'admin_db' && <DashboardAdmin onChanged={loadDashboards} />}
          {activeTab === 'admin_dataset' && <DatasetAdmin />}
          {activeTab === 'admin_ds' && <DatasourceAdmin />}
          {activeTab === 'admin_users' && <UserAdmin />}
          {activeTab === 'admin_system' && (
            <SystemSettings
              systemName={systemName}
              systemIcon={systemIcon}
              systemLogo={systemLogo}
              onUpdated={onSystemUpdated}
            />
          )}
        </div>

        <AnimatePresence>
          {isSettingsOpen && <UserSettings user={user} onClose={() => setIsSettingsOpen(false)} onUserUpdated={onUserUpdated} />}
        </AnimatePresence>
      </main>
    </div>
  );
}
