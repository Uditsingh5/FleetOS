import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Users, Truck, CheckCircle2, Phone, Star, Shield } from 'lucide-react';

export default function AdminDrivers() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDrivers = async () => {
    try {
      const res = await api.get('/drivers');
      setDrivers(res.data || []);
    } catch (err) {
      console.error('Failed to fetch drivers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleStatusChange = async (driverId, newStatus) => {
    try {
      await api.patch(`/drivers/${driverId}/status`, { status: newStatus });
      fetchDrivers();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-command-900 border border-command-800 p-4 rounded-xl">
        <div>
          <h1 className="text-xl font-bold font-mono text-white flex items-center space-x-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <span>WATER TANKER OPERATORS & DRIVERS</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Registered personnel operating municipal distribution vehicles across Kanpur.
          </p>
        </div>
        <div className="text-xs font-mono text-slate-400">
          Total Operators: <span className="text-cyan-400 font-bold">{drivers.length}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drivers.map((d) => (
          <div key={d._id} className="glass-panel p-4 rounded-xl border border-command-800 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">{d.userId?.name || 'Driver'}</h3>
                <div className="text-[11px] font-mono text-slate-400">{d.licenseNumber}</div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                  d.status === 'AVAILABLE'
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : d.status === 'BUSY'
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'bg-slate-700 text-slate-300'
                }`}
              >
                {d.status}
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-300 bg-command-900 p-2.5 rounded-lg border border-command-800">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-mono text-[11px]">CONTACT:</span>
                <span className="font-mono text-cyan-400">{d.userId?.phone || 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-mono text-[11px]">ASSIGNED TANKER:</span>
                <span className="font-mono font-semibold text-white">
                  {d.currentVehicleId?.vehicleNumber || 'None'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-mono text-[11px]">SUCCESSFUL MISSIONS:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {d.completedTasks || 0} / {d.totalTasks || 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-mono text-[11px]">RATING:</span>
                <span className="font-mono text-amber-400 flex items-center space-x-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>{d.rating || 4.8}</span>
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-command-800 flex items-center justify-between">
              <span className="text-[11px] font-mono text-slate-500">DUTY STATUS</span>
              <select
                value={d.status}
                onChange={(e) => handleStatusChange(d._id, e.target.value)}
                className="bg-command-850 border border-command-700 rounded px-2 py-1 text-[11px] font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="AVAILABLE">AVAILABLE</option>
                <option value="BUSY">BUSY</option>
                <option value="OFFLINE">OFFLINE</option>
              </select>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
