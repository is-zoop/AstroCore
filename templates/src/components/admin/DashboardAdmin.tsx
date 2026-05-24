import { useEffect, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  Box,
  Check,
  Clock,
  Edit2,
  FileUp,
  Globe,
  Inbox,
  Layers,
  PieChart,
  Plus,
  Search,
  ShoppingBag,
  Table as TableIcon,
  Trash2,
  TrendingUp,
  User as UserIcon,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { api, DashboardRecord } from '../../lib/api';
import { cn } from '../../lib/utils';
import SoftMultiSelect from './SoftMultiSelect';

const DEFAULT_FORM = { name: '', description: '', dataset_ids: [] as number[], status: 'draft' };

const DASHBOARD_ICONS = [
  { id: 'BarChart3', icon: BarChart3 },
  { id: 'PieChart', icon: PieChart },
  { id: 'TrendingUp', icon: TrendingUp },
  { id: 'Activity', icon: Activity },
  { id: 'ShoppingBag', icon: ShoppingBag },
  { id: 'Users', icon: Users },
  { id: 'Globe', icon: Globe },
  { id: 'Zap', icon: Zap },
  { id: 'Award', icon: Award },
  { id: 'Box', icon: Box },
  { id: 'Layers', icon: Layers },
];

function EmptyState() {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-3xl min-h-[280px] flex flex-col items-center justify-center text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
        <Inbox className="w-7 h-7 text-slate-300" />
      </div>
      <h3 className="text-base font-black text-slate-800">这里空空如也</h3>
      <p className="text-sm text-slate-400 mt-2">当前没有看板数据，点击右上角“新建看板”开始添加。</p>
    </div>
  );
}

function getIcon(iconId?: string) {
  return DASHBOARD_ICONS.find((item) => item.id === iconId)?.icon || BarChart3;
}

