import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Droplet, AlertTriangle, MapPin, Users, Send, CheckCircle2 } from 'lucide-react';

const KANPUR_PRESETS = [
  { name: 'Kakadeo, Kanpur', lat: 26.4770, lng: 80.2925 },
  { name: 'Shastri Nagar, Kanpur', lat: 26.4712, lng: 80.3065 },
  { name: 'Swaroop Nagar, Kanpur', lat: 26.4855, lng: 80.3235 },
  { name: 'Govind Nagar, Kanpur', lat: 26.4410, lng: 80.3050 },
  { name: 'Kidwai Nagar, Kanpur', lat: 26.4320, lng: 80.3390 },
  { name: 'Kalyanpur, Kanpur', lat: 26.4985, lng: 80.2580 },
  { name: 'Barra, Kanpur', lat: 26.4250, lng: 80.3120 },
  { name: 'Panki, Kanpur', lat: 26.4620, lng: 80.2450 },
  { name: 'Naubasta, Kanpur', lat: 26.4150, lng: 80.3380 },
  { name: 'Civil Lines, Kanpur', lat: 26.4750, lng: 80.3450 },
];

export default function CitizenReportRequest() {
  const navigate = useNavigate();
  const [selectedArea, setSelectedArea] = useState(KANPUR_PRESETS[0]);
  const [streetAddress, setStreetAddress] = useState('');
  const [severity, setSeverity] = useState('HIGH');
  const [liters, setLiters] = useState(3000);
  const [people, setPeople] = useState(45);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleAreaChange = (e) => {
    const area = KANPUR_PRESETS.find((a) => a.name === e.target.value) || KANPUR_PRESETS[0];
    setSelectedArea(area);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const fullAddress = streetAddress ? `${streetAddress}, ${selectedArea.name}` : selectedArea.name;
      await api.post('/requests', {
        address: fullAddress,
        location: { lat: selectedArea.lat, lng: selectedArea.lng },
        severity,
        requestedLiters: Number(liters),
        estimatedAffectedPeople: Number(people),
        description: description || 'Water scarcity relief needed.',
      });

      navigate('/citizen/requests');
    } catch (err) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="glass-panel p-6 rounded-xl space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-white flex items-center space-x-2">
          <Droplet className="w-5 h-5 text-cyan-400" />
          <span>Report a water shortage</span>
        </h1>
        <p className="text-xs text-slate-400">
          Tell us where water is needed and how many people are affected.
        </p>
      </div>

      <div className="glass-panel p-6 md:p-8 rounded-2xl border border-command-800 shadow-xl">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/15 border border-red-500/40 text-red-300 text-xs">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {/* Kanpur Area Preset Selector */}
          <div>
            <label className="block text-slate-300 font-mono mb-1.5 font-medium">
              Kanpur Neighborhood / Ward
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <select
                value={selectedArea.name}
                onChange={handleAreaChange}
                className="w-full bg-command-900 border border-command-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 font-mono"
              >
                {KANPUR_PRESETS.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Detailed Street Address / Landmark */}
          <div>
            <label className="block text-slate-300 font-mono mb-1.5 font-medium">
              Detailed Street Address, Building or Landmark
            </label>
            <input
              type="text"
              required
              placeholder="e.g. House 42, Lane 3, Near Water Tank & Community Centre"
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              className="w-full bg-command-900 border border-command-700 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-cyan-500 placeholder-slate-600"
            />
          </div>

          {/* Severity Radio Buttons */}
          <div>
            <label className="block text-slate-300 font-mono mb-2 font-medium">
              Crisis Severity Assessment
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { level: 'CRITICAL', label: 'Critical Crisis', desc: 'No drinking water for >24 hrs' },
                { level: 'HIGH', label: 'Severe Depletion', desc: 'Running out within hours' },
                { level: 'MEDIUM', label: 'Moderate Need', desc: 'Low pressure / partial supply' },
                { level: 'LOW', label: 'Routine Top-up', desc: 'Scheduled maintenance need' },
              ].map((s) => (
                <button
                  type="button"
                  key={s.level}
                  onClick={() => setSeverity(s.level)}
                  className={`p-3 rounded-xl border text-left transition ${
                    severity === s.level
                      ? s.level === 'CRITICAL'
                        ? 'bg-red-500/20 border-red-500 text-red-300 shadow-glow-red'
                        : 'bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-glow-cyan'
                      : 'bg-command-900 border-command-800 text-slate-400 hover:border-command-700'
                  }`}
                >
                  <div className="font-mono font-bold text-xs">{s.label}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{s.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Liters & People Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-mono mb-1.5 font-medium">
                Requested Volume (Liters)
              </label>
              <input
                type="number"
                required
                min="500"
                max="25000"
                step="500"
                value={liters}
                onChange={(e) => setLiters(e.target.value)}
                className="w-full bg-command-900 border border-command-700 rounded-lg p-2.5 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              <div className="flex gap-1.5 mt-1.5 text-[10px] font-mono">
                {[1000, 2500, 5000, 10000].map((v) => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setLiters(v)}
                    className="px-2 py-0.5 rounded bg-command-850 hover:bg-command-800 text-slate-400 hover:text-white border border-command-700"
                  >
                    {v}L
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-mono mb-1.5 font-medium">
                Estimated Affected Citizens
              </label>
              <div className="relative">
                <Users className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="number"
                  required
                  min="1"
                  max="5000"
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                  className="w-full bg-command-900 border border-command-700 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-slate-300 font-mono mb-1.5 font-medium">
              Incident Context & Medical / Vulnerability Needs
            </label>
            <textarea
              rows="3"
              placeholder="e.g. Community clinic with elderly citizens out of potable water, borewell contaminated..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-command-900 border border-command-700 rounded-lg p-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500"
            ></textarea>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold font-mono text-sm transition shadow-glow-cyan flex items-center justify-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Transmitting Incident Report...' : 'Transmit Report to Dispatch Command'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
