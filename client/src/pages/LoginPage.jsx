import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Mail, Lock, User, ArrowRight, Github } from 'lucide-react';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handle = f => e => setForm(prev => ({ ...prev, [f]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') await login(form.email, form.password);
      else await register(form.email, form.password, form.name);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Authentication failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mesh-bg min-h-screen flex items-center justify-center p-4">
      {/* Decorative orbs */}
      <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-brand-500/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-purple-500/5 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-display text-3xl font-bold gradient-text">Nexus Chat</h1>
          <p className="text-slate-400 mt-2 text-sm">Connect. Collaborate. Communicate.</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8">
          {/* Tabs */}
          <div className="flex gap-1 bg-surface-3 rounded-xl p-1 mb-8">
            {['login', 'register'].map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all capitalize ${mode === m ? 'bg-brand-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
                {m === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text" placeholder="Full Name" required
                  value={form.name} onChange={handle('name')}
                  className="w-full bg-surface-3 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 outline-none input-glow transition-all focus:border-brand-500/50"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email" placeholder="Email address" required
                value={form.email} onChange={handle('email')}
                className="w-full bg-surface-3 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 outline-none input-glow transition-all focus:border-brand-500/50"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password" placeholder="Password" required
                value={form.password} onChange={handle('password')}
                className="w-full bg-surface-3 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 outline-none input-glow transition-all focus:border-brand-500/50"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #0ea5e9, #6366f1)' }}>
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5" />
            </div>
            <div className="relative text-center">
              <span className="bg-surface-2 px-3 text-xs text-slate-500">or continue with</span>
            </div>
          </div>

          <button onClick={loginWithGoogle}
            className="w-full py-3 rounded-xl border border-white/8 bg-surface-3 hover:bg-surface-4 text-sm font-medium flex items-center justify-center gap-3 transition-all text-slate-300 hover:text-white">
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Google
          </button>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Powered by Appwrite · Socket.IO · React
        </p>
      </div>
    </div>
  );
}
