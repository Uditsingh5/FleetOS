import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { FileText, Shield, Clock, Search, Filter } from 'lucide-react';

export default function AdminAuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const fetchLogs = async () => {
    try {
      const res = await api.get('/audit', {
        action: actionFilter || undefined,
        limit: 50,
      });
      setLogs(res.data || []);
    } catch (err) {
      console.error('Failed to load audit trail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-command-900 border border-command-800 p-4 rounded-xl">
        <div>
          <h1 className="text-xl font-bold font-mono text-white flex items-center space-x-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span>IMMUTABLE SYSTEM AUDIT TRAIL</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Complete cryptographic audit log of all operational assignments, status transitions, and user actions.
          </p>
        </div>

        <div className="relative min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="Filter by action code..."
            className="w-full bg-command-950 border border-command-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      <div className="glass-panel rounded-xl overflow-hidden border border-command-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-command-900/90 text-slate-400 font-mono uppercase text-[11px] border-b border-command-800">
              <tr>
                <th className="px-4 py-3">Timestamp (IST)</th>
                <th className="px-4 py-3">Action Event</th>
                <th className="px-4 py-3">Actor Role</th>
                <th className="px-4 py-3">Operator Name</th>
                <th className="px-4 py-3">Entity Type</th>
                <th className="px-4 py-3">Audit Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-command-800/60 font-mono text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-slate-500 font-mono">
                    Loading cryptographic logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-slate-500 font-mono">
                    No audit records matching query
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-command-850/60 transition">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-cyan-300 font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20 text-[10px]">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[11px]">
                      {log.actorRole}
                    </td>
                    <td className="px-4 py-3 font-sans text-white text-xs">
                      {log.actorId?.name || 'Automated System'}
                    </td>
                    <td className="px-4 py-3 text-amber-400 text-[11px]">
                      {log.entityType}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-[10px] truncate max-w-xs">
                      {JSON.stringify(log.metadata || {})}
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
