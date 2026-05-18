import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Camera, Check, Eye, EyeOff, Key, Shield, User as UserIcon, X } from 'lucide-react';
import { api, ApiUser, assetUrl } from '../lib/api';
import { cn } from '../lib/utils';

interface UserSettingsProps {
  user: ApiUser;
  onClose: () => void;
  onUserUpdated: (user: ApiUser) => void;
}

export default function UserSettings({ user, onClose, onUserUpdated }: UserSettingsProps) {
  const [activeSection, setActiveSection] = useState<'profile' | 'security'>('profile');
  const [showPassword, setShowPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || null);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  const handleAvatar = async (file?: File) => {
    if (!file) return;
    try {
      const next = await api.uploadAvatar(user.id, file);
      setAvatarUrl(next.avatar_url || null);
      onUserUpdated(next);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    try {
      await api.updatePassword(user.id, passwordForm.oldPassword, passwordForm.newPassword);
      setIsSuccess(true);
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
      window.setTimeout(() => setIsSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col md:flex-row h-[560px]">
        <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-8 flex flex-col">
          <div className="mb-8">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">个人设置</h2>
            <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-bold">Account Settings</p>
          </div>
          <nav className="space-y-2 flex-1">
            <button onClick={() => setActiveSection('profile')} className={cn('w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold', activeSection === 'profile' ? 'bg-white border border-slate-200 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-white/50')}><UserIcon className="w-4 h-4" /><span>基本资料</span></button>
            <button onClick={() => setActiveSection('security')} className={cn('w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold', activeSection === 'security' ? 'bg-white border border-slate-200 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-white/50')}><Key className="w-4 h-4" /><span>安全设置</span></button>
          </nav>
          <button onClick={onClose} className="w-full text-center px-4 py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 font-bold text-xs uppercase tracking-widest">取消</button>
        </div>

        <div className="flex-1 p-8 md:p-12 overflow-y-auto relative">
          <button onClick={onClose} className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          {error && <div className="mb-4 text-red-500 text-xs bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</div>}

          {activeSection === 'profile' && (
            <div className="space-y-8">
              <section>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6">修改头像</h3>
                <div className="flex items-center space-x-8">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-[2rem] bg-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-xl overflow-hidden">
                      {avatarUrl ? <img src={assetUrl(avatarUrl) || ''} alt="avatar" className="w-full h-full object-cover" /> : user.username.charAt(0).toUpperCase()}
                    </div>
                    <label className="absolute -bottom-2 -right-2 w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:text-blue-600 shadow-lg cursor-pointer">
                      <Camera className="w-5 h-5" />
                      <input type="file" accept=".jpg,.jpeg,.png" className="hidden" onChange={(e) => handleAvatar(e.target.files?.[0])} />
                    </label>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900">推荐上传 200x200 分辨率</p>
                    <p className="text-xs text-slate-400 mt-1">支持 JPG、PNG 格式，最大 2MB。</p>
                  </div>
                </div>
              </section>
              <div className="h-px bg-slate-100" />
              <section className="space-y-4">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">基本信息</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5"><label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">用户名</label><input disabled value={user.username} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500" /></div>
                  <div className="space-y-1.5"><label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">当前角色</label><input disabled value={user.role} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-500" /></div>
                </div>
              </section>
            </div>
          )}

          {activeSection === 'security' && (
            <section className="space-y-6">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center"><Shield className="w-5 h-5 text-orange-500" /></div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">修改登录密码</h3>
              </div>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <input type="password" required placeholder="原密码" value={passwordForm.oldPassword} onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} required placeholder="新密码" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm pr-10" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-400">{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                </div>
                <input type={showPassword ? 'text' : 'password'} required placeholder="确认新密码" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm" />
                <button type="submit" disabled={isSuccess} className={cn('w-full bg-slate-900 hover:bg-black text-white font-bold py-3.5 rounded-xl text-xs uppercase tracking-widest flex items-center justify-center space-x-2', isSuccess && 'bg-emerald-500 hover:bg-emerald-600')}>
                  {isSuccess ? <><Check className="w-4 h-4" /><span>更新成功</span></> : <span>提交修改</span>}
                </button>
              </form>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start space-x-3">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />
                <p className="text-[11px] text-blue-600 leading-relaxed">新密码至少 8 位。建议定期更新密码，并避免与其他系统共用密码。</p>
              </div>
            </section>
          )}
        </div>
      </motion.div>
    </div>
  );
}
