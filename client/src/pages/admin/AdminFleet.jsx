import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Truck, Droplet, Plus, RefreshCw, AlertCircle, CheckCircle2, BatteryCharging } from 'lucide-react';

export default function AdminFleet() {
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    vehicleNumber: '',
    type: 'WATER_TANKER',
    capacityLiters: 10000,
    currentWaterLevel: 10000,
    driverId: '',
  });

  const fetchData = async () => {
    try {
      const [vRes, dRes] = await Promise.all([
        api.get('/vehicles'),
        api.get('/drivers'),
      ]);
      setVehicles(vRes.data || []);
      setDrivers(dRes.data || []);
    } catch (err) {
      console.error('Failed to fetch fleet:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    try {
      await api.post('/vehicles', {
        ...formData,
        capacityLiters: Number(formData.capacityLiters),
        currentWaterLevel: Number(formData.currentWaterLevel),
        driverId: formData.driverId || undefined,
      });
      setShowAddModal(false);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRefill = async (v) => {
    try {
      await api.patch(`/vehicles/${v._id}`, { currentWaterLevel: v.capacityLiters });
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-command-900 border border-command-800 p-4 rounded-xl">
        <div>
          <h1 className="text-xl font-bold font-mono text-white flex items-center space-x-2">
            <Truck className="w-5 h-5 text-cyan-400" />
            <span>MUNICIPAL WATER TANKER FLEET</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Maintain water tankers, monitor capacity levels, and manage driver allocations.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-command-950 font-mono font-bold text-xs transition shadow-glow-cyan flex items-center space-x-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Tanker</span>
        </button>
      </div>

      {/* Fleet Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehicles.map((v) => {
          const waterPct = v.capacityLiters > 0 ? Math.round((v.currentWaterLevel / v.capacityLiters) * 100) : 0;

          return (
            <div key={v._id} className="glass-panel p-4 rounded-xl border border-command-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-mono font-extrabold text-base text-white flex items-center space-x-2">
                  <Truck className="w-4 h-4 text-cyan-400" />
                  <span>{v.vehicleNumber}</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    v.status === 'AVAILABLE'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : v.status === 'EN_ROUTE'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      : v.status === 'DELIVERING'
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-slate-700 text-slate-300'
                  }`}
                >
                  {v.status}
                </span>
              </div>

              {/* Water Level Visualization */}
              <div className="space-y-1.5 bg-command-900 p-3 rounded-lg border border-command-800">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400 flex items-center space-x-1">
                    <Droplet className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Water Reservoir</span>
                  </span>
                  <span className="font-bold text-cyan-400">
                    {v.currentWaterLevel?.toLocaleString()} / {v.capacityLiters?.toLocaleString()} L
                  </span>
                </div>
                <div className="w-full h-2.5 bg-command-950 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                    style={{ width: `${waterPct}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>Tank Level: {waterPct}%</span>
                  <span>Fuel: {v.fuelLevel || 90}%</span>
                </div>
              </div>

              {/* Driver & Info */}
              <div className="text-xs text-slate-300 space-y-1">
                <div>
                  <span className="text-slate-500 font-mono text-[11px]">ASSIGNED DRIVER:</span>{' '}
                  <span className="font-semibold text-white">
                    {v.driverId?.userId?.name || v.driverId?.name || 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-mono text-[11px]">LAST TELEMETRY:</span>{' '}
                  <span className="font-mono text-slate-400 text-[11px]">
                    {v.lastLocationUpdate ? new Date(v.lastLocationUpdate).toLocaleTimeString() : 'None'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-command-800 flex items-center justify-between">
                <button
                  onClick={() => handleRefill(v)}
                  disabled={v.currentWaterLevel >= v.capacityLiters}
                  className="px-2.5 py-1 rounded bg-command-800 hover:bg-cyan-500/20 text-cyan-300 border border-command-700 hover:border-cyan-500/40 text-[11px] font-mono transition disabled:opacity-40"
                >
                  Refill to 100%
                </button>
                <span className="text-[10px] text-slate-500 font-mono uppercase">
                  {v.type}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Tanker Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-command-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-md border border-cyan-500/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-command-700 pb-3">
              <h3 className="font-mono font-bold text-white text-sm">
                REGISTER MUNICIPAL TANKER
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateVehicle} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-mono">Vehicle Registration Number</label>
                <input
                  type="text"
                  required
                  placeholder="UP78-WT-2001"
                  value={formData.vehicleNumber}
                  onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                  className="w-full bg-command-900 border border-command-700 rounded-lg p-2 text-white font-mono uppercase"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-mono">Capacity (Liters)</label>
                <input
                  type="number"
                  required
                  min="1000"
                  step="500"
                  value={formData.capacityLiters}
                  onChange={(e) => setFormData({ ...formData, capacityLiters: e.target.value, currentWaterLevel: e.target.value })}
                  className="w-full bg-command-900 border border-command-700 rounded-lg p-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-mono">Assign Driver</label>
                <select
                  value={formData.driverId}
                  onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                  className="w-full bg-command-900 border border-command-700 rounded-lg p-2 text-white font-mono"
                >
                  <option value="">No Driver Assigned</option>
                  {drivers.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.userId?.name || 'Driver'} ({d.licenseNumber})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 rounded bg-command-800 text-slate-300 font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-cyan-500 text-command-950 font-bold font-mono shadow-glow-cyan"
                >
                  Save Tanker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
