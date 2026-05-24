import { useEffect, useState } from 'react';
import { Calendar, Edit2, Eye, Inbox, Plus, Search, Table, Trash2, User as UserIcon, X } from 'lucide-react';
import { api } from '../../lib/api';
import SoftSelect from './SoftSelect';
import SqlEditor from './SqlEditor';

const DEFAULT_FORM = { name: '', datasource_id: null as number | null, sql: 'SELECT 1 AS value' };

function EmptyState() {
  return (
    <div className="bg-white border border-dashed border-slate-200 rounded-3xl min-h-[280px] flex flex-col items-center justify-center text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
        <Inbox className="w-7 h-7 text-slate-300" />
      </div>
      <h3 className="text-base font-black text-slate-800">这里空空如也</h3>
      <p className="text-sm text-slate-400 mt-2">当前没有数据集，点击右上角“创建数据集”开始添加。</p>
    </div>
  );
}

export default function DatasetAdmin() {
  const [items, setItems] = useState<any[]>([]);
  const [sources, setSources] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [tableUpload, setTableUpload] = useState<{ temp_id: string; filename: string; sheets: string[] } | null>(null);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const load = async () => {
    setItems(await api.datasets(query));
    try {
      setSources(await api.datasources());
    } catch {
      setSources([]);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setTableUpload(null);
    setSelectedSheet('');
    setError('');
    setIsModalOpen(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm({ name: item.name, datasource_id: item.datasource_id || null, sql: item.sql || '' });
    setTableUpload(null);
    setSelectedSheet(item.table_sheet_name || '');
    setError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditing(null);
    setForm(DEFAULT_FORM);
    setTableUpload(null);
    setSelectedSheet('');
    setError('');
  };

  const save = async () => {
    setError('');
    try {
      if (!form.name.trim()) throw new Error('请输入数据集名称');
      if (!form.datasource_id) throw new Error('请选择绑定数据源');
      const source = sources.find((item) => item.id === form.datasource_id);
      if (source?.type === 'table') {
        if (editing) {
          if (tableUpload) {
            if (!selectedSheet) throw new Error('请选择一个 Sheet');
            await api.updateTableDataset(editing.id, {
              name: form.name,
              datasource_id: form.datasource_id,
              temp_id: tableUpload.temp_id,
              sheet_name: selectedSheet,
            });
          } else {
            await api.updateDataset(editing.id, form);
          }
        } else {
          if (!tableUpload) throw new Error('请先导入表格文件');
          if (!selectedSheet) throw new Error('请选择一个 Sheet');
          await api.createTableDataset({
            name: form.name,
            datasource_id: form.datasource_id,
            temp_id: tableUpload.temp_id,
            sheet_name: selectedSheet,
          });
        }
      } else if (editing) await api.updateDataset(editing.id, form);
      else await api.createDataset(form);
      await load();
      closeModal();
    } catch (err: any) {
      setError(err.message === 'Failed to fetch' ? '后端连接中断或服务未响应，请查看后端日志并重启服务后重试' : err.message);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('确认删除该数据集？')) return;
    await api.deleteDataset(id);
    await load();
  };

  const runPreview = async (id: number) => {
    try {
      setPreview(await api.previewDataset(id));
    } catch (err: any) {
      setPreview({ error: err.message, columns: [], rows: [] });
    }
  };

  const selectedSource = sources.find((item) => item.id === form.datasource_id);
  const isTableSource = selectedSource?.type === 'table';
  const isEditingTableDataset = Boolean(editing?.table_name);

  const uploadTableFile = async (file?: File) => {
    if (!file) return;
    setError('');
    try {
      const result = await api.uploadTableFileSheets(file);
      setTableUpload(result);
      setSelectedSheet(result.sheets[0] || '');
    } catch (err: any) {
      const message = err.message === 'Not Found' ? '后端尚未加载表格导入接口，请重启后端服务后再试' : err.message;
      setError(message || '表格导入失败');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900">数据集管理</h2>
          <p className="text-slate-500 text-sm">维护 SQL 查询逻辑，并预览前 100 行数据。</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="搜索数据集..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center space-x-2 shadow-lg shadow-blue-600/20">
            <Plus className="w-4 h-4" />
            <span className="text-sm">创建数据集</span>
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {items.map((ds) => (
            <div key={ds.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between hover:shadow-md hover:border-blue-200 transition-all group">
              <div className="flex items-center space-x-8 flex-1 min-w-0">
                <div className="flex items-center space-x-4 w-72 shrink-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                    <Table className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">数据集名称</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{ds.name}</p>
                  </div>
                </div>
                <div className="w-36 shrink-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">所属人</p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-sm text-slate-700">{ds.owner}</span>
                  </div>
                </div>
                <div className="w-44 shrink-0">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">创建时间</p>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-xs font-mono text-slate-500">{ds.created_at}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2 ml-6">
                <button onClick={() => openEdit(ds)} className="px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1.5"><Edit2 className="w-3.5 h-3.5" />编辑</button>
                <button onClick={() => runPreview(ds.id)} className="px-3 py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg flex items-center gap-1.5"><Eye className="w-3.5 h-3.5" />预览</button>
                <button onClick={() => remove(ds.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeModal} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl p-8 w-full max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900">{editing ? '编辑数据集' : '创建数据集'}</h3>
                <p className="text-xs text-slate-400 mt-1">配置数据来源和 SQL 查询逻辑。</p>
              </div>
              <button onClick={closeModal} className="p-2 rounded-full hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="数据集名称" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500" />
              <SoftSelect
                value={form.datasource_id ? String(form.datasource_id) : ''}
                placeholder="请选择数据源"
                emptyText="暂无可选数据源"
                options={sources.map((src) => ({ value: String(src.id), label: src.type === 'table' ? `${src.name}（表格）` : src.name }))}
                onChange={(value) => {
                  if (isEditingTableDataset) return;
                  setForm({ ...form, datasource_id: Number(value) });
                  setTableUpload(null);
                  setSelectedSheet('');
                }}
              />
              {isEditingTableDataset ? (
                <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-800">表格数据集</p>
                      <p className="mt-1 text-xs text-slate-400">可重新导入 xlsx、xls、csv，并选择一个 Sheet 覆盖当前表格数据。</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-600 shadow-sm ring-1 ring-slate-200 hover:bg-blue-50">
                      重新选择文件
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => uploadTableFile(event.target.files?.[0])} />
                    </label>
                  </div>
                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">文件</p>
                      <p className="mt-1 truncate text-sm font-bold text-slate-700" title={tableUpload?.filename || editing?.table_file_name}>{tableUpload?.filename || editing?.table_file_name || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-white px-4 py-3 ring-1 ring-slate-200">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sheet</p>
                      {tableUpload ? (
                        <SoftSelect
                          value={selectedSheet}
                          placeholder="请选择 Sheet"
                          emptyText="暂无 Sheet"
                          options={tableUpload.sheets.map((sheet) => ({ value: sheet, label: sheet }))}
                          onChange={setSelectedSheet}
                        />
                      ) : (
                        <p className="mt-1 truncate text-sm font-bold text-slate-700" title={editing?.table_sheet_name}>{editing?.table_sheet_name || '-'}</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : isTableSource && !editing ? (
                <div className="md:col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-800">导入表格文件</p>
                      <p className="mt-1 text-xs text-slate-400">支持 xlsx、xls、csv。Excel 文件只能选择一个 Sheet 导入。</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-600 shadow-sm ring-1 ring-slate-200 hover:bg-blue-50">
                      选择文件
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => uploadTableFile(event.target.files?.[0])} />
                    </label>
                  </div>
                  {tableUpload && (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_260px]">
                      <div className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200">
                        {tableUpload.filename}
                      </div>
                      <SoftSelect
                        value={selectedSheet}
                        placeholder="请选择 Sheet"
                        emptyText="暂无 Sheet"
                        options={tableUpload.sheets.map((sheet) => ({ value: sheet, label: sheet }))}
                        onChange={setSelectedSheet}
                      />
                    </div>
                  )}
                </div>
              ) : (
                <SqlEditor value={form.sql} onChange={(sql) => setForm({ ...form, sql })} />
              )}
            </div>
            {error && <p className="mt-4 text-xs text-red-500">{error}</p>}
            <div className="mt-8 flex justify-end gap-3">
              <button onClick={closeModal} className="px-5 py-3 rounded-xl bg-slate-50 text-slate-600 font-bold text-sm hover:bg-slate-100">取消</button>
              <button onClick={save} className="px-6 py-3 rounded-xl bg-slate-900 text-white font-bold text-sm hover:bg-black">{editing ? '保存修改' : '创建数据集'}</button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setPreview(null)} />
          <div className="relative bg-white rounded-[2rem] shadow-2xl p-6 w-[92vw] max-w-6xl max-h-[82vh] overflow-hidden flex flex-col">
            <div className="shrink-0 flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-900">数据预览</h3>
              <button onClick={() => setPreview(null)} className="p-2 rounded-full hover:bg-slate-100 text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            {preview.error ? (
              <p className="text-sm text-red-500">{preview.error}</p>
            ) : preview.rows.length === 0 ? (
              <div className="min-h-40 flex flex-col items-center justify-center text-center">
                <Inbox className="w-8 h-8 text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-700">暂无可预览数据</p>
                <p className="text-xs text-slate-400 mt-1">{preview.message || 'SQL 执行成功，但没有返回数据。'}</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto border border-slate-200 rounded-2xl bg-white">
                <table className="min-w-max table-fixed border-collapse text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-50">
                    <tr>
                      {preview.columns.map((col: string) => (
                        <th key={col} title={col} className="w-44 max-w-44 text-left px-4 py-3 border-b border-slate-200 font-black text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row: any, index: number) => (
                      <tr key={index} className="hover:bg-blue-50/30">
                        {preview.columns.map((col: string) => {
                          const value = row[col] == null ? '' : String(row[col]);
                          return (
                            <td key={col} title={value} className="w-44 max-w-44 px-4 py-3 border-b border-slate-100 text-slate-700 whitespace-nowrap overflow-hidden text-ellipsis">
                              {value}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
