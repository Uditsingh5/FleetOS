import React from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from '../../config/env';

export default function ScarcityHeatmap({ hotspots = [], points = [] }) {
  const defaultCenter = [26.4499, 80.3319]; // Kanpur

  return (
    <div className="w-full h-full relative rounded-xl overflow-hidden border border-command-700/80 shadow-2xl dark-map">
      <MapContainer
        center={defaultCenter}
        zoom={12}
        className="w-full h-full min-h-[460px]"
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution={MAP_TILE_ATTRIBUTION}
          url={MAP_TILE_URL}
          maxZoom={19}
        />

        {/* Hotspot aggregated area circles */}
        {hotspots.map((spot, i) => {
          if (!spot.lat || !spot.lng) return null;
          const radius = Math.max(20, Math.min(55, spot.scarcityIndex * 0.5));
          const color =
            spot.scarcityIndex > 70
              ? '#ef4444' // Red
              : spot.scarcityIndex > 45
              ? '#f97316' // Orange
              : '#eab308'; // Yellow

          return (
            <CircleMarker
              key={i}
              center={[spot.lat, spot.lng]}
              radius={radius}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.35,
                weight: 2,
              }}
            >
              <Popup>
                <div className="p-1 min-w-[200px]">
                  <div className="font-bold text-white text-sm border-b border-slate-700 pb-1 mb-2">
                    {spot.area}
                  </div>
                  <div className="space-y-1 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Scarcity Crisis Index:</span>
                      <span className="font-mono font-bold text-red-400">{spot.scarcityIndex} / 100</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Active Shortages:</span>
                      <span className="font-semibold text-cyan-300">{spot.requestCount} requests</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Water Deficit:</span>
                      <span className="font-semibold text-amber-300">{spot.totalRequestedLiters?.toLocaleString()} L</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Affected Citizens:</span>
                      <span className="font-semibold text-slate-200">{spot.totalAffectedPeople?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Heatmap intensity legend */}
      <div className="absolute bottom-3 left-3 bg-command-900/90 border border-command-700 p-3 rounded-lg backdrop-blur-md z-[1000] text-xs font-mono space-y-1.5 shadow-xl pointer-events-none">
        <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Scarcity Density Legend</div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-red-500/80 border border-red-400"></span>
          <span className="text-slate-300">Severe Crisis (&gt;70 Index)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-orange-500/80 border border-orange-400"></span>
          <span className="text-slate-300">Elevated Shortage (45-70)</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-yellow-500/80 border border-yellow-400"></span>
          <span className="text-slate-300">Moderate Shortage (&lt;45)</span>
        </div>
      </div>
    </div>
  );
}
