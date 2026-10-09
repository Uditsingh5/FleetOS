import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import ScarcityHeatmap from '../../components/map/ScarcityHeatmap';
import { Flame, AlertTriangle, Droplets, Users } from 'lucide-react';

export default function AdminScarcityMap() {
  const [data, setData] = useState({ hotspots: [], points: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHeatmap = async () => {
      try {
        const res = await api.get('/analytics/scarcity');
        setData(res.data || { hotspots: [], points: [] });
      } catch (err) {
        console.error('Failed to load scarcity map data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchHeatmap();
  }, []);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-command-900 border border-command-800 p-4 rounded-xl">
        <div>
          <h1 className="text-xl font-bold font-mono text-white flex items-center space-x-2">
            <Flame className="w-5 h-5 text-red-500" />
            <span>KANPUR WATER SCARCITY DENSITY HEATMAP</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Geographic vulnerability clustering and algorithmic water deficit assessment across municipal wards.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Heatmap Visualizer (2 cols) */}
        <div className="lg:col-span-2 glass-panel p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono uppercase text-slate-400 font-bold">
              Municipal Sector Intensity Map
            </div>
            <div className="text-xs font-mono text-cyan-400">
              Hotspots Analyzed: {data.hotspots?.length || 0}
            </div>
          </div>
          <div className="h-[480px] w-full rounded-lg overflow-hidden border border-command-800">
            <ScarcityHeatmap hotspots={data.hotspots} points={data.points} />
          </div>
        </div>

        {/* Hotspot Ranking List (1 col) */}
        <div className="glass-panel p-4 rounded-xl space-y-3 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold font-mono text-white uppercase tracking-wider border-b border-command-800 pb-2 mb-3">
              Sector Crisis Vulnerability Index
            </h2>

            <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
              {data.hotspots?.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-500 font-mono">
                  No active cluster data available
                </div>
              ) : (
                data.hotspots.map((spot, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg bg-command-900 border border-command-800 hover:border-cyan-500/40 transition space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{spot.area}</span>
                      <span
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                          spot.scarcityIndex > 70
                            ? 'bg-red-500/20 text-red-400'
                            : spot.scarcityIndex > 45
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-yellow-500/20 text-yellow-400'
                        }`}
                      >
                        Index: {spot.scarcityIndex} / 100
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 font-mono pt-1">
                      <div>
                        <span className="text-slate-500">Deficit:</span>{' '}
                        <span className="text-cyan-300 font-semibold">{spot.totalRequestedLiters?.toLocaleString()}L</span>
                      </div>
                      <div>
                        <span className="text-slate-500">Citizens:</span>{' '}
                        <span className="text-slate-200">{spot.totalAffectedPeople?.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
