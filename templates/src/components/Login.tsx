import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, User, ShieldCheck, ChevronRight, Cpu } from 'lucide-react';
import { api, ApiUser } from '../lib/api';

export default function Login({ onLogin }: { onLogin: (token: string, user: ApiUser) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await api.login(username, password);
      onLogin(res.access_token, res.user);
    } catch (err: any) {
      setError(err.message || '输入的账号或密码错误');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 flex items-center justify-center p-4">
      {/* Background Animated Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-indigo-400/10 rounded-full blur-[100px] animate-pulse delay-700" />
        <div className="absolute inset-0 tech-grid" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="glass p-8 md:p-12 rounded-[2.5rem] glow-blue space-y-8">
          <div className="text-center space-y-2">
            <motion.div 
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20 mb-4"
            >
              <Cpu className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">
              ASTROCORE
            </h1>
            <p className="text-slate-400 font-mono text-xs uppercase tracking-[0.2em] font-bold">
              Secure Analytics Gate
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Access Identity</label>
                <div className="relative group">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="USERNAME"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full bg-slate-100/50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-blue-600 transition-all font-mono text-sm"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Security Key</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
                  <input 
                    type="password" 
                    placeholder="PASSWORD"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-100/50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-blue-600 transition-all font-mono text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-500 text-xs font-mono text-center bg-red-50 py-2.5 rounded-lg border border-red-100"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              disabled={isLoading}
              className="group relative w-full bg-slate-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center space-x-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  <span className="tracking-widest uppercase text-sm">Initialize Session</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <footer className="pt-4 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-mono">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              TLS_SESSION: ACTIVE
            </span>
            <span>Secure Enterprise Authentication</span>
          </footer>
        </div>
      </motion.div>
    </div>
  );
}
