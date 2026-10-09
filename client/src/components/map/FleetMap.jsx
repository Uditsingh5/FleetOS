import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Truck, Droplet, Navigation, Clock, Shield, CheckCircle2, AlertTriangle, Battery, Phone } from 'lucide-react';
import { getRoadRoute } from '../../utils/routeHelper';
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../../config/env';

// ---- UBER-INSPIRED LEAFLET MARKERS ----

/**
 * Uber-style sleek vehicle puck marker with live heading rotation & vehicle tag pill
 */
const createUberVehicleMarker = (vehicle) => {
  const status = vehicle.status || 'AVAILABLE';
  const isStale = vehicle.isStale;
  const isDemo = vehicle.isDemo;
  const heading = vehicle.heading || 0;

  const color = isStale
    ? '#94a3b8'
    : status === 'EN_ROUTE'
    ? '#00f2fe'
    : status === 'DELIVERING'
    ? '#fbbf24'
    : '#10b981';

  const glowColor = isStale ? 'rgba(148, 163, 184, 0.4)' : status === 'EN_ROUTE' ? 'rgba(0, 242, 254, 0.5)' : 'rgba(16, 185, 129, 0.5)';

  const html = `
    <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
      <!-- Floating Uber-style Tag Pill -->
      <div style="
        position: absolute;
        top: -26px;
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        background: rgba(9, 13, 22, 0.92);
        border: 1px solid ${color}80;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
        border-radius: 9999px;
        padding: 2px 7px;
        font-family: monospace;
        font-size: 10px;
        font-weight: 700;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 4px;
        z-index: 10;
        pointer-events: none;
      ">
        <span style="color: ${color};">●</span>
        <span>${vehicle.vehicleNumber || 'TANKER'}</span>
        ${isDemo ? '<span style="background: #0284c7; color: #fff; font-size: 8px; padding: 0 3px; border-radius: 3px;">DEMO</span>' : ''}
      </div>

      <!-- Pulse Halo Wave for Active Tankers -->
      ${
        status === 'EN_ROUTE' || status === 'DELIVERING'
          ? `<div class="uber-radar-ring" style="width: 44px; height: 44px; border: 2px solid ${color};"></div>`
          : ''
      }

      <!-- Main Rotating Puck -->
      <div style="
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: #090d16;
        border: 2px solid ${color};
        box-shadow: 0 0 16px ${glowColor}, 0 6px 12px rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transform: rotate(${heading}deg);
        transition: transform 0.4s ease-out;
      ">
        <!-- Directional Pointer Chevron on Puck Nose -->
        <div style="
          position: absolute;
          top: -6px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 5px solid transparent;
          border-right: 5px solid transparent;
          border-bottom: 7px solid ${color};
          filter: drop-shadow(0 0 3px ${color});
        "></div>

        <!-- Tanker Icon -->
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"></path>
          <path d="M15 18H9"></path>
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14v10Z"></path>
          <circle cx="17" cy="18" r="2"></circle>
          <circle cx="7" cy="18" r="2"></circle>
        </svg>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'uber-vehicle-marker',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

/**
 * Uber-style Destination / Affected Area Marker with pulsing severity radar
 */
const createUberDestinationMarker = (request) => {
  const severity = request.severity || 'MEDIUM';
  const color =
    severity === 'CRITICAL'
      ? '#ef4444'
      : severity === 'HIGH'
      ? '#f97316'
      : severity === 'MEDIUM'
      ? '#06b6d4'
      : '#38bdf8';

  const shortAddr = (request.address || 'Water Drop Area').split(',')[0];

  const html = `
    <div style="position: relative; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center;">
      <!-- Destination Label Pill -->
      <div style="
        position: absolute;
        top: -24px;
        left: 50%;
        transform: translateX(-50%);
        white-space: nowrap;
        background: rgba(9, 13, 22, 0.95);
        border: 1px solid ${color};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
        border-radius: 9999px;
        padding: 2px 8px;
        font-family: monospace;
        font-size: 10px;
        font-weight: 700;
        color: #ffffff;
        z-index: 10;
        pointer-events: none;
      ">
        <span style="color: ${color};">📍</span>
        <span>${shortAddr}</span>
        ${request.requestedLiters ? `<span style="color: ${color}; font-weight: bold;">• ${Number(request.requestedLiters).toLocaleString()}L</span>` : ''}
      </div>

      <!-- Pulse Ripple on Ground -->
      <div class="uber-radar-ring" style="width: 38px; height: 38px; border: 2px solid ${color};"></div>

      <!-- Minimalist Uber Target Pin -->
      <div style="
        width: 28px;
        height: 28px;
        background: #090d16;
        border: 2px solid ${color};
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        box-shadow: 0 0 14px ${color}80, 0 4px 10px rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background: ${color};
          border-radius: 50%;
          transform: rotate(45deg);
          box-shadow: 0 0 6px ${color};
        "></div>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: 'uber-destination-marker',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
};

