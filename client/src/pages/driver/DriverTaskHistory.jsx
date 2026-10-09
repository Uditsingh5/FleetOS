import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FileCheck, CheckCircle2, Clock, Droplets } from 'lucide-react';

export default function DriverTaskHistory() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/tasks', { limit: 50 });
        setTasks(res.data || []);
      } catch (err) {
        console.error('Failed to load task history:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="glass-panel p-5 rounded-xl">
        <h1 className="text-xl font-semibold tracking-tight text-white flex items-center space-x-2">
          <FileCheck className="w-5 h-5 text-cyan-400" />
          <span>Delivery history</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Review completed and in-progress deliveries assigned to you.
        </p>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden border border-command-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-command-900/90 text-slate-400 font-mono uppercase text-[11px] border-b border-command-800">
              <tr>
                <th className="px-4 py-3">Task ID</th>
                <th className="px-4 py-3">Destination Address</th>
                <th className="px-4 py-3">Assigned Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Delivered Liters</th>
                <th className="px-4 py-3">Verification Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-command-800/60 font-mono text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-slate-500 font-mono">
                    Loading trip logs...
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-slate-500 font-mono">
                    No past trip records found
                  </td>
                </tr>
              ) : (
                tasks.map((t) => (
                  <tr key={t._id} className="hover:bg-command-850/60 transition">
                    <td className="px-4 py-3 text-cyan-400">#{t._id.slice(-6)}</td>
                    <td className="px-4 py-3 font-sans text-white max-w-xs truncate">
                      {t.requestId?.address || 'Kanpur Area'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {new Date(t.assignedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded ${
                          t.status === 'COMPLETED'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : t.status === 'FAILED'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-cyan-500/20 text-cyan-300'
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-bold text-cyan-300">
                      {t.deliveryLiters ? `${t.deliveryLiters.toLocaleString()} L` : '--'}
                    </td>
                    <td className="px-4 py-3 font-sans text-slate-400 text-[11px] max-w-xs truncate">
                      {t.notes || t.failureReason || 'Normal delivery'}
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
