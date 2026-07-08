'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_GEOSWARM_API_URL ?? 'http://localhost:5003';

const SENSOR_OPTIONS = [
  { id: 'aeromagnetics', label: 'Aeromagnetics', desc: 'Magnetic field anomalies' },
  { id: 'gravity', label: 'Gravity', desc: 'Density contrast mapping' },
  { id: 'hyperspectral', label: 'Hyperspectral', desc: 'Surface mineralogy' },
] as const;

type SensorType = (typeof SENSOR_OPTIONS)[number]['id'];

interface QuoteResult {
  area_km2: number;
  sensor_types: SensorType[];
  base_price_usd: number;
  mobilization_usd: number;
  total_usd: number;
  turnaround_days: number;
}

export default function SurveysPage() {
  const [areakm2, setAreakm2] = useState(100);
  const [selectedSensors, setSelectedSensors] = useState<SensorType[]>(['aeromagnetics']);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  const { data: orders, isLoading: ordersLoading, refetch } = useQuery({
    queryKey: ['survey-orders'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/surveys/orders`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      return res.json() as Promise<{ data: Array<Record<string, unknown>>; total: number }>;
    },
  });

  const toggleSensor = (sensor: SensorType) => {
    setSelectedSensors((prev) =>
      prev.includes(sensor) ? prev.filter((s) => s !== sensor) : [...prev, sensor]
    );
  };

  const calculateQuote = async () => {
    if (!selectedSensors.length) return;
    setIsCalculating(true);
    try {
      const res = await fetch(`${API_URL}/surveys/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ area_km2: areakm2, sensor_types: selectedSensors }),
      });
      if (!res.ok) throw new Error('Quote failed');
      setQuote(await res.json());
    } catch {
      // handle silently
    } finally {
      setIsCalculating(false);
    }
  };

  const placeOrder = async () => {
    if (!quote) return;
    setIsOrdering(true);
    try {
      const res = await fetch(`${API_URL}/surveys/orders`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area_km2: quote.area_km2,
          sensor_types: quote.sensor_types,
          project_name: `Survey Order ${new Date().toLocaleDateString()}`,
          contact_email: 'user@example.com',
        }),
      });
      if (!res.ok) throw new Error('Order failed');
      setOrderSuccess(true);
      setQuote(null);
      refetch();
      setTimeout(() => setOrderSuccess(false), 4000);
    } catch {
      // handle silently
    } finally {
      setIsOrdering(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* Quote Calculator */}
        <div className="bg-geo-slate border border-geo-steel rounded-xl p-5 space-y-5">
          <h2 className="font-display font-semibold text-geo-white text-sm">Survey Quote Calculator</h2>

          {/* Area slider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-geo-cloud uppercase tracking-wide">Survey Area</label>
              <span className="font-mono text-sm text-drone-primary font-semibold">{areakm2} km²</span>
            </div>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={areakm2}
              onChange={(e) => setAreakm2(Number(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-geo-mist mt-1">
              <span>10 km²</span>
              <span>500 km²</span>
            </div>
          </div>

          {/* Sensor checkboxes */}
          <div>
            <p className="text-xs font-medium text-geo-cloud uppercase tracking-wide mb-3">Sensor Types</p>
            <div className="space-y-2">
              {SENSOR_OPTIONS.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                    selectedSensors.includes(s.id)
                      ? 'border-drone-primary/40 bg-drone-primary/5'
                      : 'border-geo-steel bg-geo-graphite hover:border-geo-mist'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="accent-drone-primary"
                    checked={selectedSensors.includes(s.id)}
                    onChange={() => toggleSensor(s.id)}
                  />
                  <div>
                    <p className="text-sm text-geo-white font-medium">{s.label}</p>
                    <p className="text-xs text-geo-mist">{s.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={calculateQuote}
            disabled={isCalculating || !selectedSensors.length}
            className="w-full h-11 bg-drone-primary hover:bg-drone-dark text-white rounded-lg
              text-sm font-semibold transition-all duration-150 active:scale-[0.98]
              disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isCalculating ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : null}
            Calculate Quote
          </button>
        </div>

        {/* Quote Result */}
        <div className="bg-geo-slate border border-geo-steel rounded-xl p-5 flex flex-col">
          <h2 className="font-display font-semibold text-geo-white text-sm mb-5">Quote Result</h2>

          {orderSuccess && (
            <div className="mb-4 bg-scan-green/10 border border-scan-green/30 rounded-lg px-4 py-3 text-sm text-scan-green font-medium">
              Order placed successfully!
            </div>
          )}

          {!quote ? (
            <div className="flex-1 flex items-center justify-center text-center">
              <div>
                <div className="w-12 h-12 rounded-xl bg-geo-graphite border border-geo-steel flex items-center justify-center mx-auto mb-3">
                  <svg className="w-5 h-5 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-geo-mist text-sm">Configure your survey and calculate a quote.</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-geo-mist">Base Price ({quote.area_km2} km²)</span>
                  <span className="font-mono text-geo-cloud">${quote.base_price_usd.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-geo-mist">Mobilization</span>
                  <span className="font-mono text-geo-cloud">${quote.mobilization_usd.toLocaleString()}</span>
                </div>
                <div className="h-px bg-geo-steel my-1" />
                <div className="flex justify-between">
                  <span className="font-semibold text-geo-white">Total</span>
                  <span className="font-mono font-bold text-xl text-drone-primary">${quote.total_usd.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-geo-graphite rounded-lg px-4 py-3 flex items-center gap-3">
                <svg className="w-4 h-4 text-geo-mist flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-geo-cloud">
                  Estimated turnaround: <span className="font-semibold text-geo-white">{quote.turnaround_days} days</span>
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {quote.sensor_types.map((s) => (
                  <span key={s} className="text-[10px] font-semibold uppercase tracking-wide bg-drone-primary/10 border border-drone-primary/20 text-drone-primary rounded-full px-2.5 py-0.5">
                    {s}
                  </span>
                ))}
              </div>

              <button
                onClick={placeOrder}
                disabled={isOrdering}
                className="w-full h-11 bg-scan-green hover:bg-scan-green/80 text-geo-obsidian rounded-lg
                  text-sm font-bold transition-all duration-150 active:scale-[0.98]
                  disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isOrdering ? (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : null}
                Place Order
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-geo-slate border border-geo-steel rounded-xl">
        <div className="px-5 py-4 border-b border-geo-steel">
          <h2 className="font-display font-semibold text-geo-white text-sm">Recent Orders</h2>
        </div>
        <div className="p-5">
          {ordersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-geo-graphite rounded-lg animate-pulse" />)}
            </div>
          ) : !orders?.data.length ? (
            <p className="text-geo-mist text-sm text-center py-6">No orders yet.</p>
          ) : (
            <div className="space-y-2">
              {orders.data.map((o, i) => (
                <div key={String(o.id ?? i)} className="flex items-center justify-between bg-geo-graphite rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm text-geo-white font-medium">{String(o.project_name ?? 'Unnamed')}</p>
                    <p className="text-xs text-geo-mist">
                      {String(o.area_km2 ?? '—')} km² · {String(o.turnaround_days ?? '—')} day turnaround
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm text-scan-green">${Number(o.total_usd ?? 0).toLocaleString()}</p>
                    <span className="text-[10px] font-semibold uppercase tracking-wide bg-geo-steel text-geo-cloud rounded-full px-2 py-0.5">
                      {String(o.status ?? 'pending')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