// Map View auto-fitter & smoother
function MapViewBounds({ bounds, center, zoom }) {
  const map = useMap();
  const hasAutoFitted = useRef(false);
  const previousCenter = useRef(null);

  useEffect(() => {
    if (bounds && bounds.length >= 2 && !hasAutoFitted.current) {
      try {
        map.fitBounds(bounds, { padding: [55, 55], maxZoom: 15, animate: true });
        hasAutoFitted.current = true;
      } catch {
        // non-critical
      }
    }
  }, [bounds, map]);

  useEffect(() => {
    if (!center || !Number.isFinite(center[0]) || !Number.isFinite(center[1])) return;

    const centerChanged =
      !previousCenter.current ||
      Math.abs(previousCenter.current[0] - center[0]) > 0.0005 ||
      Math.abs(previousCenter.current[1] - center[1]) > 0.0005;

    if (centerChanged) {
      map.setView(center, zoom || map.getZoom(), { animate: true });
      previousCenter.current = center;
    }
  }, [center, zoom, map]);

  return null;
}

const toLeafletPosition = (point) => {
  if (Array.isArray(point) && point.length >= 2) {
    return [Number(point[0]), Number(point[1])];
  }
  if (point?.lat != null && point?.lng != null) {
    return [Number(point.lat), Number(point.lng)];
  }
  return null;
};

const normalizeRoutePositions = (positions = []) =>
  positions.map(toLeafletPosition).filter((point) => point && point.every(Number.isFinite));

function AnimatedVehicleMarker({ vehicle, onSelectVehicle, children }) {
  const markerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const targetRef = useRef(null);
  const initialPositionRef = useRef(null);
  const timestampRef = useRef(null);
  const lat = vehicle.currentLocation?.lat;
  const lng = vehicle.currentLocation?.lng;

  useEffect(() => {
    const marker = markerRef.current;
    if (!marker || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;

    const target = L.latLng(lat, lng);
    if (targetRef.current?.equals(target)) return undefined;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

    const start = marker.getLatLng();
    const timestamp = vehicle.lastLocationUpdate
      ? new Date(vehicle.lastLocationUpdate).getTime()
      : Date.now();
    const updateInterval = timestampRef.current ? Math.max(0, timestamp - timestampRef.current) : 0;
    const duration = Math.min(3000, Math.max(250, updateInterval ? updateInterval * 0.85 : 700));
    const startedAt = performance.now();

    if (!start || !Number.isFinite(start.lat) || !Number.isFinite(start.lng)) {
      marker.setLatLng(target);
    } else {
      const animate = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = progress * (2 - progress);
        marker.setLatLng([
          start.lat + (target.lat - start.lat) * eased,
          start.lng + (target.lng - start.lng) * eased,
        ]);
        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(animate);
        } else {
          animationFrameRef.current = null;
        }
      };
      animationFrameRef.current = requestAnimationFrame(animate);
    }

    targetRef.current = target;
    timestampRef.current = timestamp;
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
  }, [lat, lng, vehicle.lastLocationUpdate]);

  useEffect(() => () => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  }, []);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (!initialPositionRef.current) initialPositionRef.current = [lat, lng];

  return (
    <Marker
      ref={markerRef}
      position={initialPositionRef.current}
      icon={createUberVehicleMarker(vehicle)}
      eventHandlers={{ click: () => onSelectVehicle && onSelectVehicle(vehicle) }}
    >
      {children}
    </Marker>
  );
}

