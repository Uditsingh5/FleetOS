import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { Bell, Droplets, Shield, Truck, User, LogOut, Clock, Activity, Check } from 'lucide-react';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import { useModeStore } from '../../store/modeStore';

export default function Navbar() {
  const { user, logout, quickSwitch } = useAuthStore();
  const { mode, isDemo, toggleMode, isToggling } = useModeStore();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [switchLoading, setSwitchLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const res = await api.get('/notifications', { limit: 6 });
      setNotifications(res.data || []);
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // non-critical
    }
  };

  useEffect(() => {
    fetchNotifications();

    const socket = getSocket();
    if (socket) {
      socket.on('notification:new', (notif) => {
        setNotifications((prev) => [notif, ...prev.slice(0, 5)]);
        setUnreadCount((c) => c + 1);
      });
    }
  }, [user]);

  const handleQuickSwitch = async (role) => {
    setSwitchLoading(true);
    try {
      if (role === 'ADMIN') {
        await quickSwitch('admin@waterfleet.gov.in', 'Password@123');
        navigate('/admin');
      } else if (role === 'DRIVER') {
        await quickSwitch('driver1@waterfleet.gov.in', 'Password@123');
        navigate('/driver');
      } else if (role === 'CITIZEN') {
        await quickSwitch('priya.singh@gmail.com', 'Password@123');
        navigate('/citizen');
      }
    } finally {
      setSwitchLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {}
  };

  return (
    <header className="h-16 bg-[#0d1420] border-b border-command-800 px-4 md:px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Brand & Live Beacon */}
      <div className="flex items-center space-x-3 min-w-0">
        <div className="flex items-center space-x-2 text-cyan-400 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-cyan-400" />
          </div>
          <div className="min-w-0">
            <span className="font-bold tracking-tight text-base md:text-lg text-slate-100">
              WATERFLEET<span className="text-white">OS</span>
            </span>
            <span className="hidden lg:inline-block ml-2 text-[10px] uppercase tracking-wider text-slate-400 border border-command-700 px-1.5 py-0.5 rounded bg-command-800">
              KANPUR OPERATIONS
            </span>
          </div>
        </div>

        {/* Live Ops Beacon */}
        {/* <div className="hidden lg:flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full text-xs font-mono text-emerald-400">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          <span>LIVE SYSTEMS</span>
        </div> */}
      </div>

      {/* Middle: Live Clock & Mode Switcher */}
      <div className="hidden lg:flex items-center space-x-3">
        {/* Mode Switcher */}
        <button
          onClick={toggleMode}
          disabled={isToggling}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center space-x-2 border shadow-sm whitespace-nowrap ${
            isDemo
              ? 'bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border-cyan-500/40 shadow-glow-cyan'
              : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
          }`}
          title="Switch between Demo Simulation (mock drivers) and Real Fleet Data mode"
        >
          <span className={`w-2 h-2 rounded-full ${isDemo ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'}`}></span>
          <span>{isDemo ? 'Demo mode' : 'Live data'}</span>
        </button>

        <div className="flex items-center space-x-2 text-xs text-slate-400 bg-command-850 px-3 py-1.5 rounded-lg border border-command-700 whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span>IST {time}</span>
        </div>
      </div>

      {/* Right: Quick Switcher & User Profile */}
      <div className="flex items-center space-x-2 md:space-x-3">
        {/* Quick Demo Role Switcher */}
        <div className="hidden xl:flex items-center space-x-1 bg-command-950 p-1 rounded-lg border border-command-800 text-xs">
          <span className="text-[10px] text-slate-500 px-2 uppercase tracking-wide">Switch role</span>
          <button
            onClick={() => handleQuickSwitch('ADMIN')}
            disabled={switchLoading}
            className={`px-2.5 py-1 rounded flex items-center space-x-1 transition font-medium ${
              user?.role === 'ADMIN'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                : 'text-slate-400 hover:text-slate-200 hover:bg-command-800'
            }`}
          >
            <Shield className="w-3 h-3 text-cyan-400" />
            <span>Admin</span>
          </button>
          <button
            onClick={() => handleQuickSwitch('DRIVER')}
            disabled={switchLoading}
            className={`px-2.5 py-1 rounded flex items-center space-x-1 transition font-medium ${
              user?.role === 'DRIVER'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-command-800'
            }`}
          >
            <Truck className="w-3 h-3 text-amber-400" />
            <span>Driver</span>
          </button>
          <button
            onClick={() => handleQuickSwitch('CITIZEN')}
            disabled={switchLoading}
            className={`px-2.5 py-1 rounded flex items-center space-x-1 transition font-medium ${
              user?.role === 'CITIZEN'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-command-800'
            }`}
          >
            <User className="w-3 h-3 text-blue-400" />
            <span>Citizen</span>
          </button>
        </div>

        {/* Notifications Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifDropdown(!showNotifDropdown)}
            className="w-9 h-9 rounded-lg bg-command-800 border border-command-700 flex items-center justify-center text-slate-300 hover:text-white hover:border-cyan-500/40 transition relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {showNotifDropdown && (
            <div className="absolute right-0 mt-2 w-80 md:w-96 bg-command-900 border border-command-700 rounded-xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between pb-2 border-b border-command-800 mb-2">
                <span className="text-xs font-semibold text-slate-200 font-mono flex items-center space-x-1">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  <span>ALERTS & LOGS</span>
                </span>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-cyan-400 hover:underline flex items-center space-x-1"
                  >
                    <Check className="w-3 h-3" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">No new telemetry alerts</div>
                ) : (
                  notifications.map((n, i) => (
                    <div
                      key={n._id || i}
                      className={`p-2.5 rounded-lg border text-xs transition ${
                        n.isRead
                          ? 'bg-command-950/60 border-command-800 text-slate-400'
                          : 'bg-command-800 border-cyan-500/30 text-slate-200 shadow-sm'
                      }`}
                    >
                      <div className="font-semibold text-cyan-300 mb-0.5">{n.title}</div>
                      <div className="text-[11px] leading-relaxed text-slate-300">{n.message}</div>
                      <div className="text-[10px] text-slate-500 mt-1 font-mono">
                        {n.createdAt ? new Date(n.createdAt).toLocaleTimeString() : 'Just now'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center space-x-2 pl-2 border-l border-command-800 min-w-0">
          <div className="hidden lg:block text-right min-w-0">
            <div className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">{user?.name}</div>
            <div className="text-[10px] font-mono text-cyan-400 tracking-wider">{user?.role}</div>
          </div>
          <button
            onClick={logout}
            className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 flex items-center justify-center transition"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
