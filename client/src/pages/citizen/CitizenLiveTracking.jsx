import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import FleetMap from '../../components/map/FleetMap';
import { useModeStore } from '../../store/modeStore';
import { Truck, Phone, Navigation, Clock, Droplets, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function CitizenLiveTracking() {
  const [searchParams] = useSearchParams();
  const taskId = searchParams.get('taskId');
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const joinedTaskIdRef = useRef(null);
  const { isDemo } = useModeStore();
  const isExplicitDemoTask = Boolean(taskId?.startsWith('mock-'));

  const fetchTracking = async () => {
    if (isDemo && isExplicitDemoTask) {
      try {
        const fleetRes = await api.get('/tracking/fleet', { mode: 'demo' });
        const demoVehicles = fleetRes.data || [];
        const demoVehicle = demoVehicles.find(
          (vehicle) => vehicle.activeTask?._id?.toString() === taskId
        );

        if (!demoVehicle?.activeTask) {
          setError('The selected demo tanker delivery is not active.');
          setTrackingData(null);
          return;
        }

        setTrackingData({
          task: demoVehicle.activeTask,
          request: demoVehicle.activeTask.request,
          vehicle: demoVehicle,
          driver: demoVehicle.driver,
        });
        if (demoVehicle.activeTask.status !== 'COMPLETED') {
          if (
            joinedTaskIdRef.current &&
            joinedTaskIdRef.current !== demoVehicle.activeTask._id.toString()
          ) {
            getSocket()?.emit('leave:task', joinedTaskIdRef.current);
          }
          joinedTaskIdRef.current = demoVehicle.activeTask._id.toString();
          getSocket()?.emit('join:task', joinedTaskIdRef.current);
        }
        return;
      } catch (err) {
        setError(err.message || 'Demo tracking information unavailable');
        return;
      } finally {
        setLoading(false);
      }
    }

    if (!taskId) {
      // If no taskId in URL, fetch citizen's latest active task
      try {
        const reqRes = await api.get('/requests', { limit: 50 });
        const assignedRequest = reqRes.data?.find((request) => request.assignedTaskId);
        const assignedTaskId =
          assignedRequest?.assignedTaskId?._id || assignedRequest?.assignedTaskId;
        if (assignedTaskId) {
          const tRes = await api.get(`/tracking/tasks/${assignedTaskId}`);
          setTrackingData(tRes.data);
          if (tRes.data.task?.status !== 'COMPLETED') {
            const resolvedTaskId = tRes.data.task?._id || assignedTaskId;
            joinedTaskIdRef.current = resolvedTaskId.toString();
            getSocket()?.emit('join:task', joinedTaskIdRef.current);
          }
        } else {
          setError('No active tanker delivery found for tracking.');
        }
      } catch (err) {
        setError(err.message || 'Tracking information unavailable');
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const res = await api.get(`/tracking/tasks/${taskId}`);
      setTrackingData(res.data);
      if (res.data.task?.status !== 'COMPLETED') {
        joinedTaskIdRef.current = (res.data.task?._id || taskId).toString();
        getSocket()?.emit('join:task', joinedTaskIdRef.current);
      }
    } catch (err) {
      setError(err.message || 'Tracking failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracking();

    const socket = getSocket();
    const staleCheckId = setInterval(() => {
      setTrackingData((prev) => {
        if (!prev?.vehicle?.lastLocationUpdate) return prev;
        return {
          ...prev,
          vehicle: {
            ...prev.vehicle,
            isStale: Date.now() - new Date(prev.vehicle.lastLocationUpdate).getTime() > 60000,
          },
        };
      });
    }, 5000);
    const demoRefreshId = isDemo ? setInterval(fetchTracking, 250) : null;
    if (socket) {
      socket.on('connect', fetchTracking);
      const handleLocationUpdate = (payload) => {
        setTrackingData((prev) => {
          if (!prev) return prev;
          const currentTaskId = prev.task?._id?.toString();
          const currentVehicleId = prev.vehicle?._id?.toString();
          const matchTask = payload.taskId && payload.taskId.toString() === currentTaskId;
          const matchVehicle = payload.vehicleId && payload.vehicleId.toString() === currentVehicleId;
          if (matchTask || matchVehicle) {
            return {
              ...prev,
              task: {
                ...prev.task,
                status: payload.taskStatus || prev.task?.status,
              },
              vehicle: {
                ...prev.vehicle,
                status: payload.taskStatus || prev.vehicle?.status,
                currentLocation: { lat: payload.lat, lng: payload.lng },
                heading: payload.heading ?? prev.vehicle?.heading,
                speed: payload.speed ?? prev.vehicle?.speed,
                lastLocationUpdate: payload.timestamp,
                isStale: false,
              },
            };
          }
          return prev;
        });
      };

      const handleTaskChanged = () => fetchTracking();
      socket.on('location:update', handleLocationUpdate);
      socket.on('task:status', handleTaskChanged);
      socket.on('task:assigned', handleTaskChanged);
      socket.on('request:updated', handleTaskChanged);
      socket.on('request:status', handleTaskChanged);

      return () => {
        socket.off('connect', fetchTracking);
        socket.off('location:update', handleLocationUpdate);
        socket.off('task:status', handleTaskChanged);
        socket.off('task:assigned', handleTaskChanged);
        socket.off('request:updated', handleTaskChanged);
        socket.off('request:status', handleTaskChanged);
        if (joinedTaskIdRef.current) {
          socket.emit('leave:task', joinedTaskIdRef.current);
          joinedTaskIdRef.current = null;
        }
        if (demoRefreshId) clearInterval(demoRefreshId);
        clearInterval(staleCheckId);
      };
    }
    return () => {
      if (demoRefreshId) clearInterval(demoRefreshId);
      clearInterval(staleCheckId);
    };
  }, [taskId, isDemo, isExplicitDemoTask]);

  if (loading) {
    return (
      <div className="p-8 text-center text-cyan-400 font-mono text-xs">
        CONNECTING TO TANKER GPS TELEMETRY STREAM...
      </div>
    );
  }

  if (error || !trackingData) {
    return (
      <div className="p-6 max-w-xl mx-auto space-y-4 text-center">
        <div className="glass-panel p-8 rounded-2xl border border-command-800 space-y-3">
          <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
          <h2 className="text-white font-bold text-sm">No Active Delivery Tracking Session</h2>
          <p className="text-xs text-slate-400">
            {error || 'You do not currently have a water tanker dispatched on the road.'}
          </p>
          <Link
            to="/citizen/requests"
            className="inline-block px-4 py-2 rounded-lg bg-cyan-500 text-command-950 font-bold font-mono text-xs mt-2"
          >
            Check My Requests
          </Link>
        </div>
      </div>
    );
  }

  const { task, vehicle, driver, request } = trackingData;
  const isCompleted = task.status === 'COMPLETED' || request?.status === 'COMPLETED';

  const vehicleList = vehicle?.currentLocation ? [vehicle] : [];
  const requestList = request?.location ? [request] : [];
  const assignedWaypoints = task?.route?.waypoints;
  const activeRoutes = assignedWaypoints?.length
    ? [{
        id: `task-${task._id}`,
        vehicleId: vehicle?._id,
        positions: assignedWaypoints,
        color: '#00f2fe',
        label: 'Assigned delivery route',
      }]
    : [];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-command-900 border border-command-800 p-4 rounded-xl">
        <div className="flex items-center space-x-3">
          <Link
            to="/citizen/requests"
            className="p-2 rounded-lg bg-command-800 hover:bg-command-700 text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold font-mono text-white flex items-center space-x-2">
              <Navigation className="w-5 h-5 text-cyan-400" />
              <span>LIVE WATER TANKER TELEMETRY</span>
            </h1>
            <p className="text-xs text-slate-400">
              Real-time delivery progress to {request?.address}
            </p>
          </div>
        </div>

        <span
          className={`px-3 py-1 rounded-full font-mono text-xs font-bold self-start sm:self-auto ${
            task.status === 'COMPLETED'
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
          }`}
        >
          {task.status === 'COMPLETED' ? 'DELIVERY COMPLETE' : `MISSION STATE: ${task.status}`}
        </span>
      </div>

      {/* Main Grid: Live Map + Tanker Info Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Map (2 cols) */}
        <div className="lg:col-span-2 glass-panel p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400 font-bold">
              Autonomous Fleet GPS Stream
            </span>
            <span className="text-[11px] font-mono text-cyan-400">
              {vehicle?.isStale ? 'Location Stale (>60s)' : 'Live Signal Active'}
            </span>
          </div>

          {isCompleted ? (
            <div className="h-[440px] w-full rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex flex-col items-center justify-center text-center p-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-3" />
              <p className="text-emerald-300 font-mono font-bold text-sm">LIVE TRACKING DISABLED</p>
              <p className="text-slate-300 text-xs mt-2">
                This delivery has been completed. No further tanker telemetry is being transmitted.
              </p>
            </div>
          ) : (
            <div className="h-[440px] w-full rounded-lg overflow-hidden border border-command-800">
              <FleetMap
                vehicles={vehicleList}
                requests={requestList}
                activeRoutes={activeRoutes}
                selectedCenter={null}
                autoFit={Boolean(assignedWaypoints?.length)}
              />
            </div>
          )}
        </div>

        {/* Tanker & Driver Info Panel (1 col) */}
        <div className="glass-panel p-5 rounded-xl border border-command-800 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-sm font-bold font-mono text-white uppercase border-b border-command-800 pb-2">
              Assigned Tanker Unit
            </h2>

            {/* Vehicle Card */}
            <div className="p-3.5 bg-command-900 rounded-xl border border-command-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-white text-base flex items-center space-x-2">
                  <Truck className="w-4 h-4 text-cyan-400" />
                  <span>{vehicle?.vehicleNumber}</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded">
                  {vehicle?.capacityLiters?.toLocaleString()}L Unit
                </span>
              </div>
              <div className="text-xs text-slate-300">
                Water Remaining: <span className="text-cyan-300 font-bold">{vehicle?.currentWaterLevel?.toLocaleString()} Liters</span>
              </div>
            </div>

            {/* Driver Card */}
            <div className="p-3.5 bg-command-900 rounded-xl border border-command-800 space-y-2">
              <div className="text-[11px] font-mono text-slate-500 uppercase">Authorized Driver</div>
              <div className="font-bold text-white text-sm">{driver?.name || 'Assigned Driver'}</div>
              {driver?.phone && (
                <div className="flex items-center space-x-2 text-xs font-mono text-cyan-400">
                  <Phone className="w-3.5 h-3.5" />
                  <span>{driver.phone}</span>
                </div>
              )}
            </div>

            {/* Delivery Stats */}
            <div className="p-3.5 bg-command-900 rounded-xl border border-command-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">REQUESTED WATER:</span>
                <span className="text-cyan-300 font-bold">{request?.requestedLiters?.toLocaleString()} Liters</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">ESTIMATED ETA:</span>
                <span className="text-amber-400 font-bold">
                  {task.estimatedArrival
                    ? `${Math.max(1, Math.round((new Date(task.estimatedArrival) - Date.now()) / 60000))} min`
                    : '10 min'}
                </span>
              </div>
            </div>
          </div>

          {task.status === 'COMPLETED' && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center space-x-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Water successfully delivered ({task.deliveryLiters || request?.requestedLiters} Liters verified)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
