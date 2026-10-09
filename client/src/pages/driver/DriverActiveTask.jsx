import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import locationTrackingService from '../../services/locationTrackingService';
import { useModeStore } from '../../store/modeStore';
import FleetMap from '../../components/map/FleetMap';
import {
  Navigation,
  CheckCircle2,
  AlertTriangle,
  Truck,
  Droplet,
  Battery,
  BatteryCharging,
  Radio,
  Play,
  RotateCcw,
  Check,
  Send,
} from 'lucide-react';

export default function DriverActiveTask() {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [trackingState, setTrackingState] = useState(locationTrackingService.getStatus());
  const [actionLoading, setActionLoading] = useState(false);
  const [deliveryLiters, setDeliveryLiters] = useState(3000);
  const [notes, setNotes] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showFailModal, setShowFailModal] = useState(false);
  const [failureReason, setFailureReason] = useState('');
  const { isDemo } = useModeStore();

  const fetchActiveTask = async () => {
    try {
      if (isDemo) {
        const fleetRes = await api.get('/tracking/fleet', { mode: 'demo' });
        const demoVehicle = (fleetRes.data || []).find((vehicle) => vehicle.activeTask);
        setTask(
          demoVehicle?.activeTask
            ? {
                ...demoVehicle.activeTask,
                requestId: demoVehicle.activeTask.request,
                vehicleId: demoVehicle,
                route: demoVehicle.activeTask.route,
              }
            : null
        );
        locationTrackingService.stopTracking();
        return;
      }

      const res = await api.get('/tasks/active');
      setTask(res.data);
      if (res.data) {
        setDeliveryLiters(res.data.requestId?.requestedLiters || 3000);
        locationTrackingService.updateTask(res.data);
      } else {
        locationTrackingService.stopTracking();
      }
    } catch (err) {
      console.error('Failed to fetch active task:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveTask();

    const unsubscribe = locationTrackingService.subscribe((state) => {
      setTrackingState(state);
    });

    const socket = getSocket();
    if (socket) {
      const refreshTask = () => fetchActiveTask();
      const handleLocationUpdate = (payload) => {
        setTask((current) => {
          if (!current?.vehicleId) return current;
          const currentTaskId = current._id?.toString();
          const currentVehicleId = (current.vehicleId._id || current.vehicleId).toString();
          const matchesTask = payload.taskId && payload.taskId.toString() === currentTaskId;
          const matchesVehicle = payload.vehicleId && payload.vehicleId.toString() === currentVehicleId;
          if (!matchesTask && !matchesVehicle) return current;
          return {
            ...current,
            status: payload.taskStatus || current.status,
            vehicleId: {
              ...current.vehicleId,
              status: payload.taskStatus || current.vehicleId.status,
              currentLocation: { lat: payload.lat, lng: payload.lng },
              heading: payload.heading ?? current.vehicleId.heading,
              speed: payload.speed ?? current.vehicleId.speed,
              lastLocationUpdate: payload.timestamp,
            },
          };
        });
      };
      socket.on('task:assigned', refreshTask);
      socket.on('task:status', refreshTask);
      socket.on('location:update', handleLocationUpdate);
      const demoRefreshId = isDemo ? setInterval(fetchActiveTask, 250) : null;

      return () => {
        unsubscribe();
        socket.off('task:assigned', refreshTask);
        socket.off('task:status', refreshTask);
        socket.off('location:update', handleLocationUpdate);
        if (demoRefreshId) clearInterval(demoRefreshId);
      };
    }

    return () => {
      unsubscribe();
    };
  }, [isDemo]);

  useEffect(() => {
    if (!task?._id) return undefined;
    const socket = getSocket();
    if (!socket) return undefined;
    const taskId = task._id.toString();
    const joinTask = () => socket.emit('join:task', taskId);
    joinTask();
    socket.on('connect', joinTask);
    return () => {
      socket.off('connect', joinTask);
      socket.emit('leave:task', taskId);
    };
  }, [task?._id]);

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await api.post(`/tasks/${task._id}/accept`);
      await fetchActiveTask();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartJourney = async () => {
    setActionLoading(true);
    try {
      await api.post(`/tasks/${task._id}/start`);
      await fetchActiveTask();
      if (!isDemo) locationTrackingService.startTracking(task);
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleArrive = async () => {
    setActionLoading(true);
    try {
      await api.post(`/tasks/${task._id}/arrive`);
      await fetchActiveTask();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartDelivery = async () => {
    setActionLoading(true);
    try {
      await api.post(`/tasks/${task._id}/start-delivery`);
      await fetchActiveTask();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    try {
      await api.post(`/tasks/${task._id}/complete`, {
        deliveryLiters: Number(deliveryLiters),
        notes,
      });
      setShowCompleteModal(false);
      locationTrackingService.stopTracking();
      await fetchActiveTask();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFail = async () => {
    setActionLoading(true);
    try {
      await api.post(`/tasks/${task._id}/fail`, {
        failureReason: failureReason || 'Driver reported obstruction/issue',
      });
      setShowFailModal(false);
      locationTrackingService.stopTracking();
      await fetchActiveTask();
    } catch (err) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSimulateMovement = () => {
    if (!task?.requestId?.location || !task?.vehicleId?.currentLocation) return;
    const start = task.vehicleId.currentLocation;
    const dest = task.requestId.location;
    locationTrackingService.startSimulation(start, dest, 25, task.route?.waypoints || []);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-cyan-400 font-mono text-xs">
        CONNECTING TO MISSION DISPATCH...
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-3">
        <div className="glass-panel p-8 rounded-2xl border border-command-800 space-y-3">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h2 className="text-white font-bold text-sm">No Active Delivery Assignment</h2>
          <p className="text-xs text-slate-400">
            You do not currently have an active task. Your tracking telemetry is in IDLE sleep mode to preserve battery and mobile network data.
          </p>
          <Link
            to="/driver"
            className="inline-block px-4 py-2 rounded-lg bg-cyan-500 text-command-950 font-mono font-bold text-xs mt-2"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { status, requestId: req, vehicleId: veh } = task;
  const activeRoutes = task.route?.waypoints?.length
    ? [{ positions: task.route.waypoints, color: '#00f2fe', label: 'Assigned delivery route' }]
    : [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-command-900 border border-command-800 p-4 rounded-xl">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
            <h1 className="text-xl font-bold font-mono text-white">
              MISSION CONTROL: {status}
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Destination: <span className="text-white font-medium">{req?.address}</span>
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
            {veh?.vehicleNumber}
          </span>
        </div>
      </div>

      {/* Battery-Aware GPS Telemetry Box (Section 48-65) */}
      <div className="glass-panel p-4 rounded-xl border border-cyan-500/30 space-y-3 bg-gradient-to-r from-command-900 to-command-850">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-command-800 pb-2.5">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-white uppercase">
              Duty-Cycle Battery-Conscious GPS System
            </span>
          </div>
          <div className="flex items-center space-x-3 text-xs font-mono text-slate-300">
            <span className="flex items-center space-x-1">
              {trackingState.isCharging ? (
                <BatteryCharging className="w-4 h-4 text-emerald-400" />
              ) : (
                <Battery className="w-4 h-4 text-cyan-400" />
              )}
              <span>Battery: {trackingState.batteryLevel}%</span>
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-cyan-400">
              Interval: {trackingState.intervalMs ? `${trackingState.intervalMs / 1000}s` : 'Duty Sleep'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="font-mono text-slate-400 text-[11px] space-y-0.5">
            <div>
              State: <span className="text-cyan-300 font-bold">{trackingState.mode}</span> (Frequency adapts automatically by proximity & battery)
            </div>
            <div>
              Telemetry: {trackingState.isTracking ? 'TRANSMITTING DUTY TICKS' : 'DUTY SLEEP / NO EXCESS GPS DRAIN'}
            </div>
          </div>

          {/* Desktop movement simulator button */}
          <button
            onClick={handleSimulateMovement}
            disabled={trackingState.isSimulating}
            className={`px-3 py-1.5 rounded-lg border font-mono text-xs flex items-center space-x-1.5 transition ${
              trackingState.isSimulating
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse'
                : 'bg-command-800 hover:bg-command-700 text-slate-200 border-command-700'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>{trackingState.isSimulating ? 'Simulating Transit...' : 'Simulate Drive Route'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Interactive Stage Actions + Mission Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stage Controller (1 col) */}
        <div className="glass-panel p-5 rounded-xl border border-command-800 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider border-b border-command-800 pb-2">
              Mission Progression Pipeline
            </h2>

            {/* Step Status Indicator */}
            <div className="p-3 bg-command-900 rounded-xl border border-command-800 space-y-2 text-xs">
              <div className="text-slate-400 font-mono text-[10px] uppercase">Demand Specifications</div>
              <div className="text-white font-bold text-sm">
                {req?.requestedLiters?.toLocaleString()} Liters of Potable Water
              </div>
              <div className="text-slate-300 text-[11px]">
                Affected: {req?.estimatedAffectedPeople} citizens • Severity: {req?.severity}
              </div>
            </div>

            {/* Lifecycle Transition Buttons */}
            <div className="space-y-2.5">
              {status === 'ASSIGNED' && (
                <button
                  onClick={handleAccept}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-mono font-bold text-xs transition shadow-glow-cyan flex items-center justify-center space-x-2"
                >
                  <Check className="w-4 h-4" />
                  <span>Accept Mission Assignment</span>
                </button>
              )}

              {status === 'ACCEPTED' && (
                <button
                  onClick={handleStartJourney}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-mono font-bold text-xs transition shadow-glow-cyan flex items-center justify-center space-x-2"
                >
                  <Navigation className="w-4 h-4" />
                  <span>Start Journey (En Route)</span>
                </button>
              )}

              {status === 'EN_ROUTE' && (
                <button
                  onClick={handleArrive}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white font-mono font-bold text-xs transition flex items-center justify-center space-x-2 shadow-lg"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark Arrived at Destination</span>
                </button>
              )}

              {status === 'ARRIVED' && (
                <button
                  onClick={handleStartDelivery}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-600 hover:from-cyan-400 hover:to-emerald-500 text-white font-mono font-bold text-xs transition flex items-center justify-center space-x-2 shadow-glow-cyan"
                >
                  <Droplet className="w-4 h-4" />
                  <span>Start Pumping / Water Delivery</span>
                </button>
              )}

              {status === 'DELIVERING' && (
                <button
                  onClick={() => setShowCompleteModal(true)}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-mono font-bold text-xs transition flex items-center justify-center space-x-2 shadow-lg"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Complete Delivery & Verify</span>
                </button>
              )}

              {/* Fail / Report Issue Button */}
              {['ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ARRIVED', 'DELIVERING'].includes(status) && (
                <button
                  onClick={() => setShowFailModal(true)}
                  className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-mono text-xs transition mt-2"
                >
                  Report Route Blockage / Incident Issue
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mission Map (2 cols) */}
        <div className="lg:col-span-2 glass-panel p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">
              Mission Destination & Route Vector
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              Tanker {veh?.vehicleNumber}
            </span>
          </div>

          <div className="h-[420px] w-full rounded-lg overflow-hidden border border-command-800">
            <FleetMap
              vehicles={veh ? [veh] : []}
              requests={req ? [req] : []}
              activeRoutes={activeRoutes}
              selectedCenter={veh?.currentLocation ? [veh.currentLocation.lat, veh.currentLocation.lng] : null}
              selectedZoom={14}
            />
          </div>
        </div>
      </div>

      {/* Complete Delivery Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-command-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-md border border-emerald-500/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-command-700 pb-3">
              <h3 className="font-mono font-bold text-white text-sm">
                VERIFY & COMPLETE WATER DELIVERY
              </h3>
              <button onClick={() => setShowCompleteModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-mono mb-1">Delivered Liters</label>
                <input
                  type="number"
                  required
                  value={deliveryLiters}
                  onChange={(e) => setDeliveryLiters(e.target.value)}
                  className="w-full bg-command-900 border border-command-700 rounded-lg p-2.5 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-mono mb-1">Operational Notes / Drop-off Point</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Discharged 3000L into residential overhead reservoir tank."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-command-900 border border-command-700 rounded-lg p-2.5 text-white placeholder-slate-600"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="px-3 py-1.5 rounded bg-command-800 text-slate-300 font-mono"
                >
                  Cancel
                </button>
                <button
                  onClick={handleComplete}
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded bg-emerald-500 text-command-950 font-bold font-mono shadow-lg"
                >
                  Verify Delivery
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fail Mission Modal */}
      {showFailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-command-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-md border border-red-500/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-command-700 pb-3">
              <h3 className="font-mono font-bold text-white text-sm">
                REPORT DELIVERY FAILURE / BLOCKAGE
              </h3>
              <button onClick={() => setShowFailModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-mono mb-1">Obstruction Reason</label>
                <textarea
                  rows="3"
                  required
                  placeholder="e.g. Road blocked due to pipeline construction, unable to reach target location."
                  value={failureReason}
                  onChange={(e) => setFailureReason(e.target.value)}
                  className="w-full bg-command-900 border border-command-700 rounded-lg p-2.5 text-white placeholder-slate-600"
                ></textarea>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowFailModal(false)}
                  className="px-3 py-1.5 rounded bg-command-800 text-slate-300 font-mono"
                >
                  Cancel
                </button>
                <button
                  onClick={handleFail}
                  disabled={actionLoading}
                  className="px-4 py-1.5 rounded bg-red-500 text-white font-bold font-mono"
                >
                  Submit Issue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
