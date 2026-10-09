import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Droplets, Shield, Truck, User, ArrowRight, Lock, Mail, AlertCircle } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, quickSwitch, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await login(email, password);
      if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') navigate('/admin');
      else if (user.role === 'DRIVER') navigate('/driver');
      else navigate('/citizen');
    } catch {}
  };

  const handleDemoLogin = async (role) => {
    try {
      let u;
      if (role === 'ADMIN') {
        u = await quickSwitch('admin@waterfleet.gov.in', 'Password@123');
        navigate('/admin');
      } else if (role === 'DRIVER') {
        u = await quickSwitch('driver1@waterfleet.gov.in', 'Password@123');
        navigate('/driver');
      } else if (role === 'CITIZEN') {
        u = await quickSwitch('priya.singh@gmail.com', 'Password@123');
        navigate('/citizen');
      }
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#0a0f18] flex flex-col justify-center items-center px-4 py-10 relative overflow-hidden">
      {/* Background radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[720px] h-[280px] bg-cyan-700/10 blur-[100px] pointer-events-none rounded-full"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-400 mb-4">
            <Droplets className="w-7 h-7" />
          </div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-cyan-400 font-semibold mb-2">Municipal water response</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
            WATERFLEET <span className="text-cyan-400">OS</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Coordinate water requests, dispatches, and field teams in one place.
          </p>
        </div>

        {/* Card */}
        <div className="glass-panel p-6 md:p-8 rounded-xl">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-white">Welcome back</h2>
            <p className="text-sm text-slate-400 mt-1">Sign in to continue to your workspace.</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">Email Identifier</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@waterfleet.gov.in"
                  className="w-full bg-command-900 border border-command-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">Security Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="w-full bg-command-900 border border-command-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium py-2.5 rounded-lg text-sm transition shadow-glow-cyan flex items-center justify-center space-x-2 disabled:opacity-50 mt-2"
            >
              <span>{isLoading ? 'Authenticating...' : 'Sign In to Command Center'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-command-800">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 text-center mb-3">
              Quick access profiles
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleDemoLogin('ADMIN')}
                disabled={isLoading}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-command-800 hover:bg-cyan-500/10 border border-command-700 hover:border-cyan-500/40 text-left transition group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-cyan-300">Fleet Operations Admin</div>
                    <div className="text-[10px] text-slate-400 font-mono">admin@waterfleet.gov.in</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">Enter &rarr;</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('DRIVER')}
                disabled={isLoading}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-command-800 hover:bg-amber-500/10 border border-command-700 hover:border-amber-500/40 text-left transition group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-amber-300">Water Tanker Driver (Suresh)</div>
                    <div className="text-[10px] text-slate-400 font-mono">driver1@waterfleet.gov.in</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">Enter &rarr;</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoLogin('CITIZEN')}
                disabled={isLoading}
                className="w-full flex items-center justify-between p-2.5 rounded-lg bg-command-800 hover:bg-blue-500/10 border border-command-700 hover:border-blue-500/40 text-left transition group"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white group-hover:text-blue-300">Citizen Reporter (Priya)</div>
                    <div className="text-[10px] text-slate-400 font-mono">priya.singh@gmail.com</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">Enter &rarr;</span>
              </button>
            </div>
          </div>

          <div className="mt-4 text-center text-xs text-slate-400">
            Citizen without an account?{' '}
            <Link to="/register" className="text-cyan-400 hover:underline font-medium">
              Register here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
