import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts';
import { BarChart3, Droplets, Clock, TrendingUp, Truck } from 'lucide-react';

const SEVERITY_COLORS = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#f59e0b',
  LOW: '#38bdf8',
};

export default function AdminAnalytics() {
  const [overview, setOverview] = useState(null);
  const [requestsData, setRequestsData] = useState({ bySeverity: [], byStatus: [], overTime: [] });
  const [fleetData, setFleetData] = useState({ vehiclesByStatus: [], driversByStatus: [], vehicles: [] });
  const [waterData, setWaterData] = useState({ waterDeliveredPerDay: [], capacity: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllAnalytics = async () => {
      try {
        const [ovRes, reqRes, flRes, wtRes] = await Promise.all([
          api.get('/analytics/overview'),
          api.get('/analytics/requests'),
          api.get('/analytics/fleet'),
          api.get('/analytics/water'),
        ]);
        setOverview(ovRes.data);
        setRequestsData(reqRes.data || { bySeverity: [], byStatus: [] });
        setFleetData(flRes.data || { vehiclesByStatus: [] });
        setWaterData(wtRes.data || { waterDeliveredPerDay: [] });
      } catch (err) {
        console.error('Failed to load analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchAllAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-cyan-400 font-mono text-sm">
        COMPILING MUNICIPAL OPERATIONS ANALYTICS...
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-command-900 border border-command-800 p-4 rounded-xl">
        <div>
          <h1 className="text-xl font-bold font-mono text-white flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            <span>OPERATIONAL ANALYTICS & FLEET PERFORMANCE</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Empirical demand metrics, delivery volume trends, and resource utilization insights.
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Requests by Severity */}
        <div className="glass-panel p-5 rounded-xl border border-command-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase font-bold text-slate-300">
              Shortage Incident Distribution by Severity
            </h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={requestsData.bySeverity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="severity" stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" name="Reports" radius={[4, 4, 0, 0]}>
                  {requestsData.bySeverity.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={SEVERITY_COLORS[entry.severity] || '#06b6d4'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Water Delivered Trends */}
        <div className="glass-panel p-5 rounded-xl border border-command-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase font-bold text-slate-300">
              Delivered Water Volume by Day (Liters)
            </h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterData.waterDeliveredPerDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="liters" name="Liters Delivered" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Requests by Status */}
        <div className="glass-panel p-5 rounded-xl border border-command-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase font-bold text-slate-300">
              Incident Pipeline Status
            </h2>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={requestsData.byStatus} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis type="number" stroke="#64748b" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis dataKey="status" type="category" stroke="#64748b" tick={{ fontSize: 10, fill: '#94a3b8' }} width={80} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" name="Incidents" fill="#3b82f6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fleet Utilization Table */}
        <div className="glass-panel p-5 rounded-xl border border-command-800 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase font-bold text-slate-300">
              Active Tanker Utilization Metrics
            </h2>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
            {fleetData.vehicles.map((v) => (
              <div key={v._id} className="p-3 bg-command-900 rounded-lg border border-command-800 space-y-1.5 text-xs">
                <div className="flex justify-between font-mono">
                  <span className="font-bold text-white">{v.vehicleNumber}</span>
                  <span className="text-cyan-400 font-bold">{v.utilizationPercent}% Fill</span>
                </div>
                <div className="w-full h-1.5 bg-command-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${v.utilizationPercent}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Capacity: {v.capacityLiters?.toLocaleString()} L</span>
                  <span>Status: {v.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
