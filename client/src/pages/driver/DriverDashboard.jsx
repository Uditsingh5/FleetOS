import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../services/socket';
import FleetMap from '../../components/map/FleetMap';
import { Truck, Navigation, CheckCircle2, Clock, Droplets, Shield, ArrowRight, Play, Square } from 'lucide-react';
import { useModeStore } from '../../store/modeStore';

export default function DriverDashboard() {
  const { user } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [demoVehicle, setDemoVehicle] = useState(null);
  const [simulationActive, setSimulationActive] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const { isDemo } = useModeStore();

  const fetchDriverData = async () => {
    try {
      const [pRes, tRes] = await Promise.all([
        api.get('/drivers/me'),
        api.get('/tasks/active'),
      ]);
      setProfile(pRes.data);
      setActiveTask(tRes.data);
      if (isDemo) {
        const [simulationRes, fleetRes] = await Promise.all([
          api.get('/tracking/simulation/status'),
          api.get('/tracking/fleet', { mode: 'demo' }),
        ]);
        setSimulationActive(Boolean(simulationRes.data?.isActive));
        const nextDemoVehicle = (fleetRes.data || []).find((vehicle) => vehicle.activeTask) || null;
        setDemoVehicle(nextDemoVehicle);
        if (nextDemoVehicle?.activeTask?._id) {
          getSocket()?.emit('join:task', nextDemoVehicle.activeTask._id.toString());
        }
      } else {
        setDemoVehicle(null);
      }
    } catch (err) {
      console.error('Failed to load driver dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDriverData();
  }, [isDemo]);

  useEffect(() => {
    if (!isDemo) return undefined;

    const refreshDemoRoute = async () => {
      try {
        const response = await api.get('/tracking/fleet', { mode: 'demo' });
        setDemoVehicle((response.data || []).find((vehicle) => vehicle.activeTask) || null);
      } catch (err) {
        console.error('Failed to refresh demo route progress:', err);
      }
    };

    const intervalId = setInterval(refreshDemoRoute, 2500);
    const socket = getSocket();
    const handleLocationUpdate = (payload) => {
      if (!payload.isDemo) return;
      setDemoVehicle((current) => {
        if (!current || String(current._id) !== String(payload.vehicleId)) return current;
        return {
          ...current,
          status: payload.taskStatus || current.status,
          currentLocation: { lat: payload.lat, lng: payload.lng },
          heading: payload.heading ?? current.heading,
          speed: payload.speed ?? current.speed,
          lastLocationUpdate: payload.timestamp,
        };
      });
    };
    socket?.on('location:update', handleLocationUpdate);

    return () => {
      clearInterval(intervalId);
      socket?.off('location:update', handleLocationUpdate);
    };
  }, [isDemo]);

  useEffect(() => {
    if (!isDemo || !demoVehicle?.activeTask?._id) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    const taskId = demoVehicle.activeTask._id.toString();
    const joinTask = () => socket.emit('join:task', taskId);
    joinTask();
    socket.on('connect', joinTask);
    return () => {
      socket.off('connect', joinTask);
      socket.emit('leave:task', taskId);
    };
  }, [isDemo, demoVehicle?.activeTask?._id]);

  const setSimulation = async (action) => {
    setSimulationLoading(true);
    try {
      const response = await api.post(`/tracking/simulation/${action}`);
      setSimulationActive(Boolean(response.data?.active));
    } catch (err) {
      console.error(`Failed to ${action} demo driver simulation:`, err);
    } finally {
      setSimulationLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Top Profile Banner */}
      <div className="glass-panel p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-wider text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
            Driver workspace
          </span>
          <h1 className="text-xl md:text-2xl font-bold text-white mt-2">
            Welcome, {user?.name || 'Driver'}
          </h1>
          <div className="text-xs text-slate-400 mt-1 font-mono space-x-3">
            <span>License: <span className="text-slate-200">{profile?.licenseNumber || 'DL-UP78'}</span></span>
            <span>Status: <span className="text-cyan-400 font-bold">{profile?.status || 'AVAILABLE'}</span></span>
          </div>
        </div>

        {activeTask && (
          <Link
            to="/driver/active-task"
            className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-command-950 font-semibold text-xs transition flex items-center space-x-2 shrink-0 self-start md:self-auto"
          >
            <Navigation className="w-4 h-4 animate-pulse" />
            <span>Open Active Mission</span>
          </Link>
        )}
      </div>

      {isDemo && (
        <div className="glass-panel p-4 rounded-xl border border-cyan-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Demo driver movement</div>
            <p className="text-xs text-slate-400 mt-1">
              Start the simulation to move demo tankers along their road routes. It stays active until you stop it; each assigned tanker stops only when it reaches its destination.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSimulation(simulationActive ? 'stop' : 'start')}
            disabled={simulationLoading}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              simulationActive
                ? 'border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                : 'bg-cyan-500 text-command-950 hover:bg-cyan-400'
            }`}
          >
            {simulationActive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {simulationLoading ? 'Updating...' : simulationActive ? 'Stop demo drivers' : 'Start demo drivers'}
          </button>
        </div>
      )}

      {isDemo && demoVehicle?.currentLocation && (
        <div className="glass-panel p-4 rounded-xl border border-command-800 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Demo tanker location</div>
              <p className="text-xs text-slate-400 mt-1">
                {demoVehicle.vehicleNumber} · {demoVehicle.status}
              </p>
            </div>
            <span className="text-[11px] text-cyan-300">
              {demoVehicle.speed ? `${demoVehicle.speed} km/h` : 'Stopped'}
            </span>
          </div>
          <div className="h-[320px] rounded-lg overflow-hidden border border-command-800">
            <FleetMap
              vehicles={[demoVehicle]}
              requests={demoVehicle.activeTask?.request ? [demoVehicle.activeTask.request] : []}
              activeRoutes={demoVehicle.activeTask?.route?.waypoints?.length
                ? [{
                    positions: demoVehicle.activeTask.route.waypoints,
                    color: '#00f2fe',
                    label: 'Demo delivery route',
                  }]
                : []}
              selectedCenter={[
                demoVehicle.currentLocation.lat,
                demoVehicle.currentLocation.lng,
              ]}
              selectedZoom={14}
              autoFit={false}
            />
          </div>
        </div>
      )}

      {/* Active Task Hero Card */}
      {activeTask ? (
        <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-cyan-500 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
              <h2 className="text-sm font-semibold text-white">
                Active delivery
              </h2>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              {activeTask.status}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-command-900 p-4 rounded-xl border border-command-800 text-xs">
            <div>
              <span className="text-slate-500 font-mono text-[10px] block">DELIVERY ADDRESS</span>
              <span className="font-bold text-white text-sm truncate block">
                {activeTask.requestId?.address}
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-mono text-[10px] block">WATER TO DELIVER</span>
              <span className="font-mono font-bold text-cyan-300 text-sm">
                {activeTask.requestId?.requestedLiters?.toLocaleString()} Liters
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-mono text-[10px] block">CITIZEN CONTACT</span>
              <span className="font-mono text-slate-300">
                {activeTask.requestId?.citizenId?.phone || '+91 98765 00000'}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Link
              to="/driver/active-task"
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-command-950 font-semibold text-xs transition flex items-center space-x-1.5"
            >
              <span>Driver Action Controls & GPS Radar</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="glass-panel p-8 rounded-2xl border border-command-800 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h3 className="text-white font-bold text-sm">No Active Mission Assigned</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You are currently on standby. The central municipal dispatch will assign emergency tasks when water shortage reports arrive.
          </p>
        </div>
      )}

      {isDemo && demoVehicle?.activeTask?.routeProgress && (
        <div className="glass-panel p-4 rounded-xl border border-cyan-500/20 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-white">Simulated route progress</div>
              <p className="text-xs text-slate-400 mt-1">
                {demoVehicle.vehicleNumber} · {demoVehicle.activeTask.request?.address}
              </p>
            </div>
            <span className="text-sm font-semibold text-cyan-300">
              {demoVehicle.activeTask.routeProgress.percentComplete}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-command-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-cyan-400 transition-all duration-700"
              style={{ width: `${demoVehicle.activeTask.routeProgress.percentComplete}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Road point {demoVehicle.activeTask.routeProgress.currentPoint} of {demoVehicle.activeTask.routeProgress.totalPoints}</span>
            <span>{demoVehicle.activeTask.routeProgress.remainingPoints} points remaining</span>
          </div>
        </div>
      )}

      {/* Driver Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-command-800 space-y-1">
          <span className="text-slate-500 text-xs font-mono">COMPLETED DELIVERIES</span>
          <div className="text-2xl font-black text-white font-mono">
            {profile?.completedTasks || 0}
          </div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-command-800 space-y-1">
          <span className="text-slate-500 text-xs font-mono">OPERATOR RATING</span>
          <div className="text-2xl font-black text-amber-400 font-mono">
            {profile?.rating || 4.9} ★
          </div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-command-800 space-y-1">
          <span className="text-slate-500 text-xs font-mono">ASSIGNED TANKER</span>
          <div className="text-2xl font-black text-cyan-400 font-mono">
            {profile?.currentVehicleId?.vehicleNumber || 'UP78-WT-1001'}
          </div>
        </div>
      </div>
    </div>
  );
}
