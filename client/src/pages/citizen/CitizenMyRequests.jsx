import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import { Clock, CheckCircle2, Truck, Droplet, ArrowRight, Radio, AlertCircle } from 'lucide-react';

const STATUS_STEPS = ['PENDING', 'APPROVED', 'ASSIGNED', 'EN_ROUTE', 'DELIVERING', 'COMPLETED'];

export default function CitizenMyRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMyRequests = async () => {
    try {
      const res = await api.get('/requests');
      setRequests(res.data || []);
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyRequests();

    const socket = getSocket();
    if (socket) {
      socket.on('request:status', () => fetchMyRequests());
      socket.on('request:updated', () => fetchMyRequests());
      socket.on('task:assigned', () => fetchMyRequests());
      socket.on('task:status', () => fetchMyRequests());
    }
  }, []);

  const getStepIndex = (status) => {
    if (status === 'ARRIVED') return 3; // roughly en-route / arrived
    const idx = STATUS_STEPS.indexOf(status);
    return idx >= 0 ? idx : 0;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-xl">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white flex items-center space-x-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            <span>My water requests</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Follow approval, dispatch, and delivery status in one place.
          </p>
        </div>

        <Link
          to="/citizen/report"
          className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-command-950 font-semibold text-xs transition self-start sm:self-auto"
        >
          + New Shortage Report
        </Link>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-12 font-mono text-cyan-400 text-xs">
            Loading your requests...
          </div>
        ) : requests.length === 0 ? (
          <div className="glass-panel p-8 text-center rounded-xl border border-command-800 space-y-3">
            <div className="w-12 h-12 rounded-full bg-cyan-500/10 text-cyan-400 flex items-center justify-center mx-auto">
              <Droplet className="w-6 h-6" />
            </div>
            <div className="text-sm font-semibold text-white">No water shortage reports filed yet</div>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              If your residence or colony is experiencing water scarcity, submit an incident report.
            </p>
            <Link
              to="/citizen/report"
              className="inline-block px-4 py-2 bg-cyan-500 text-command-950 font-bold font-mono text-xs rounded-lg mt-2 shadow-glow-cyan"
            >
              Report Water Shortage
            </Link>
          </div>
        ) : (
          requests.map((req) => {
            const currentStepIdx = getStepIndex(req.status);

            return (
              <div key={req._id} className="glass-panel p-5 rounded-xl border border-command-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-command-800 pb-3">
                  <div>
                    <h3 className="font-bold text-white text-sm">{req.address}</h3>
                    <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                      Filed on {new Date(req.createdAt).toLocaleString()} • Demand:{' '}
                      <span className="text-cyan-300 font-bold">{req.requestedLiters?.toLocaleString()} Liters</span>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded self-start sm:self-auto ${
                      req.status === 'COMPLETED'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : req.status === 'EN_ROUTE'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse'
                        : 'bg-command-800 text-slate-300'
                    }`}
                  >
                    STATUS: {req.status}
                  </span>
                </div>

                {/* Visual Progress Stepper */}
                <div className="pt-2">
                  <div className="grid grid-cols-6 gap-1 text-center font-mono text-[9px] uppercase">
                    {STATUS_STEPS.map((step, idx) => {
                      const isPast = idx < currentStepIdx;
                      const isCurrent = idx === currentStepIdx;

                      return (
                        <div key={step} className="space-y-1">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              isPast
                                ? 'bg-cyan-500'
                                : isCurrent
                                ? 'bg-cyan-400 shadow-glow-cyan animate-pulse'
                                : 'bg-command-800'
                            }`}
                          ></div>
                          <span
                            className={`${
                              isCurrent
                                ? 'text-cyan-400 font-bold'
                                : isPast
                                ? 'text-slate-300'
                                : 'text-slate-600'
                            }`}
                          >
                            {step}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Live Tracking shortcut if assigned */}
                {req.assignedTaskId && req.status !== 'COMPLETED' && (
                  <div className="pt-2 flex items-center justify-between bg-command-900/80 p-3 rounded-lg border border-cyan-500/30">
                    <div className="flex items-center space-x-2 text-xs text-cyan-300 font-mono">
                      <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
                      <span>Tanker dispatched & on duty</span>
                    </div>
                    <Link
                      to={`/citizen/tracking?taskId=${
                        req.assignedTaskId._id || req.assignedTaskId
                      }`}
                      className="px-3 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-command-950 font-mono font-bold text-xs transition shadow-glow-cyan flex items-center space-x-1"
                    >
                      <span>Track Tanker Real-time</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
