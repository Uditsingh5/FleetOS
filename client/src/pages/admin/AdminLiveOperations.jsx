import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { getSocket } from '../../services/socket';
import FleetMap from '../../components/map/FleetMap';
import { useModeStore } from '../../store/modeStore';
import {
  Navigation,
  Truck,
  Droplet,
  Radio,
  Clock,
  Battery,
  AlertTriangle,
  RefreshCw,
  Search,
  MapPin,
  Sparkles,
} from 'lucide-react';

export default function AdminLiveOperations() {
  const { mode, isDemo, toggleMode } = useModeStore();
  const [vehicles, setVehicles] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [mapFocus, setMapFocus] = useState(null);
  const [locationResults, setLocationResults] = useState([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [simulationPaused, setSimulationPaused] = useState(false);

  const fetchLiveFleet = async () => {
    try {
      const [fleetRes, reqRes] = await Promise.all([
        api.get('/tracking/fleet', { mode }),
        api.get('/requests', { limit: 50 }),
      ]);
      setVehicles(fleetRes.data || []);
      setRequests((reqRes.data || []).filter((request) => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(request.status)));
    } catch (err) {
      console.error('Failed to load fleet data:', err);
    } finally {
      setLoading(false);
    }
  };

  const setSimulationPauseState = async (action) => {
    try {
      const response = await api.post(`/tracking/simulation/${action}`);
      setSimulationPaused(Boolean(response.data?.isPaused));
    } catch (err) {
      console.error(`Failed to ${action} simulation:`, err);
    }
  };

  useEffect(() => {
    fetchLiveFleet();

    const handleModeChange = () => fetchLiveFleet();
    window.addEventListener('fleetos:mode-change', handleModeChange);

    const socket = getSocket();
    const staleCheckId = setInterval(() => {
      const cutoff = Date.now() - 60000;
      setVehicles((prev) =>
        prev.map((vehicle) => ({
          ...vehicle,
          isStale: vehicle.lastLocationUpdate
            ? new Date(vehicle.lastLocationUpdate).getTime() < cutoff
            : true,
        }))
      );
    }, 5000);
    const handleLocationUpdate = (payload) => {
        // If in real-data mode, filter out demo bots
        if (mode === 'real' && payload.isDemo) return;

        setVehicles((prev) => {
          const index = prev.findIndex((v) => String(v._id) === String(payload.vehicleId));
          if (index >= 0) {
            const terminalTaskStatus = ['COMPLETED', 'CANCELLED', 'FAILED'].includes(payload.taskStatus);
            const updated = {
              ...prev[index],
              currentLocation: { lat: payload.lat, lng: payload.lng },
              heading: payload.heading ?? prev[index].heading,
              lastLocationUpdate: payload.timestamp,
              isStale: false,
              speed: payload.speed,
              batteryLevel: payload.batteryLevel,
              activeTask: terminalTaskStatus
                ? null
                : prev[index].activeTask
                ? {
                    ...prev[index].activeTask,
                    status: payload.taskStatus || prev[index].activeTask.status,
                  }
                : prev[index].activeTask,
            };
            setSelectedVehicle((current) =>
              String(current?._id) === String(payload.vehicleId) ? updated : current
            );
            const copy = [...prev];
            copy[index] = updated;
            return copy;
          } else if (payload.isDemo && mode === 'demo') {
            // New demo vehicle ping
            return [
              ...prev,
              {
                _id: payload.vehicleId,
                vehicleNumber: payload.vehicleNumber,
                status: payload.taskStatus || 'AVAILABLE',
                currentLocation: { lat: payload.lat, lng: payload.lng },
                heading: payload.heading,
                speed: payload.speed,
                isDemo: true,
                driver: { name: payload.driverName },
              },
            ];
          }
          return prev;
        });
      };

    const handleFleetRefresh = () => fetchLiveFleet();
    if (socket) {
      socket.on('connect', fetchLiveFleet);
      socket.on('location:update', handleLocationUpdate);
      socket.on('task:status', handleFleetRefresh);
      socket.on('task:assigned', handleFleetRefresh);
      socket.on('request:updated', handleFleetRefresh);
    }

    return () => {
      window.removeEventListener('fleetos:mode-change', handleModeChange);
      clearInterval(staleCheckId);
      if (socket) {
        socket.off('connect', fetchLiveFleet);
        socket.off('location:update', handleLocationUpdate);
        socket.off('task:status', handleFleetRefresh);
        socket.off('task:assigned', handleFleetRefresh);
        socket.off('request:updated', handleFleetRefresh);
      }
    };
  }, [mode]);

  const filteredVehicles = vehicles.filter((v) => {
    if (filter !== 'ALL' && v.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const numMatch = v.vehicleNumber?.toLowerCase().includes(q);
      const driverMatch = v.driver?.name?.toLowerCase().includes(q);
      return numMatch || driverMatch;
    }
    return true;
  });

  const localSearchResults = search.trim()
    ? [
        ...vehicles
          .filter((v) => {
            const query = search.trim().toLowerCase();
            return (
              v.vehicleNumber?.toLowerCase().includes(query) ||
              v.driver?.name?.toLowerCase().includes(query)
            );
          })
          .map((v) => ({
            id: `vehicle-${v._id}`,
            label: v.vehicleNumber || 'Tanker',
            detail: v.driver?.name ? `Driver: ${v.driver.name}` : 'Vehicle',
            type: 'vehicle',
            vehicle: v,
            center: v.currentLocation ? [v.currentLocation.lat, v.currentLocation.lng] : null,
          })),
        ...requests
          .filter((request) => request.address?.toLowerCase().includes(search.trim().toLowerCase()))
          .map((request) => ({
            id: `request-${request._id}`,
            label: request.address,
            detail: `${request.status || 'Request'}${request.requestedLiters ? ` · ${request.requestedLiters.toLocaleString()} L` : ''}`,
            type: 'request',
            request,
            center: request.location ? [request.location.lat, request.location.lng] : null,
          })),
      ].filter((result) => result.center)
    : [];

  const handleLocationSearch = async (event) => {
    event?.preventDefault();
    const query = search.trim();
    if (!query) return;

    const localResult = localSearchResults[0];
    if (localResult) {
      if (localResult.vehicle) setSelectedVehicle(localResult.vehicle);
      setMapFocus({ center: localResult.center, zoom: 15 });
      setLocationResults([]);
      return;
    }

    setSearchingLocation(true);
    try {
      const params = new URLSearchParams({
        q: `${query}, Kanpur, India`,
        format: 'jsonv2',
        limit: '5',
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      if (!response.ok) throw new Error(`Location search failed with status ${response.status}`);
      const places = await response.json();
      setLocationResults(
        places.map((place) => ({
          id: place.place_id,
          label: place.display_name.split(',').slice(0, 2).join(','),
          detail: place.display_name,
          type: 'location',
          center: [Number(place.lat), Number(place.lon)],
        }))
      );
    } catch (err) {
      console.error('Failed to search map location:', err);
      setLocationResults([]);
    } finally {
      setSearchingLocation(false);
    }
  };

  const selectSearchResult = (result) => {
    if (result.vehicle) setSelectedVehicle(result.vehicle);
    setMapFocus({ center: result.center, zoom: result.type === 'vehicle' ? 15 : 14 });
    setLocationResults([]);
  };
  const selectedMapVehicle = selectedVehicle
    ? vehicles.find((vehicle) => vehicle._id === selectedVehicle._id) || selectedVehicle
    : null;
  const mapVehicles = selectedMapVehicle ? [selectedMapVehicle] : filteredVehicles;
  const selectedRequest = selectedMapVehicle?.activeTask?.request;
  const demoRequests = mapVehicles
    .map((vehicle) => vehicle.activeTask?.request)
    .filter((request) => request?.location);
  const requestsForMap = [
    ...requests,
    ...demoRequests.filter(
      (demoRequest) => !requests.some((request) => request._id === demoRequest._id)
    ),
  ];
  const mapRequests = selectedRequest?.location
    ? [selectedRequest]
    : selectedVehicle
    ? []
    : requestsForMap;
  const selectedRoute = selectedMapVehicle?.activeTask?.route?.waypoints;
  const activeRoutes = selectedRoute?.length
    ? [{ positions: selectedRoute, color: '#00f2fe', label: 'Assigned delivery route' }]
    : [];

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden bg-command-950">
      {/* Left Control Panel */}
      <div className="w-full md:w-96 bg-command-900 border-r border-command-800 flex flex-col h-full shrink-0 z-10">
        {/* Header */}
        <div className="p-4 border-b border-command-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
              <h1 className="font-mono font-bold text-sm text-white uppercase tracking-wider">
                Fleet Radar
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleMode}
                className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition flex items-center space-x-1.5 border ${
                  isDemo
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-glow-cyan'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                }`}
                title="Toggle between Live Demo Simulation Mode and Real Fleet Data"
              >
                <span>{isDemo ? 'Stop Simulation' : 'Simulate Delivery'}</span>
              </button>
              {isDemo && (
                <button
                  onClick={() => setSimulationPauseState(simulationPaused ? 'resume' : 'pause')}
                  className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold text-amber-300 border border-amber-500/50 bg-amber-500/10"
                >
                  {simulationPaused ? 'Resume' : 'Pause'}
                </button>
              )}
              <button
                onClick={fetchLiveFleet}
                className="p-1.5 rounded-lg bg-command-800 text-slate-400 hover:text-cyan-400 border border-command-700 transition"
                title="Refresh Telemetry"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search */}
          <form className="relative" onSubmit={handleLocationSearch}>
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tanker, driver, or location..."
              className="w-full bg-command-950 border border-command-700 rounded-lg pl-8 pr-9 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1.5 p-1 rounded-md text-slate-400 hover:text-cyan-300 hover:bg-command-800"
              aria-label="Search map"
              title="Search map"
            >
              <MapPin className="w-3.5 h-3.5" />
            </button>
            {(localSearchResults.length > 0 || locationResults.length > 0) && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-command-700 bg-command-900 shadow-xl overflow-hidden">
                {[...localSearchResults.slice(0, 4), ...locationResults].map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => selectSearchResult(result)}
                    className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-command-800"
                  >
                    {result.type === 'vehicle' ? (
                      <Truck className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate text-xs text-white">{result.label}</span>
                      <span className="block truncate text-[10px] text-slate-500">{result.detail}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {searchingLocation && (
              <div className="absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border border-command-700 bg-command-900 px-3 py-2 text-[11px] text-slate-400">
                Searching locations...
              </div>
            )}
          </form>

          {/* Filters */}
          <div className="flex items-center space-x-1 font-mono text-[11px] overflow-x-auto pb-1">
            {['ALL', 'AVAILABLE', 'EN_ROUTE', 'DELIVERING'].map((st) => (
              <button
                key={st}
                onClick={() => setFilter(st)}
                className={`px-2 py-1 rounded transition whitespace-nowrap ${
                  filter === st
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                    : 'text-slate-400 hover:bg-command-800'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        {/* Vehicles List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredVehicles.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500 font-mono">
              No tankers matching criteria
            </div>
          ) : (
            filteredVehicles.map((v) => {
              const isSelected = selectedVehicle?._id === v._id;
              const waterPct = v.capacityLiters > 0 ? Math.round((v.currentWaterLevel / v.capacityLiters) * 100) : 0;

              return (
                <div
                  key={v._id}
                  onClick={() => {
                    setSelectedVehicle(v);
                    setMapFocus(null);
                  }}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition ${
                    isSelected
                      ? 'bg-cyan-500/10 border-cyan-500/60 shadow-glow-cyan'
                      : 'bg-command-850/60 border-command-800 hover:border-command-700 hover:bg-command-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-mono font-bold text-white flex items-center space-x-1.5">
                      <Truck className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{v.vehicleNumber}</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                        v.isStale
                          ? 'bg-slate-700 text-slate-300'
                          : v.status === 'EN_ROUTE'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : v.status === 'DELIVERING'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {v.isStale ? 'STALE' : v.status}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300 mb-2">
                    Driver: <span className="text-white font-medium">{v.driver?.name || 'Unassigned'}</span>
                  </div>

                  {/* Water level bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-400">
                      <span>Water Tank: {waterPct}%</span>
                      <span className="text-cyan-400">{v.currentWaterLevel?.toLocaleString()}L</span>
                    </div>
                    <div className="w-full h-1.5 bg-command-950 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 rounded-full transition-all duration-500"
                        style={{ width: `${waterPct}%` }}
                      ></div>
                    </div>
                  </div>

                  {v.activeTask && (
                    <div className="mt-2.5 p-2 bg-command-900/90 rounded border border-command-700/80 text-[11px] text-slate-300">
                      <div className="text-[10px] font-mono text-cyan-400 uppercase font-bold">
                        En Route Destination
                      </div>
                      <div className="truncate text-slate-200 mt-0.5">
                        {v.activeTask.request?.address}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Selected Vehicle Telemetry Drawer */}
        {selectedVehicle && (
          <div className="p-3 bg-command-950 border-t border-command-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-400">
                {selectedVehicle.vehicleNumber} Telemetry
              </span>
              <button
                onClick={() => {
                  setSelectedVehicle(null);
                  setMapFocus(null);
                }}
                className="text-[10px] text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-300">
              <div className="bg-command-900 p-2 rounded border border-command-800">
                <div className="text-slate-500 text-[10px]">COORDINATES</div>
                <div>
                  {selectedVehicle.currentLocation?.lat?.toFixed(4)},{' '}
                  {selectedVehicle.currentLocation?.lng?.toFixed(4)}
                </div>
              </div>
              <div className="bg-command-900 p-2 rounded border border-command-800">
                <div className="text-slate-500 text-[10px]">LAST PING</div>
                <div>
                  {selectedVehicle.lastLocationUpdate
                    ? new Date(selectedVehicle.lastLocationUpdate).toLocaleTimeString()
                    : 'None'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Map Canvas */}
      <div className="flex-1 h-full relative">
        <FleetMap
          vehicles={mapVehicles}
          requests={mapRequests}
          activeRoutes={activeRoutes}
          selectedCenter={
            mapFocus?.center ||
            (selectedVehicle?.currentLocation
              ? [selectedVehicle.currentLocation.lat, selectedVehicle.currentLocation.lng]
              : null)
          }
          selectedZoom={mapFocus?.zoom || (selectedVehicle ? 15 : 12)}
          onSelectVehicle={(v) => setSelectedVehicle(v)}
        />
      </div>
    </div>
  );
}
