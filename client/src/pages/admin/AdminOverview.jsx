import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import FleetMap from '../../components/map/FleetMap';
import {
  Droplets,
  AlertTriangle,
  Truck,
  CheckCircle2,
  TrendingUp,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Radio,
} from 'lucide-react';

import { useModeStore } from '../../store/modeStore';

export default function AdminOverview() {
  const { mode } = useModeStore();
  const [overview, setOverview] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [criticalRequests, setCriticalRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [ovRes, fleetRes, reqRes] = await Promise.all([
        api.get('/analytics/overview'),
        api.get('/tracking/fleet', { mode }),
        api.get('/requests', { limit: 5, severity: 'CRITICAL', status: 'PENDING' }),
      ]);
      setOverview(ovRes.data);
      setVehicles(fleetRes.data || []);
      setCriticalRequests(reqRes.data || []);
    } catch (err) {
      console.error('Error fetching admin overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    const handleModeChange = () => fetchData();
    window.addEventListener('fleetos:mode-change', handleModeChange);

    const socket = getSocket();
    const handleLocationUpdate = (payload) => {
        if (mode === 'real' && payload.isDemo) return;

        setVehicles((prev) => {
          const index = prev.findIndex((v) => v._id === payload.vehicleId);
          if (index >= 0) {
            const updated = {
              ...prev[index],
              currentLocation: { lat: payload.lat, lng: payload.lng },
              heading: payload.heading ?? prev[index].heading,
              lastLocationUpdate: payload.timestamp,
              isStale: false,
              status: payload.taskStatus || prev[index].status,
              activeTask: prev[index].activeTask
                ? {
                    ...prev[index].activeTask,
                    status: payload.taskStatus || prev[index].activeTask.status,
                  }
                : prev[index].activeTask,
            };
            const copy = [...prev];
            copy[index] = updated;
            return copy;
          } else if (payload.isDemo && mode === 'demo') {
            return [
              ...prev,
              {
                _id: payload.vehicleId,
                vehicleNumber: payload.vehicleNumber,
                status: payload.taskStatus || 'AVAILABLE',
                currentLocation: { lat: payload.lat, lng: payload.lng },
                heading: payload.heading,
                isDemo: true,
                driver: { name: payload.driverName },
              },
            ];
          }
          return prev;
        });
      };

    const handleDataRefresh = () => fetchData();
    if (socket) {
      socket.on('location:update', handleLocationUpdate);
      socket.on('task:assigned', handleDataRefresh);
      socket.on('task:status', handleDataRefresh);
      socket.on('request:created', handleDataRefresh);
      socket.on('request:updated', handleDataRefresh);
    }

    return () => {
      window.removeEventListener('fleetos:mode-change', handleModeChange);
      if (socket) {
        socket.off('location:update', handleLocationUpdate);
        socket.off('task:assigned', handleDataRefresh);
        socket.off('task:status', handleDataRefresh);
        socket.off('request:created', handleDataRefresh);
        socket.off('request:updated', handleDataRefresh);
      }
    };
  }, [mode]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh] text-cyan-400 font-mono text-sm">
        <Radio className="w-5 h-5 animate-spin mr-2" />
        Loading operations overview…
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-command-900 border border-command-800 p-4 rounded-xl">
        <div>
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-white flex items-center space-x-2">
            <span>Operations overview</span>
            <span className="text-xs bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 px-2 py-1 rounded-md font-medium">
              Kanpur sector
            </span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Monitor water delivery, open incidents, and fleet activity across the city.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Link
            to="/admin/live"
            className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-command-950 font-semibold text-xs transition flex items-center space-x-1.5"
          >
            <Radio className="w-4 h-4" />
            <span>Tactical Map</span>
          </Link>
          <Link
            to="/admin/requests"
            className="px-3.5 py-2 rounded-lg bg-command-800 hover:bg-command-700 text-slate-200 border border-command-700 text-xs transition"
          >
            Triage Requests ({overview?.pendingRequests || 0})
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Total Water Delivered */}
        <div className="glass-panel p-4 rounded-xl border-l-4 border-l-cyan-500">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>WATER DELIVERED</span>
            <Droplets className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-white">
            {overview?.totalDeliveredLiters?.toLocaleString() || 0}{' '}
            <span className="text-xs font-normal text-cyan-400">Liters</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>{overview?.completedRequests || 0} relief dispatches completed</span>
          </div>
        </div>

        {/* Critical Emergency Queue */}
        <div className="glass-panel p-4 rounded-xl border-l-4 border-l-red-500">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>CRITICAL CRISES</span>
            <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-red-400">
            {overview?.criticalRequests || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
            <AlertTriangle className="w-3 h-3 text-amber-400" />
            <span>{overview?.pendingRequests || 0} total requests pending</span>
          </div>
        </div>

        {/* Active Tankers */}
        <div className="glass-panel p-4 rounded-xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>FLEET STATUS</span>
            <Truck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-white">
            {overview?.activeVehicles || 0}{' '}
            <span className="text-xs font-normal text-slate-400">
              / {overview?.totalVehicles || 0} active
            </span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>{overview?.availableDrivers || 0} drivers on duty</span>
          </div>
        </div>

        {/* Fulfillment Rate */}
        <div className="glass-panel p-4 rounded-xl border-l-4 border-l-sky-500">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>AVG RESPONSE TIME</span>
            <Clock className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-xl md:text-2xl font-bold text-white">
            {overview?.avgDeliveryTimeMinutes || 35}{' '}
            <span className="text-xs font-normal text-sky-400">min</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1">
            <TrendingUp className="w-3 h-3 text-cyan-400" />
            <span>Fulfillment Rate: {overview?.fulfillmentRate || 0}%</span>
          </div>
        </div>
      </div>

      {/* Main Operations Grid: Live Map + Critical Emergency Column */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Map Preview (2 cols) */}
        <div className="lg:col-span-2 glass-panel p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">
                Live fleet deployment
              </h2>
            </div>
            <Link
              to="/admin/live"
              className="text-xs text-cyan-400 hover:text-cyan-300 font-medium flex items-center space-x-1"
            >
              <span>Full View</span>
              <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="h-[380px] w-full rounded-lg overflow-hidden border border-command-800">
            <FleetMap vehicles={vehicles} requests={criticalRequests} />
          </div>
        </div>

        {/* Critical Emergency Queue (1 col) */}
        <div className="glass-panel p-4 rounded-xl space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3 border-b border-command-800 pb-2">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                  Urgent Scarcity Reports
                </h2>
              </div>
              <span className="text-[10px] font-mono text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                PRIORITY
              </span>
            </div>

            <div className="space-y-2.5">
              {criticalRequests.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500">
                  No unassigned critical emergencies.
                </div>
              ) : (
                criticalRequests.map((req) => (
                  <div
                    key={req._id}
                    className="p-3 rounded-lg bg-command-900 border border-red-500/30 hover:border-red-500/60 transition space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white text-xs truncate max-w-[150px]">
                        {req.address}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded">
                        Score {req.priorityScore || 90}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300">
                      Demand:{' '}
                      <span className="text-cyan-300 font-bold">{req.requestedLiters?.toLocaleString()}L</span> •{' '}
                      {req.estimatedAffectedPeople} citizens
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-command-800 text-[10px]">
                      <span className="text-slate-500 font-mono">
                        {new Date(req.createdAt).toLocaleTimeString()}
                      </span>
                      <Link
                        to="/admin/requests"
                        className="text-cyan-400 hover:underline font-mono font-semibold"
                      >
                        Dispatch Tanker &rarr;
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <Link
            to="/admin/requests"
            className="w-full py-2 bg-command-800 hover:bg-command-700 text-center text-xs font-mono text-cyan-400 rounded-lg border border-command-700 transition block mt-3"
          >
            View All Pending Water Requests &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
