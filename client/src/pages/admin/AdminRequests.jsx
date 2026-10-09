import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import {
  Droplet,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Truck,
  Clock,
  Filter,
  Check,
  Search,
  Radio,
  Sparkles,
} from 'lucide-react';

export default function AdminRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  // Recommendation modal state
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [assigningVehicleId, setAssigningVehicleId] = useState(null);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const idOf = (value) => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    return value._id || value.id || undefined;
  };

  const fetchRequests = async () => {
    try {
      const res = await api.get('/requests', {
        severity: severityFilter || undefined,
        status: statusFilter || undefined,
        limit: 50,
      });
      setRequests(res.data || []);
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    const socket = getSocket();
    if (socket) {
      socket.on('request:created', () => fetchRequests());
      socket.on('request:updated', () => fetchRequests());
      socket.on('request:status', () => fetchRequests());
      socket.on('task:assigned', () => fetchRequests());
      socket.on('task:status', () => fetchRequests());
    }
  }, [severityFilter, statusFilter]);

  const handleApprove = async (id) => {
    try {
      setActionError('');
      await api.post(`/requests/${id}/approve`);
      fetchRequests();
      showSuccessBanner('Request approved. Ready for vehicle assignment.');
    } catch (err) {
      setActionError(err.message || 'Failed to approve request');
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    try {
      setActionError('');
      await api.post(`/requests/${rejectTarget._id}/reject`, {
        reason: rejectReason.trim() || 'Invalid or duplicate request',
      });
      setRejectTarget(null);
      setRejectReason('');
      fetchRequests();
      showSuccessBanner('Request rejected.');
    } catch (err) {
      setActionError(err.message || 'Failed to reject request');
    }
  };

  const openAssignModal = async (req) => {
    setSelectedRequest(req);
    setModalLoading(true);
    setRecommendations([]);
    setActionError('');
    try {
      const res = await api.get(`/tasks/recommendations/${req._id}`);
      setRecommendations(res.data || []);
    } catch (err) {
      setActionError(err.message || 'Failed to load tanker recommendations');
    } finally {
      setModalLoading(false);
    }
  };

  const handleAssignTanker = async (candidate) => {
    if (!selectedRequest) return;
    const vehicleId = idOf(candidate.vehicleId);
    const driverId = idOf(candidate.driverId);
    const requestId = idOf(selectedRequest._id);
    if (!vehicleId || !requestId) {
      setActionError('Missing vehicle or request id for dispatch');
      return;
    }
    setAssigningVehicleId(vehicleId);
    setActionError('');
    try {
      const payload = { requestId, vehicleId };
      if (driverId) payload.driverId = driverId;
      await api.post('/tasks', payload);
      setSelectedRequest(null);
      fetchRequests();
      showSuccessBanner(`Dispatched Tanker ${candidate.vehicleNumber} to ${selectedRequest.address}!`);
    } catch (err) {
      setActionError(err.message || 'Failed to assign tanker');
    } finally {
      setAssigningVehicleId(null);
    }
  };

  const showSuccessBanner = (msg) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(''), 4500);
  };

  const filteredRequests = requests.filter((r) => {
    if (search) {
      const q = search.toLowerCase();
      return (
        r.address?.toLowerCase().includes(q) ||
        r.citizenId?.name?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-command-900 border border-command-800 p-4 rounded-xl">
        <div>
          <h1 className="text-xl font-bold font-mono text-white flex items-center space-x-2">
            <Droplet className="w-5 h-5 text-cyan-400" />
            <span>WATER SCARCITY INCIDENT TRIAGE</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Validate community shortages, assess priority scores, and assign optimal tankers.
          </p>
        </div>

        {/* Global notification banner */}
        {actionSuccess && (
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionSuccess}</span>
          </div>
        )}
        {actionError && !selectedRequest && !rejectTarget && (
          <div className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/40 text-red-300 text-xs font-mono">
            {actionError}
          </div>
        )}
      </div>

      {/* Filters & Search Bar */}
      <div className="glass-panel p-4 rounded-xl flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search area, citizen..."
              className="w-full bg-command-900 border border-command-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Severity filter */}
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-command-900 border border-command-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="">All Severities</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="HIGH">HIGH</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="LOW">LOW</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-command-900 border border-command-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="EN_ROUTE">EN ROUTE</option>
            <option value="COMPLETED">COMPLETED</option>
          </select>
        </div>

        <div className="text-xs font-mono text-slate-400">
          Showing <span className="text-cyan-400 font-bold">{filteredRequests.length}</span> requests
        </div>
      </div>

      {/* Requests Table */}
      <div className="glass-panel rounded-xl overflow-hidden border border-command-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-command-900/90 text-slate-400 font-mono uppercase text-[11px] border-b border-command-800">
              <tr>
                <th className="px-4 py-3">Location & Landmark</th>
                <th className="px-4 py-3">Citizen Contact</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Demand (Liters)</th>
                <th className="px-4 py-3">Priority Score</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Triage Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-command-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-slate-500 font-mono">
                    Loading requests telemetry...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-12 text-center text-slate-500 font-mono">
                    No requests found matching criteria
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => (
                  <tr key={req._id} className="hover:bg-command-850/60 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-white">{req.address}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-xs">{req.description}</div>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-300">
                      <div>{req.citizenId?.name || 'Citizen'}</div>
                      <div className="text-[10px] text-slate-500">{req.citizenId?.phone}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                          req.severity === 'CRITICAL'
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse'
                            : req.severity === 'HIGH'
                            ? 'bg-orange-500/20 text-orange-400'
                            : req.severity === 'MEDIUM'
                            ? 'bg-amber-500/20 text-amber-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}
                      >
                        {req.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-bold text-cyan-300">
                      {req.requestedLiters?.toLocaleString()} L
                      <div className="text-[10px] text-slate-500 font-normal">
                        {req.estimatedAffectedPeople} citizens
                      </div>
                    </td>
                    <td className="px-4 py-3.5 font-mono font-extrabold text-amber-400">
                      {req.priorityScore || '--'}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`font-mono text-[10px] px-2 py-0.5 rounded ${
                          req.status === 'PENDING'
                            ? 'bg-yellow-500/15 text-yellow-300'
                            : req.status === 'APPROVED'
                            ? 'bg-blue-500/15 text-blue-300'
                            : req.status === 'ASSIGNED' || req.status === 'EN_ROUTE'
                            ? 'bg-cyan-500/15 text-cyan-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      {req.status === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleApprove(req._id)}
                            className="px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 text-[11px] font-mono transition"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setRejectTarget(req);
                              setRejectReason('');
                              setActionError('');
                            }}
                            className="px-2.5 py-1 rounded bg-red-600/20 hover:bg-red-600/40 text-red-300 border border-red-500/30 text-[11px] font-mono transition"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {['APPROVED', 'PENDING'].includes(req.status) && (
                        <button
                          onClick={() => openAssignModal(req)}
                          className="px-3 py-1 rounded bg-cyan-500 hover:bg-cyan-400 text-command-950 text-[11px] font-bold font-mono transition shadow-glow-cyan inline-flex items-center space-x-1"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Dispatch Tanker</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tanker Recommendation & Assignment Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-command-950/80 backdrop-blur-sm animate-in fade-in">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-xl border border-cyan-500/40 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-command-700 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <h3 className="font-mono font-bold text-white text-base">
                  RECOMMENDED TANKERS FOR DISPATCH
                </h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-mono">
                {actionError}
              </div>
            )}

            {/* Request Summary */}
            <div className="p-3 bg-command-900 rounded-lg border border-command-800 text-xs text-slate-300 space-y-1">
              <div>
                <span className="text-slate-500 font-mono">DESTINATION:</span>{' '}
                <span className="font-bold text-white">{selectedRequest.address}</span>
              </div>
              <div>
                <span className="text-slate-500 font-mono">DEMAND:</span>{' '}
                <span className="text-cyan-300 font-bold">{selectedRequest.requestedLiters?.toLocaleString()} Liters</span> • Severity: {selectedRequest.severity}
              </div>
            </div>

            {/* Recommendations List */}
            {modalLoading ? (
              <div className="text-center py-10 font-mono text-cyan-400 text-xs">
                CALCULATING PROXIMITY & WATER LEVEL MATCHES...
              </div>
            ) : recommendations.length === 0 ? (
              <div className="text-center py-8 text-xs text-amber-400 font-mono space-y-3">
                <div>No currently available tankers with sufficient water capacity.</div>
                <button
                  onClick={async () => {
                    setModalLoading(true);
                    try {
                      const res = await api.get('/vehicles');
                      const list = (res.data || []).map((v) => ({
                        vehicleId: v._id,
                        vehicleNumber: v.vehicleNumber,
                        capacityLiters: v.capacityLiters,
                        currentWaterLevel: v.currentWaterLevel,
                        status: v.status,
                        readiness: 'OVERRIDE',
                        distanceKm: 4.5,
                        etaMinutes: 15,
                        driverId: v.driverId?._id || v.driverId,
                        driverName: v.driverId?.userId?.name || 'Municipal Driver',
                        score: 50,
                      }));
                      setRecommendations(list);
                    } catch (e) {
                      setActionError(e.message || 'Failed to load fleet tankers');
                    } finally {
                      setModalLoading(false);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-command-800 hover:bg-command-700 text-cyan-400 border border-cyan-500/40 text-xs font-mono font-bold"
                >
                  Show All Fleet Tankers (Manual Override)
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* 1-Click Fast Auto-Dispatch Top Candidate Button */}
                {recommendations[0] && (
                  <div className="p-2.5 bg-cyan-950/40 rounded-xl border border-cyan-500/30 flex items-center justify-between">
                    <div className="text-xs text-cyan-300 font-mono flex items-center space-x-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>Recommended: <strong>{recommendations[0].vehicleNumber}</strong> ({recommendations[0].driverName})</span>
                    </div>
                    <button
                      onClick={() => handleAssignTanker(recommendations[0])}
                      disabled={assigningVehicleId === idOf(recommendations[0].vehicleId)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-command-950 font-mono font-bold text-xs transition shadow-glow-cyan"
                    >
                      {assigningVehicleId === idOf(recommendations[0].vehicleId) ? 'Dispatching...' : '⚡ Auto-Dispatch Top Match'}
                    </button>
                  </div>
                )}

                {recommendations.map((cand, idx) => (
                  <div
                    key={idOf(cand.vehicleId) || cand.vehicleNumber}
                    className="p-3.5 rounded-xl bg-command-900/90 border border-command-700 hover:border-cyan-500/60 transition flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white text-sm">
                          {cand.vehicleNumber}
                        </span>
                        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded">
                          Score {cand.score}
                        </span>
                        {idx === 0 && (
                          <span className="text-[10px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                            TOP MATCH
                          </span>
                        )}
                        {cand.readiness && (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                              cand.readiness === 'READY'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : cand.readiness === 'NEEDS_REFILL'
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {cand.readiness}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">
                        Driver: <span className="text-slate-200">{cand.driverName}</span> • Phone:{' '}
                        {cand.driverPhone || 'On Duty'}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400 space-x-3">
                        <span>Distance: <span className="text-cyan-300">{cand.distanceKm} km</span></span>
                        <span>Est. ETA: <span className="text-amber-300">{cand.etaMinutes} min</span></span>
                        <span>Water: <span className="text-cyan-300">{cand.currentWaterLevel?.toLocaleString()}L</span></span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAssignTanker(cand)}
                      disabled={assigningVehicleId === idOf(cand.vehicleId)}
                      className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-command-950 font-mono font-bold text-xs transition shadow-glow-cyan shrink-0"
                    >
                      {assigningVehicleId === idOf(cand.vehicleId) ? 'Dispatching...' : 'Dispatch'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {rejectTarget && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-command-950/80 backdrop-blur-sm">
          <div className="glass-panel p-6 rounded-2xl w-full max-w-md border border-red-500/40 shadow-2xl space-y-4">
            <h3 className="font-mono font-bold text-white text-base">Reject scarcity report</h3>
            <p className="text-xs text-slate-400">
              {rejectTarget.address}
            </p>
            {actionError && (
              <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-mono">
                {actionError}
              </div>
            )}
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection"
              className="w-full bg-command-900 border border-command-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500 min-h-[90px]"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectTarget(null);
                  setRejectReason('');
                }}
                className="px-3 py-1.5 rounded-lg bg-command-800 text-slate-300 text-xs font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-mono font-bold"
              >
                Confirm reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
