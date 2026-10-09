import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { Droplet, PlusCircle, Clock, Radio, CheckCircle2, AlertTriangle, ArrowRight, Truck } from 'lucide-react';

export default function CitizenHome() {
  const { user } = useAuthStore();
  const [activeRequest, setActiveRequest] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCitizenData = async () => {
      try {
        const res = await api.get('/requests', { limit: 1 });
        if (res.data && res.data.length > 0) {
          setActiveRequest(res.data[0]);
        }
      } catch (err) {
        console.error('Failed to load citizen data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchCitizenData();
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Welcome Banner */}
      <div className="glass-panel p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
            Water relief services
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-white mt-2">
            Welcome back, {user?.name || 'Citizen'}
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
            Submit a shortage report, track a tanker, and keep up with verified deliveries.
          </p>
        </div>

        <Link
          to="/citizen/report"
          className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-command-950 text-xs font-semibold transition flex items-center space-x-2 shrink-0 self-start md:self-auto"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Report Water Shortage</span>
        </Link>
      </div>

      {/* Active Request Live Banner (if any) */}
      {activeRequest && activeRequest.status !== 'COMPLETED' ? (
        <div className="glass-panel p-5 rounded-2xl border-l-4 border-l-cyan-500 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              <h2 className="text-sm font-semibold text-white">
                Active water request
              </h2>
            </div>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold">
              {activeRequest.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-command-900 p-3 rounded-xl border border-command-800">
            <div>
              <span className="text-slate-500 font-mono text-[10px] block">DELIVERY LOCATION</span>
              <span className="font-semibold text-white truncate block">{activeRequest.address}</span>
            </div>
            <div>
              <span className="text-slate-500 font-mono text-[10px] block">QUANTITY DEMAND</span>
              <span className="font-bold text-cyan-300 font-mono">
                {activeRequest.requestedLiters?.toLocaleString()} Liters
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-mono text-[10px] block">REPORT TIME</span>
              <span className="text-slate-300 font-mono">
                {new Date(activeRequest.createdAt).toLocaleTimeString()}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Link
              to={
                activeRequest.assignedTaskId
                  ? `/citizen/tracking?taskId=${
                      activeRequest.assignedTaskId._id || activeRequest.assignedTaskId
                    }`
                  : '/citizen/requests'
              }
              className="text-xs font-medium text-cyan-400 hover:underline flex items-center space-x-1"
            >
              <span>{activeRequest.assignedTaskId ? 'Track Tanker Real-time' : 'View Request Details'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      ) : null}

      {/* Quick Action Navigation Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/citizen/report"
          className="glass-panel p-5 rounded-xl border border-command-800 hover:border-cyan-500/50 transition group space-y-2 block"
        >
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition">
            <Droplet className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-sm group-hover:text-cyan-300">
            Request Water Tanker
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Report drinking or domestic water depletion for your household, residential colony or clinic.
          </p>
        </Link>

        <Link
          to="/citizen/requests"
          className="glass-panel p-5 rounded-xl border border-command-800 hover:border-cyan-500/50 transition group space-y-2 block"
        >
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
            <Clock className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-sm group-hover:text-cyan-300">
            My Request History
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Check approval state, validation priority, and past verified water distributions.
          </p>
        </Link>

        <Link
          to="/citizen/tracking"
          className="glass-panel p-5 rounded-xl border border-command-800 hover:border-cyan-500/50 transition group space-y-2 block"
        >
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
            <Truck className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-white text-sm group-hover:text-cyan-300">
            Live Delivery Tracking
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Watch assigned water tanker movement with arrival countdown when dispatched.
          </p>
        </Link>
      </div>
    </div>
  );
}
