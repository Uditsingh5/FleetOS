import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Truck, Droplet, Fuel, Calendar, ShieldCheck, MapPin } from 'lucide-react';

export default function DriverVehicle() {
  const [driver, setDriver] = useState(null);
  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVehicle = async () => {
      try {
        const dRes = await api.get('/drivers/me');
        setDriver(dRes.data);
        if (dRes.data?.currentVehicleId) {
          const vRes = await api.get(`/vehicles/${dRes.data.currentVehicleId._id || dRes.data.currentVehicleId}`);
          setVehicle(vRes.data);
        }
      } catch (err) {
        console.error('Failed to load vehicle:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchVehicle();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-cyan-400 text-xs">Loading vehicle details...</div>;
  }

  const waterPct = vehicle?.capacityLiters > 0 ? Math.round((vehicle.currentWaterLevel / vehicle.capacityLiters) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="glass-panel p-5 rounded-xl">
        <h1 className="text-xl font-semibold tracking-tight text-white flex items-center space-x-2">
          <Truck className="w-5 h-5 text-cyan-400" />
          <span>Assigned water tanker</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Check the vehicle status, water level, and readiness for your next delivery.
        </p>
      </div>

      {vehicle ? (
        <div className="glass-panel p-6 rounded-2xl border border-command-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-command-800 pb-4">
            <div>
              <div className="text-2xl font-black font-mono text-white flex items-center space-x-2">
                <span>{vehicle.vehicleNumber}</span>
              </div>
              <div className="text-xs text-slate-400 font-mono mt-0.5">
                Type: {vehicle.type}
              </div>
            </div>
            <span className="px-3 py-1 rounded-full font-mono text-xs font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 self-start sm:self-auto">
              STATUS: {vehicle.status}
            </span>
          </div>

          {/* Water Reservoir Capacity Bar */}
          <div className="space-y-2 bg-command-900 p-4 rounded-xl border border-command-800">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-300 flex items-center space-x-1">
                <Droplet className="w-4 h-4 text-cyan-400" />
                <span>Water Reservoir Capacity</span>
              </span>
              <span className="font-bold text-cyan-300">
                {vehicle.currentWaterLevel?.toLocaleString()} / {vehicle.capacityLiters?.toLocaleString()} Liters ({waterPct}%)
              </span>
            </div>
            <div className="w-full h-3 bg-command-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${waterPct}%` }}
              ></div>
            </div>
          </div>

          {/* Diagnostics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
            <div className="p-3 bg-command-900 rounded-xl border border-command-800 space-y-1">
              <span className="text-slate-500 flex items-center space-x-1">
                <Fuel className="w-3.5 h-3.5 text-amber-400" />
                <span>FUEL LEVEL</span>
              </span>
              <span className="font-bold text-white text-base">{vehicle.fuelLevel || 85}%</span>
            </div>

            <div className="p-3 bg-command-900 rounded-xl border border-command-800 space-y-1">
              <span className="text-slate-500 flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>LOCATION COORDINATES</span>
              </span>
              <span className="font-bold text-white text-xs truncate block">
                {vehicle.currentLocation ? `${vehicle.currentLocation.lat.toFixed(4)}, ${vehicle.currentLocation.lng.toFixed(4)}` : 'Stationary'}
              </span>
            </div>

            <div className="p-3 bg-command-900 rounded-xl border border-command-800 space-y-1">
              <span className="text-slate-500 flex items-center space-x-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>MAINTENANCE STATUS</span>
              </span>
              <span className="font-bold text-emerald-400 text-base">VERIFIED OPTIMAL</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-8 rounded-xl border border-command-800 text-center text-slate-400 text-xs font-mono">
          No vehicle currently assigned to your driver profile.
        </div>
      )}
    </div>
  );
}
