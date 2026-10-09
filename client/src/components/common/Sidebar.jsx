import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
  LayoutDashboard,
  Navigation,
  Droplet,
  Truck,
  Users,
  CheckSquare,
  Flame,
  BarChart3,
  FileText,
  Home,
  PlusCircle,
  Clock,
  Radio,
  FileCheck,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function Sidebar() {
  const { user } = useAuthStore();
  const role = user?.role;
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('fleetos_sidebar_collapsed') === 'true');

  const adminLinks = [
    { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
    { to: '/admin/live', icon: Navigation, label: 'Live Operations' },
    { to: '/admin/requests', icon: Droplet, label: 'Water Requests' },
    { to: '/admin/fleet', icon: Truck, label: 'Fleet & Tankers' },
    { to: '/admin/drivers', icon: Users, label: 'Drivers' },
    { to: '/admin/tasks', icon: CheckSquare, label: 'Tasks & Dispatches' },
    { to: '/admin/scarcity', icon: Flame, label: 'Scarcity Heatmap' },
    { to: '/admin/analytics', icon: BarChart3, label: 'Operational Analytics' },
    { to: '/admin/audit', icon: FileText, label: 'Audit Trail' },
  ];

  const citizenLinks = [
    { to: '/citizen', icon: Home, label: 'Citizen Home', end: true },
    { to: '/citizen/report', icon: PlusCircle, label: 'Report Water Shortage' },
    { to: '/citizen/requests', icon: Clock, label: 'My Requests' },
    { to: '/citizen/tracking', icon: Radio, label: 'Live Tanker Tracking' },
  ];

  const driverLinks = [
    { to: '/driver', icon: LayoutDashboard, label: 'Driver Dashboard', end: true },
    { to: '/driver/active-task', icon: Navigation, label: 'Active Delivery Task' },
    { to: '/driver/vehicle', icon: Truck, label: 'Assigned Tanker' },
    { to: '/driver/history', icon: FileCheck, label: 'Trip History' },
  ];

  const links =
    role === 'ADMIN' || role === 'SUPER_ADMIN'
      ? adminLinks
      : role === 'DRIVER'
      ? driverLinks
      : citizenLinks;

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem('fleetos_sidebar_collapsed', String(next));
      return next;
    });
  };

  return (
    <>
      <aside
      className={`sticky top-16 h-[calc(100vh-4rem)] bg-[#0d1420] border-r border-command-800 hidden md:flex flex-col justify-between shrink-0 overflow-y-auto overflow-x-hidden transition-[width] duration-200 ${
        collapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="p-3 space-y-5">
        <div
          className={`h-11 flex items-center rounded-lg border border-command-800 bg-command-950/40 ${
            collapsed ? 'justify-center' : 'justify-between px-3'
          }`}
        >
          {!collapsed && (
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Workspace
              </div>
              <div className="text-xs font-medium text-slate-200 mt-0.5">
                {role === 'ADMIN' ? 'Fleet command' : role === 'DRIVER' ? 'Tanker operations' : 'Citizen portal'}
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            className="w-8 h-8 rounded-md text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10 flex items-center justify-center"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        <div>
          <nav className="space-y-0.5">
            {links.map((link) => {
              const Icon = link.icon;
              return (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  title={collapsed ? link.label : undefined}
                  className={({ isActive }) =>
                    `flex items-center ${collapsed ? 'justify-center' : 'space-x-3'} px-3 py-2.5 rounded-md text-sm font-medium transition ${
                      isActive
                      ? 'bg-cyan-500/10 text-cyan-200 border border-cyan-500/25 font-semibold'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-command-800/70 border border-transparent'
                    }`
                  }
                >
                  <Icon className="w-4 h-4 shrink-0 text-slate-500" />
                  {!collapsed && <span className="whitespace-nowrap">{link.label}</span>}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Municipal Emergency Hotline footer banner */}
      {!collapsed && (
        <div className="p-3 border-t border-command-800 text-[11px]">
          <div className="text-slate-500 text-[10px] uppercase tracking-[0.12em]">Municipal hotline</div>
          <div className="text-slate-300 font-medium mt-1">1800-180-WATER</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Available 24 hours</div>
        </div>
      )}
      </aside>
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0d1420]/95 border-t border-command-800 px-2 py-2 safe-area-bottom">
        <div className="grid grid-cols-4 gap-1">
          {links.slice(0, 4).map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={`mobile-${link.to}`}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 rounded-md py-1.5 text-[10px] ${
                    isActive ? 'text-cyan-300 bg-cyan-500/10' : 'text-slate-500'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span className="truncate max-w-full px-1">{link.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
