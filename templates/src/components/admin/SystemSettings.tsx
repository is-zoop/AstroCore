import React, { useState } from 'react';
import { Activity, Box, Check, Cpu, Globe, Image as ImageIcon, Layers, Save, Type, Zap } from 'lucide-react';
import { api, assetUrl } from '../../lib/api';
import { cn } from '../../lib/utils';

interface SystemSettingsProps {
  systemName: string;
  systemIcon: string;
  systemLogo: string | null;
  onUpdated: (settings: any) => void;
}

const ICON_OPTIONS = [
  { id: 'Zap', icon: Zap, label: '闪电' },
  { id: 'Activity', icon: Activity, label: '活动' },
  { id: 'Box', icon: Box, label: '盒子' },
  { id: 'Layers', icon: Layers, label: '层级' },
  { id: 'Cpu', icon: Cpu, label: '计算' },
  { id: 'Globe', icon: Globe, label: '全球' },
];

export default function SystemSettings({ systemName, systemIcon, systemLogo, onUpdated }: SystemSettingsProps) {
  const [tempName, setTempName] = useState(systemName);
  const [tempIcon, setTempIcon] = useState(systemIcon || 'Zap');
  const [logo, setLogo] = useState(systemLogo);
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = async () => {
    const settings = await api.updateSystemSettings({ system_name: tempName, system_icon: tempIcon });
    onUpdated(settings);
    setIsSaved(true);
    window.setTimeout(() => setIsSaved(false), 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const settings = await api.uploadLogo(file);
    setLogo(settings.logo_url);
    setTempIcon(settings.system_icon || '');
    onUpdated(settings);
  };

  const removeLogo = async () => {
    const settings = await api.deleteLogo();
    setLogo(null);
    setTempIcon(settings.system_icon || 'Zap');
    onUpdated(settings);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="text-2xl font-black tracking-tight text-slate-900">系统设置</h2>
        <p className="text-slate-500 text-sm">自定义平台的名称、图标和 Logo。</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center"><Type className="w-5 h-5 text-blue-600" /></div>
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">系统名称</h3>
            </div>
            <input value={tempName} onChange={(e) => setTempName(e.target.value)} placeholder="AstroCore" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-lg font-bold text-slate-900 focus:outline-none focus:border-blue-500 shadow-inner" />
          </div>

          <div className="bg-white border border-slate-200 rounded-[2rem] p-8 shadow-sm">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center"><ImageIcon className="w-5 h-5 text-indigo-600" /></div>
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-sm">系统图标 / Logo</h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
              {ICON_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = tempIcon === opt.id && !logo;
                return (
                  <button key={opt.id} onClick={() => { setTempIcon(opt.id); setLogo(null); }} className={cn('flex flex-col items-center space-y-2 p-4 rounded-2xl border transition-all', isSelected ? 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-600/20' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-200')}>
                    <Icon className={cn('w-6 h-6', isSelected ? 'text-white' : 'text-slate-400')} />
                    <span className={cn('text-[10px] font-bold uppercase tracking-widest', isSelected ? 'text-blue-100' : 'text-slate-400')}>{opt.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="h-px bg-slate-100 my-6" />
            <div className="flex items-center space-x-6">
              <div className="relative">
                <div className={cn('w-16 h-16 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden', logo ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50')}>
                  {logo ? <img src={assetUrl(logo) || ''} alt="Logo" className="w-full h-full object-cover" /> : <ImageIcon className="w-6 h-6 text-slate-300" />}
                  <input type="file" accept="image/*,.svg" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-slate-900">上传自定义 Logo</p>
                <p className="text-[11px] text-slate-400 mt-0.5">支持 PNG、SVG、JPG，建议 1:1 比例。</p>
                {logo && <button onClick={removeLogo} className="mt-2 text-[10px] font-black text-red-500 uppercase tracking-widest hover:underline">移除自定义 Logo</button>}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl flex flex-col">
          <div className="absolute inset-0 tech-grid opacity-20" />
          <h3 className="font-black text-white/40 uppercase tracking-[0.2em] text-[10px] mb-8 relative z-10">侧边栏预览</h3>
          <div className="flex-1 flex flex-col items-center justify-center space-y-6 relative z-10">
            <div className="w-20 h-20 rounded-3xl bg-blue-600 flex items-center justify-center shadow-2xl overflow-hidden p-3">
              {logo ? <img src={assetUrl(logo) || ''} alt="Logo" className="w-full h-full object-contain" /> : (() => { const Target = ICON_OPTIONS.find((o) => o.id === tempIcon)?.icon || Zap; return <Target className="w-10 h-10 text-white" />; })()}
            </div>
            <div className="text-center">
              <h4 className="text-2xl font-black tracking-tight">{tempName}</h4>
              <p className="text-xs text-blue-400 font-mono tracking-widest uppercase mt-1">Enterprise Analytics</p>
            </div>
          </div>
          <button onClick={handleSave} disabled={isSaved} className={cn('mt-8 w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center space-x-2 relative z-10', isSaved ? 'bg-emerald-500 text-white' : 'bg-white text-slate-900 hover:bg-slate-100')}>
            {isSaved ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            <span>{isSaved ? '应用成功' : '保存更改'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
