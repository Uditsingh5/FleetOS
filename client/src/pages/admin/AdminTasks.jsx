import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import { CheckSquare, Truck, Navigation, Clock, CheckCircle2, AlertTriangle, ArrowUpRight } from 'lucide-react';

export default function AdminTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchTasks = async () => {
    try {
      const res = await api.get('/tasks', {
        status: statusFilter || undefined,
        limit: 50,
      });
      setTasks(res.data || []);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();

    const socket = getSocket();
    if (socket) {
      socket.on('task:assigned', () => fetchTasks());
      socket.on('task:status', () => fetchTasks());
    }
  }, [statusFilter]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-command-900 border border-command-800 p-4 rounded-xl">
        <div>
          <h1 className="text-xl font-bold font-mono text-white flex items-center space-x-2">
            <CheckSquare className="w-5 h-5 text-cyan-400" />
            <span>DISPATCH MISSIONS & TASK LIFECYCLE</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track execution progression from assignment to verified delivery.
          </p>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-command-950 border border-command-700 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-cyan-500 self-start sm:self-auto"
        >
          <option value="">All Mission States</option>
          <option value="ASSIGNED">ASSIGNED</option>
          <option value="ACCEPTED">ACCEPTED</option>
          <option value="EN_ROUTE">EN ROUTE</option>
          <option value="ARRIVED">ARRIVED</option>
          <option value="DELIVERING">DELIVERING</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="FAILED">FAILED</option>
        </select>
      </div>

      {/* Tasks Table */}
      <div className="glass-panel rounded-xl overflow-hidden border border-command-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-command-900/90 text-slate-400 font-mono uppercase text-[11px] border-b border-command-800">
              <tr>
                <th className="px-4 py-3">Task ID</th>
                <th className="px-4 py-3">Assigned Vehicle</th>
                <th className="px-4 py-3">Driver Operator</th>
                <th className="px-4 py-3">Delivery Destination</th>
                <th className="px-4 py-3">Mission State</th>
                <th className="px-4 py-3">Delivered / ETA</th>
                <th className="px-4 py-3 text-right">Telemetry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-command-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-slate-500 font-mono">
                    Loading mission records...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-slate-500 font-mono">
                    No tasks matching criteria
                  </td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr key={t._id} className="hover:bg-command-850/60 transition">
                    <td className="px-4 py-3 font-mono text-[11px] text-cyan-400">
                      #{t._id.slice(-6)}
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-white flex items-center space-x-1.5">
                      <Truck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{t.vehicleId?.vehicleNumber || 'Tanker'}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-200">
                      {t.driverId?.userId?.name || 'Driver'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-white truncate max-w-xs">
                        {t.requestId?.address || 'Kanpur Area'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {t.requestId?.requestedLiters?.toLocaleString()} Liters requested
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                          t.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : t.status === 'FAILED'
                            ? 'bg-red-500/20 text-red-400'
                            : t.status === 'EN_ROUTE'
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            : 'bg-amber-500/20 text-amber-300'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono">
                      {t.status === 'COMPLETED' ? (
                        <span className="text-emerald-400 font-bold">
                          {t.deliveryLiters?.toLocaleString()} Liters
                        </span>
                      ) : t.estimatedArrival ? (
                        <span className="text-amber-400">
                          {new Date(t.estimatedArrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span className="text-slate-500">In Transit</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to="/admin/live"
                        className="text-cyan-400 hover:text-cyan-300 font-mono text-[11px] inline-flex items-center space-x-1"
                      >
                        <span>Live Radar</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
