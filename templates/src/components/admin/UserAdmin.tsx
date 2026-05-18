import { useEffect, useState } from 'react';
import { Edit2, Inbox, Key, Plus, Shield, Trash2, UserCheck, X } from 'lucide-react';
import { api, ApiUser, assetUrl } from '../../lib/api';
import { cn } from '../../lib/utils';

const DEFAULT_FORM = { username: '', email: '', password: 'Password123', role: 'viewer', status: 'active' };

function EmptyState() {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-3xl min-h-[280px] flex flex-col items-center justify-center text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
        <Inbox className="w-7 h-7 text-slate-300" />
      </div>
      <h3 className="text-base font-black text-slate-800">这里空空如也</h3>
      <p className="text-sm text-slate-400 mt-2">当前没有用户数据，点击右上角“创建新用户”开始添加。</p>
    </div>
  );
}

export default function UserAdmin() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editing, setEditing] = useState<ApiUser | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = async () => setUsers(await api.users());

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (user: ApiUser) => {
    setEditing(user);
    setForm({ username: user.username, email: user.email, password: '', role: user.role, status: user.status });
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setForm(DEFAULT_FORM);
    setError('');
  };

  const toggleSelectAll = () => setSelectedIds(selectedIds.length === users.length ? [] : users.map((u) => u.id));
  const toggleSelect = (id: number) => setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));

  const save = async () => {
    setError('');
    try {
      if (!form.username.trim()) throw new Error('请输入用户名');
      if (!form.email.trim()) throw new Error('请输入邮箱');
      if (editing) {
        await api.updateUser(editing.id, { email: form.email, role: form.role, status: form.status });
      } else {
        await api.createUser(form);
      }
      await load();
      closeModal();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('确认删除该用户？')) return;
    await api.deleteUser(id);
    setSelectedIds((prev) => prev.filter((item) => item !== id));
    await load();
  };

  const bulkRemove = async () => {
    if (!confirm(`确认删除选中的 ${selectedIds.length} 个用户？`)) return;
    await api.bulkDeleteUsers(selectedIds);
    setSelectedIds([]);
    await load();
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">用户管理</h2>
          <p className="text-slate-500 text-sm italic">维护系统账号、角色和激活状态。</p>
        </div>
        <div className="flex items-center space-x-3">
          {selectedIds.length > 0 && (
            <button onClick={bulkRemove} className="bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 rounded-xl font-bold flex items-center space-x-2 border border-red-100">
              <Trash2 className="w-4 h-4" />
              <span className="text-sm">删除所选 ({selectedIds.length})</span>
            </button>
          )}
          <button onClick={openCreate} className="bg-slate-900 hover:bg-black text-white px-6 py-2.5 rounded-xl font-bold flex items-center space-x-2 shadow-lg">
            <Plus className="w-4 h-4" />
            <span className="text-sm">创建新用户</span>
          </button>
        </div>
      </div>

      {users.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100">
                  <th className="px-6 py-5 w-12">
                    <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600" checked={selectedIds.length === users.length && users.length > 0} onChange={toggleSelectAll} />
                  </th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">用户名</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">邮箱</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">用户角色</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">激活状态</th>
                  <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map((u) => (
                  <tr key={u.id} className={cn('group hover:bg-slate-50/30 transition-colors', selectedIds.includes(u.id) && 'bg-blue-50/30')}>
                    <td className="px-6 py-4">
                      <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-blue-600" checked={selectedIds.includes(u.id)} onChange={() => toggleSelect(u.id)} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs overflow-hidden">
                          {u.avatar_url ? (
                            <img src={assetUrl(u.avatar_url) || ''} alt={u.username} className="w-full h-full object-cover" />
                          ) : (
                            u.username.charAt(0).toUpperCase()
                          )}
                        </div>
                        <span className="font-bold text-slate-900">{u.username}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4"><span className="text-sm font-mono text-slate-500">{u.email}</span></td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-100">
                        <Shield className="w-3 h-3" />
                        <span>{u.role}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn('inline-flex items-center space-x-2 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest', u.status === 'active' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100')}>
                        <UserCheck className="w-3 h-3" />
                        <span>{u.status === 'active' ? '已激活' : '待处理'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-2 rounded-lg text-slate-400 hover:text-blue-600" title="权限分配"><Key className="w-4 h-4" /></button>
                      <button onClick={() => openEdit(u)} className="p-2 rounded-lg text-slate-400 hover:text-blue-600 ml-1" title="编辑"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => remove(u.id)} className="p-2 rounded-lg text-slate-400 hover:text-red-500 ml-1" title="删除"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900">{editing ? '编辑用户' : '创建新用户'}</h3>
                <p className="text-xs text-slate-400 mt-1">配置用户账号、角色和激活状态。</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-full hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input disabled={Boolean(editing)} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="用户名" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 disabled:text-slate-400 disabled:cursor-not-allowed" />
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="邮箱" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              {!editing && (
                <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="初始密码" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              )}
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                <option value="system_admin">系统管理员</option>
                <option value="admin">管理员</option>
                <option value="viewer">普通用户</option>
              </select>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                <option value="active">已激活</option>
                <option value="pending">待处理</option>
              </select>
            </div>
            {error && <p className="mt-4 text-xs text-red-500">{error}</p>}
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={closeModal} className="px-5 py-3 rounded-xl bg-slate-50 text-slate-600 font-bold text-sm hover:bg-slate-100">取消</button>
              <button onClick={save} className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-black">{editing ? '保存用户' : '创建用户'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