export default function FleetMap({
  vehicles = [],
  requests = [],
  activeRoutes = [],
  selectedCenter = null,
  selectedZoom = 13,
  autoFit = true,
  onSelectVehicle,
  onSelectRequest,
}) {
  const defaultCenter = [26.4499, 80.3319]; // Kanpur coordinates
  const [roadRoutes, setRoadRoutes] = useState([]);

  const routeTargets = useMemo(() => {
    const targets = [];

    vehicles.forEach((vehicle) => {
      const assignedWaypoints = vehicle.activeTask?.route?.waypoints;
      if (assignedWaypoints?.length > 1) return;

      const from = vehicle.currentLocation;
      const to = vehicle.activeTask?.request?.location;
      if (
        from?.lat != null &&
        from?.lng != null &&
        to?.lat != null &&
        to?.lng != null &&
        vehicle.activeTask?.status !== 'COMPLETED'
      ) {
        targets.push({
          id: `vehicle-${vehicle._id}`,
          from,
          to,
          label: `${vehicle.vehicleNumber} → ${vehicle.activeTask.request.address || 'Destination'}`,
          eta: vehicle.activeTask.estimatedArrival,
        });
      }
    });

    if (
      targets.length === 0 &&
      vehicles.length === 1 &&
      requests.length === 1 &&
      !vehicles[0].activeTask?.route?.waypoints?.length
    ) {
      const from = vehicles[0].currentLocation;
      const to = requests[0].location;
      if (from?.lat != null && from?.lng != null && to?.lat != null && to?.lng != null) {
        targets.push({
          id: 'vehicle-request',
          from,
          to,
          label: `${vehicles[0].vehicleNumber} → ${requests[0].address || 'Relief Destination'}`,
        });
      }
    }

    return targets;
  }, [vehicles, requests]);
  const routeTargetsKey = useMemo(
    () =>
      routeTargets
        .map(
          (target) =>
            `${target.id}:${target.from.lat.toFixed(4)},${target.from.lng.toFixed(4)}:${target.to.lat.toFixed(4)},${target.to.lng.toFixed(4)}`
        )
        .join('|'),
    [routeTargets]
  );

  useEffect(() => {
    let cancelled = false;

    const loadRoadRoutes = async () => {
      const routes = await Promise.all(
        routeTargets.map(async (target) => {
          const route = await getRoadRoute(target.from, target.to);
          return route.positions.length
            ? { ...target, positions: route.positions, distanceKm: route.distanceKm, durationMin: route.durationMin }
            : null;
        })
      );

      if (!cancelled) setRoadRoutes(routes.filter(Boolean));
    };

    if (routeTargets.length === 0) {
      setRoadRoutes([]);
    } else {
      loadRoadRoutes();
    }

    return () => {
      cancelled = true;
    };
  }, [routeTargetsKey]);

  // Automatically derive route lines if vehicles have active tasks or if activeRoutes is passed
  const derivedRoutes = useMemo(() => {
    const list = [];
    const assignedRouteIds = new Set();

    activeRoutes.forEach((route, index) => {
      const positions = normalizeRoutePositions(route?.positions);
      if (positions.length < 2) return;
      list.push({ ...route, positions });
      if (route.id) assignedRouteIds.add(route.id);
      if (route.vehicleId) assignedRouteIds.add(`vehicle-${String(route.vehicleId)}`);
      else if (index === 0 && vehicles.length === 1) {
        assignedRouteIds.add(`vehicle-${String(vehicles[0]._id)}`);
      }
    });

    vehicles.forEach((vehicle) => {
      const positions = normalizeRoutePositions(vehicle.activeTask?.route?.waypoints);
      if (positions.length < 2) return;
      const id = `vehicle-${String(vehicle._id)}`;
      if (assignedRouteIds.has(id)) return;
      list.push({
        id,
        positions,
        routeId: vehicle.activeTask?.route?.routeId || id,
        color: '#00f2fe',
        label: `${vehicle.vehicleNumber} assigned delivery route`,
      });
      assignedRouteIds.add(id);
    });

    roadRoutes.forEach((route) => {
      if (assignedRouteIds.has(route.id)) return;
      const positions = normalizeRoutePositions(route.positions);
      if (positions.length < 2) return;
      list.push({ ...route, positions, color: '#00f2fe' });
    });

    return list;
  }, [activeRoutes, roadRoutes, routeTargets.length, vehicles]);

  // Compute map bounds to fit both vehicle and destination comfortably
  const mapBounds = useMemo(() => {
    if (!autoFit) return null;
    const points = [];
    vehicles.forEach((v) => {
      if (v.currentLocation?.lat && v.currentLocation?.lng) {
        points.push([v.currentLocation.lat, v.currentLocation.lng]);
      }
    });
    requests.forEach((r) => {
      if (r.location?.lat && r.location?.lng) {
        points.push([r.location.lat, r.location.lng]);
      }
    });
    derivedRoutes.forEach((route) => {
      if (route.positions) {
        route.positions.forEach((p) => points.push(p));
      }
    });
    return points.length >= 2 ? points : null;
  }, [vehicles, requests, derivedRoutes, autoFit]);

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden border border-command-700/80 shadow-2xl bg-command-950">
      <MapContainer
        center={selectedCenter || defaultCenter}
        zoom={selectedZoom}
        className="w-full h-full min-h-[420px]"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution={MAP_TILE_ATTRIBUTION}
          url={MAP_TILE_URL}
          maxZoom={19}
        />

        <MapViewBounds bounds={mapBounds} center={selectedCenter} zoom={selectedZoom} />

        {/* Uber-style Multi-Layer Route Polylines */}
        {derivedRoutes.map((route, i) => (
          <React.Fragment key={route.routeId || route.id || `route-${i}`}>
            {/* Layer 1: Ambient Luminous Glow Underlay */}
            <Polyline
              positions={route.positions}
              pathOptions={{
                color: route.color || '#00f2fe',
                weight: 10,
                opacity: 0.28,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Layer 2: Sharp Solid Core Track */}
            <Polyline
              positions={route.positions}
              pathOptions={{
                color: route.color || '#00f2fe',
                weight: 4.5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Layer 3: Dashed Directional Flow Accent */}
            <Polyline
              positions={route.positions}
              pathOptions={{
                color: '#ffffff',
                weight: 2,
                opacity: 0.8,
                dashArray: '6, 14',
                className: 'uber-route-pulse',
              }}
            />
          </React.Fragment>
        ))}

        {/* Vehicle markers */}
        {vehicles.map((v) => {
          if (!v.currentLocation?.lat || !v.currentLocation?.lng) return null;
          return (
            <AnimatedVehicleMarker
              key={v._id || v.vehicleNumber}
              vehicle={v}
              onSelectVehicle={onSelectVehicle}
            >
              <Popup>
                <div className="p-3 min-w-[230px] font-sans">
                  <div className="flex items-center justify-between border-b border-command-700/80 pb-2 mb-2">
                    <div className="flex items-center space-x-1.5">
                      <Truck className="w-4 h-4 text-cyan-400" />
                      <span className="font-bold text-white font-mono text-sm">{v.vehicleNumber}</span>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                        v.status === 'EN_ROUTE'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : v.status === 'DELIVERING'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Driver</span>
                      <span className="font-semibold text-white">{v.driver?.name || 'Assigned Driver'}</span>
                    </div>

                    {v.driver?.phone && (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-slate-400 flex items-center space-x-1">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>Contact</span>
                        </span>
                        <a href={`tel:${v.driver.phone}`} className="text-cyan-400 hover:underline font-mono">
                          {v.driver.phone}
                        </a>
                      </div>
                    )}

                    {/* Water Level Bar */}
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-slate-400">Water Tank</span>
                        <span className="font-bold text-cyan-300 font-mono">
                          {v.currentWaterLevel?.toLocaleString()} / {v.capacityLiters?.toLocaleString()} L
                        </span>
                      </div>
                      <div className="w-full bg-command-800 h-2 rounded-full overflow-hidden border border-command-700">
                        <div
                          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, Math.round(((v.currentWaterLevel || 0) / (v.capacityLiters || 1)) * 100))}%`,
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* Active Mission Destination */}
                    {v.activeTask?.request && (
                      <div className="bg-command-900/90 p-2.5 rounded-lg border border-cyan-500/30 text-[11px] mt-1 space-y-1">
                        <div className="text-cyan-300 font-bold flex items-center space-x-1">
                          <Navigation className="w-3 h-3 text-cyan-400" />
                          <span>MISSION DESTINATION</span>
                        </div>
                        <div className="text-white font-semibold truncate">
                          {v.activeTask.request.address}
                        </div>
                        {v.activeTask.distanceKm && (
                          <div className="text-slate-400 font-mono text-[10px]">
                            Remaining: {v.activeTask.distanceKm} km
                          </div>
                        )}
                      </div>
                    )}

                    {v.isDemo && (
                      <div className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 p-1 rounded text-center border border-cyan-800">
                        ⚡ LIVE DEMO DRIVER BOT
                      </div>
                    )}
                  </div>
                </div>
              </Popup>
            </AnimatedVehicleMarker>
          );
        })}

        {/* Shortage Request / Affected Destination Markers */}
        {requests.map((r) => {
          if (!r.location?.lat || !r.location?.lng) return null;
          return (
            <Marker
              key={r._id || r.address}
              position={[r.location.lat, r.location.lng]}
              icon={createUberDestinationMarker(r)}
              eventHandlers={{
                click: () => onSelectRequest && onSelectRequest(r),
              }}
            >
              <Popup>
                <div className="p-3 min-w-[230px] font-sans">
                  <div className="flex items-center justify-between border-b border-command-700/80 pb-2 mb-2">
                    <span className="font-bold text-white text-xs truncate max-w-[150px]">{r.address}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                        r.severity === 'CRITICAL'
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : r.severity === 'HIGH'
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      }`}
                    >
                      {r.severity}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Demand</span>
                      <span className="font-bold text-cyan-300 font-mono">
                        {r.requestedLiters?.toLocaleString()} Liters
                      </span>
                    </div>
                    {r.estimatedAffectedPeople && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Affected Citizens</span>
                        <span className="font-semibold text-white">{r.estimatedAffectedPeople} people</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status</span>
                      <span className="font-mono text-[11px] text-amber-300">{r.status}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Uber-Style Map Legend & Live Telemetry Overlay */}
      <div className="absolute bottom-3 left-3 bg-command-900/90 border border-command-700/80 p-3 rounded-xl backdrop-blur-md z-[1000] text-[11px] font-mono space-y-1.5 shadow-2xl pointer-events-none">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex items-center space-x-1.5">
          <Navigation className="w-3.5 h-3.5 text-cyan-400" />
          <span>Fleet Navigation Telemetry</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-glow-cyan"></span>
          <span className="text-slate-300">Active Tanker (En Route)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
          <span className="text-slate-300">Available Tanker (Patrol)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
          <span className="text-slate-300">Incident Area (Water Scarcity)</span>
        </div>
        <div className="flex items-center space-x-2 pt-1 border-t border-command-800">
          <div className="w-4 h-1 bg-cyan-400 rounded-full"></div>
          <span className="text-slate-400 text-[10px]">Real-time Street Route Vector</span>
        </div>
      </div>
    </div>
  );
}
