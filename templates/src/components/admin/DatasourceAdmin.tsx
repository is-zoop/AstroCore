import { useEffect, useState } from 'react';
import { Database, Edit2, Inbox, Plus, Radio, Trash2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

const DEFAULT_FORM = {
  name: '',
  type: 'mysql',
  host: '',
  port: 3306 as number | null,
  username: '',
  password: '',
  database: '',
  status: 'pending',
};
const PASSWORD_MASK = '********';

function EmptyState() {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-3xl min-h-[280px] flex flex-col items-center justify-center text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
        <Inbox className="w-7 h-7 text-slate-300" />
      </div>
      <h3 className="text-base font-black text-slate-800">这里空空如也</h3>
      <p className="text-sm text-slate-400 mt-2">当前没有数据连接，点击右上角“绑定新数据源”开始添加。</p>
    </div>
  );
}

export default function DatasourceAdmin() {
  const [items, setItems] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [error, setError] = useState('');
  const [testMessages, setTestMessages] = useState<Record<number, string>>({});
  const [testingId, setTestingId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = async () => setItems(await api.datasources());

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setHasSavedPassword(false);
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({
      name: item.name,
      type: item.type,
      host: item.host,
      port: item.port,
      username: item.username,
      password: item.password_preview || item.password_encrypted ? PASSWORD_MASK : '',
      database: item.database,
      status: item.status,
    });
    setHasSavedPassword(Boolean(item.password_preview || item.password_encrypted));
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setForm(DEFAULT_FORM);
    setHasSavedPassword(false);
    setError('');
  };

  const save = async () => {
    setError('');
    try {
      if (!form.name.trim() || !form.host.trim()) throw new Error('请输入连接名称和节点地址');
      const payload = editing && hasSavedPassword && form.password === PASSWORD_MASK ? { ...form, password: undefined } : form;
      if (editing) await api.updateDatasource(editing.id, payload);
      else await api.createDatasource(payload);
      await load();
      closeModal();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('确认删除该数据源？')) return;
    await api.deleteDatasource(id);
    setTestMessages((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    await load();
  };

  const test = async (id: number) => {
    setTestingId(id);
    setTestMessages((prev) => ({ ...prev, [id]: '正在测试连接...' }));
    try {
      const result: any = await api.testDatasource(id);
      setTestMessages((prev) => ({ ...prev, [id]: result.test_message || (result.status === 'online' ? '连接成功' : '连接失败') }));
      await load();
    } catch (err: any) {
      setTestMessages((prev) => ({ ...prev, [id]: err.message || '连接测试失败' }));
      await load();
    } finally {
      setTestingId(null);
    }
  };

  const statusText = (src: any) => {
    const message = testMessages[src.id];
    if (message) return message;
    if (src.status === 'online') return '连接成功';
    if (src.status === 'failed') return '连接失败';
    return '待验证';
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">数据连接</h2>
          <p className="text-slate-500 text-sm">管理外部数据源连接参数和验证状态。</p>
        </div>
        <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center space-x-2 shadow-lg shadow-blue-600/20">
          <Plus className="w-4 h-4" />
          <span className="text-sm">绑定新数据源</span>
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {items.map((src) => (
            <div key={src.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between hover:shadow-md hover:border-blue-200 transition-all group">
              <div className="flex items-center space-x-6 flex-1 min-w-0">
                <div className="flex items-center space-x-3 w-40 shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    <Database className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">数据库类型</p>
                    <p className="text-sm font-bold text-slate-900">{src.type}</p>
                  </div>
                </div>
                <div className="w-64 shrink-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">连接名称</p>
                  <p className="text-sm font-bold text-slate-900 truncate">{src.name}</p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">节点地址</p>
                  <p className="text-sm font-mono text-slate-600 truncate">{src.host}{src.port ? `:${src.port}` : ''}</p>
                </div>
                <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-slate-50 border border-slate-100 max-w-md">
                  <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', src.status === 'online' ? 'bg-emerald-500' : src.status === 'failed' ? 'bg-red-500' : 'bg-amber-500')} />
                  <span className="text-slate-500 truncate" title={statusText(src)}>{statusText(src)}</span>
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-6">
                <button disabled={testingId === src.id} onClick={() => test(src.id)} className="px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 rounded-lg flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5" />
                  {testingId === src.id ? '测试中' : '测试'}
                </button>
                <button onClick={() => openEdit(src)} className="px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" />配置</button>
                <button onClick={() => remove(src.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-3xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900">{editing ? '配置数据源' : '绑定新数据源'}</h3>
                <p className="text-xs text-slate-400 mt-1">已有密码会以掩码显示，输入新密码后保存会重新加密。</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-full hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="连接名称" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500">
                <option value="mysql">MySQL</option>
                <option value="postgresql">PostgreSQL</option>
                <option value="sqlserver">SQL Server</option>
              </select>
              <input value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} placeholder="节点地址" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              <input value={form.port || ''} onChange={(e) => setForm({ ...form, port: e.target.value ? Number(e.target.value) : null })} placeholder="端口" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="账号" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="密码" className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-blue-500" />
              <input value={form.database} onChange={(e) => setForm({ ...form, database: e.target.value })} placeholder="数据库名" className="md:col-span-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
            </div>
            {error && <p className="mt-4 text-xs text-red-500">{error}</p>}
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={closeModal} className="px-5 py-3 rounded-xl bg-slate-50 text-slate-600 font-bold text-sm hover:bg-slate-100">取消</button>
              <button onClick={save} className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-black">{editing ? '保存配置' : '绑定数据源'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