export default function DashboardAdmin({ onChanged }: { onChanged?: () => void }) {
  const [items, setItems] = useState<DashboardRecord[]>([]);
  const [datasets, setDatasets] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<DashboardRecord | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [iconTarget, setIconTarget] = useState<DashboardRecord | null>(null);
  const [selectedIcon, setSelectedIcon] = useState('BarChart3');

  const load = async () => {
    setItems(await api.dashboards(query));
    try {
      setDatasets(await api.datasets());
    } catch {
      setDatasets([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (item: DashboardRecord) => {
    setEditing(item);
    setForm({
      name: item.name,
      description: item.description || '',
      dataset_ids: item.dataset_ids?.length ? item.dataset_ids : (item.dataset_id ? [item.dataset_id] : []),
      status: item.status || 'draft',
    });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setForm(DEFAULT_FORM);
    setError('');
  };

  const save = async () => {
    setError('');
    try {
      if (!form.name.trim()) throw new Error('请输入看板名称');
      if (form.dataset_ids.length === 0) throw new Error('请选择绑定数据集');
      const payload = {
        ...form,
        dataset_id: form.dataset_ids[0],
        category: editing?.category || '',
        icon: editing?.icon || 'BarChart3',
      };
      if (editing) await api.updateDashboard(editing.id, payload);
      else await api.createDashboard(payload);
      await load();
      onChanged?.();
      closeModal();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('确认删除该看板？')) return;
    await api.deleteDashboard(id);
    await load();
    onChanged?.();
  };

  const upload = async (id: number, file?: File) => {
    if (!file) return;
    setError('');
    setNotice(null);
    try {
      await api.uploadDashboardFile(id, file);
      await load();
      onChanged?.();
      const noticeId = Date.now();
      setNotice({ id: noticeId, text: 'HTML 文件上传完成' });
      window.setTimeout(() => {
        setNotice((current) => (current?.id === noticeId ? null : current));
      }, 3000);
    } catch (err: any) {
      setError(err.message || '上传失败');
    }
  };

  const openIconPicker = (item: DashboardRecord) => {
    setIconTarget(item);
    setSelectedIcon(item.icon || 'BarChart3');
  };

  const saveIcon = async () => {
    if (!iconTarget) return;
    await api.updateDashboard(iconTarget.id, {
      name: iconTarget.name,
      description: iconTarget.description || '',
      category: iconTarget.category || '',
      dataset_ids: iconTarget.dataset_ids?.length ? iconTarget.dataset_ids : (iconTarget.dataset_id ? [iconTarget.dataset_id] : []),
      dataset_id: iconTarget.dataset_id || null,
      status: iconTarget.status || 'draft',
      icon: selectedIcon,
    });
    setIconTarget(null);
    await load();
    onChanged?.();
  };

  const togglePublish = async (item: DashboardRecord) => {
    setError('');
    try {
      await api.updateDashboard(item.id, {
        name: item.name,
        description: item.description || '',
        category: item.category || '',
        dataset_ids: item.dataset_ids?.length ? item.dataset_ids : (item.dataset_id ? [item.dataset_id] : []),
        dataset_id: item.dataset_id || null,
        status: item.status === 'published' ? 'offline' : 'published',
        icon: item.icon || 'BarChart3',
      });
      await load();
      onChanged?.();
    } catch (err: any) {
      setError(err.message || '状态更新失败');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">看板管理</h2>
          <p className="text-slate-500 text-sm">配置数据可视化看板、发布状态和 HTML 展示文件。</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="搜索看板..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
          </div>
          <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center space-x-2 shadow-lg shadow-blue-600/20">
            <Plus className="w-4 h-4" />
            <span className="text-sm">新建看板</span>
          </button>
        </div>
      </div>

      {notice && (
        <div key={notice.id} className="fixed left-1/2 top-24 z-[140] -translate-x-1/2 flex items-center gap-2 rounded-2xl border border-emerald-100 bg-white px-4 py-3 text-sm font-bold text-emerald-700 shadow-2xl shadow-slate-900/10 animate-in fade-in slide-in-from-top-2 duration-300">
          <span className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center">
            <Check className="w-4 h-4" />
          </span>
          <span>{notice.text}</span>
        </div>
      )}

      {error && !isModalOpen && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {items.map((db) => {
            const Icon = getIcon(db.icon);
            return (
              <div key={db.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between hover:shadow-md hover:border-blue-200 transition-all group">
                <div className="flex items-center space-x-8 flex-1 min-w-0">
                  <div className="flex items-center space-x-4 w-72 shrink-0">
                    <button onClick={() => openIconPicker(db)} title="修改图标" className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center hover:bg-blue-50 hover:border-blue-100 transition-colors">
                      <Icon className="w-5 h-5 text-blue-600" />
                    </button>
                    <div className="overflow-hidden">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">看板名称</p>
                      <p className="text-sm font-bold text-slate-900 truncate">{db.name}</p>
                    </div>
                  </div>
                  <div className="w-56 shrink-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">绑定数据集</p>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <TableIcon className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-sm text-slate-600 truncate">{db.dataset || '未绑定'}</span>
                    </div>
                  </div>
                  <div className="w-28 shrink-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">发布状态</p>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-50 border border-slate-100 text-slate-600">
                      {db.status === 'published' ? <Check className="w-3 h-3 text-emerald-500" /> : <Clock className="w-3 h-3 text-amber-500" />}
                      {db.status === 'published' ? '已发布' : db.status === 'offline' ? '下架' : '草稿'}
                    </span>
                  </div>
                  <div className="w-28 shrink-0">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">所属人</p>
                    <div className="flex items-center space-x-2 mt-0.5">
                      <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-sm text-slate-700">{db.owner}</span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{db.file_url ? '已上传 HTML 文件' : '未上传文件'}</p>
                </div>
                <div className="flex items-center space-x-2 ml-6">
                  <label className="px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg cursor-pointer flex items-center gap-1.5">
                    <FileUp className="w-3.5 h-3.5" />
                    上传
                    <input type="file" accept=".html,.htm" className="hidden" onChange={(e) => upload(db.id, e.target.files?.[0])} />
                  </label>
                  <button onClick={() => openEdit(db)} className="px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1.5">
                    <Edit2 className="w-3.5 h-3.5" />
                    编辑
                  </button>
                  <button onClick={() => togglePublish(db)} className={cn('px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5', db.status === 'published' ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50')}>
                    {db.status === 'published' ? <Clock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    {db.status === 'published' ? '下架' : '发布'}
                  </button>
                  <button onClick={() => remove(db.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900">{editing ? '编辑看板' : '新建看板'}</h3>
                <p className="text-xs text-slate-400 mt-1">填写看板名称、绑定数据集和看板描述。</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-full hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="看板名称" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              <SoftMultiSelect
                values={form.dataset_ids.map(String)}
                placeholder="请选择数据集"
                emptyText="暂无可选数据集"
                options={datasets.map((ds) => ({ value: String(ds.id), label: ds.name }))}
                onChange={(values) => setForm({ ...form, dataset_ids: values.map(Number) })}
              />
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="看板描述"
                className="md:col-span-2 min-h-32 resize-none bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm leading-6 focus:outline-none focus:border-blue-500"
              />
            </div>
            {error && <p className="mt-4 text-xs text-red-500">{error}</p>}
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={closeModal} className="px-5 py-3 rounded-xl bg-slate-50 text-slate-600 font-bold text-sm hover:bg-slate-100">取消</button>
              <button onClick={save} className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-black">{editing ? '保存修改' : '创建看板'}</button>
            </div>
          </div>
        </div>
      )}

      {iconTarget && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIconTarget(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-md">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-slate-900">选择看板图标</h3>
              <button onClick={() => setIconTarget(null)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {DASHBOARD_ICONS.map((item) => {
                const Icon = item.icon;
                const isSelected = selectedIcon === item.id;
                return (
                  <button key={item.id} onClick={() => setSelectedIcon(item.id)} className={cn('w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all', isSelected ? 'bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-white hover:border-slate-200')}>
                    <Icon className="w-6 h-6" />
                  </button>
                );
              })}
            </div>
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={() => setIconTarget(null)} className="px-5 py-3 rounded-xl bg-slate-50 text-slate-600 font-bold text-sm hover:bg-slate-100">取消</button>
              <button onClick={saveIcon} className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-black">确认修改</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
