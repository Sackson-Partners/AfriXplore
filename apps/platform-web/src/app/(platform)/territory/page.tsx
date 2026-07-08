'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

interface Territory {
  name: string;
  flag: string;
  area: string;
  status: 'owned' | 'selected' | 'available';
}

const TERRITORIES: Territory[] = [
  { name: 'Zambia', flag: '🇿🇲', area: '752,612 km²', status: 'owned' },
  { name: 'DRC', flag: '🇨🇩', area: '2,344,858 km²', status: 'selected' },
];

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    sub: 'Explorer / Prospector',
    price: '$490',
    period: '/month per country',
    features: [
      { text: '1 country territory', included: true },
      { text: '6-month data lag', included: true },
      { text: 'Historical mines browser', included: true },
      { text: '50 target book entries', included: true },
      { text: 'Real-time alerts', included: false },
      { text: 'API access', included: false },
    ],
    badge: null,
  },
  {
    id: 'professional',
    name: 'Professional',
    sub: 'Exploration Companies',
    price: '$1,890',
    period: '/month per region',
    features: [
      { text: '1 region (up to 6 countries)', included: true },
      { text: 'Real-time data', included: true },
      { text: 'Full Target Library', included: true },
      { text: 'API access (GeoJSON)', included: true },
      { text: 'Unlimited alerts', included: true },
      { text: 'Comparable deposit DB', included: true },
      { text: 'White-label', included: false },
    ],
    badge: 'MOST POPULAR',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    sub: 'Major Mining Companies',
    price: 'Custom',
    period: 'contact us',
    features: [
      { text: 'Pan-Africa access', included: true },
      { text: 'White-label platform', included: true },
      { text: 'Raw data feed', included: true },
      { text: 'Dedicated analyst', included: true },
      { text: 'Custom integrations', included: true },
      { text: 'SLA guarantee', included: true },
    ],
    badge: null,
  },
];

export default function TerritoryPage() {
  const isAuthenticated = useAuth();
  const router = useRouter();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('professional');
  const [billingAnnual, setBillingAnnual] = useState(true);
  const [territories, setTerritories] = useState<Territory[]>(TERRITORIES);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current || !isAuthenticated) return;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [22, -5],
      zoom: 2.8,
      attributionControl: false,
    });

    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [isAuthenticated]);

  const removeTerritory = (name: string) => {
    setTerritories((prev) => prev.filter((t) => t.name !== name));
  };

  const monthlyTotal = territories.length * 1890;
  const discount = billingAnnual ? monthlyTotal * 0.2 : 0;
  const finalTotal = monthlyTotal - discount;

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Map */}
      <div className="flex-1 relative">
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-5 h-12 bg-geo-slate/90 backdrop-blur-sm border-b border-geo-steel">
          <h2 className="font-display font-semibold text-sm text-geo-white">Select Territory</h2>
          <p className="text-xs text-geo-mist">Click countries or draw a polygon to select</p>
          <div className="flex gap-2">
            <button className="h-7 px-3 bg-brand-primary/20 border border-brand-primary/40 text-brand-primary rounded-lg text-[11px] font-medium hover:bg-brand-primary/30 transition-colors">
              Draw Polygon
            </button>
            <button className="h-7 px-3 bg-geo-graphite border border-geo-steel text-geo-mist rounded-lg text-[11px] hover:text-geo-cloud transition-colors">
              Clear
            </button>
          </div>
        </div>

        {/* Map container */}
        <div ref={mapContainerRef} className="absolute inset-0 pt-12" />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-geo-slate/90 border border-geo-steel rounded-xl p-3 z-10">
          <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-2">Territory Status</p>
          {[
            { color: 'bg-brand-primary', label: 'Owned' },
            { color: 'bg-geo-white', label: 'Selected' },
            { color: 'bg-geo-mist/40', label: 'Available' },
            { color: 'bg-geo-steel/40', label: 'Enterprise only' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-sm ${color}`} />
              <span className="text-[11px] text-geo-cloud">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Purchase Panel */}
      <div className="w-[500px] flex-shrink-0 bg-geo-slate border-l border-geo-steel overflow-y-auto scrollbar-hide">
        <div className="p-6 space-y-5">
          {/* Selection Summary */}
          <div>
            <h2 className="font-display font-semibold text-base text-geo-white mb-3">Your Selection</h2>
            <div className="space-y-2">
              {territories.map((t) => (
                <div key={t.name} className="flex items-center justify-between gap-3 px-4 py-3 bg-geo-graphite rounded-xl border border-geo-steel">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{t.flag}</span>
                    <div>
                      <p className="text-sm font-semibold text-geo-white">{t.name}</p>
                      <p className="text-[11px] text-geo-mist">{t.area}</p>
                    </div>
                    {t.status === 'owned' && (
                      <span className="text-[10px] bg-brand-primary/20 text-brand-primary px-2 py-0.5 rounded font-semibold">OWNED</span>
                    )}
                    {t.status === 'selected' && (
                      <span className="text-[10px] bg-signal-medium/20 text-signal-medium px-2 py-0.5 rounded font-semibold">NEW</span>
                    )}
                  </div>
                  <button onClick={() => removeTerritory(t.name)}
                    className="text-geo-steel hover:text-signal-critical transition-colors text-lg leading-none">
                    ×
                  </button>
                </div>
              ))}
              <button className="text-[11px] text-brand-primary hover:underline">+ Add another territory</button>
            </div>
          </div>

          {/* Plan selector */}
          <div>
            <h3 className="font-display font-semibold text-sm text-geo-white mb-3">Select Plan</h3>
            <div className="space-y-3">
              {PLANS.map((plan) => (
                <div
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.id)}
                  className={`relative rounded-xl border p-4 cursor-pointer transition-all ${
                    selectedPlan === plan.id
                      ? 'border-brand-primary bg-brand-primary/5'
                      : 'border-geo-steel bg-geo-graphite hover:border-geo-mist'
                  }`}
                >
                  {plan.badge && (
                    <span className="absolute top-3 right-3 text-[10px] font-bold bg-signal-low/20 text-signal-low px-2 py-0.5 rounded">
                      {plan.badge}
                    </span>
                  )}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="font-display font-semibold text-sm text-geo-white">{plan.name}</p>
                      <p className="text-[11px] text-geo-mist">{plan.sub}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-lg text-geo-white">{plan.price}</p>
                      <p className="text-[10px] text-geo-mist">{plan.period}</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {plan.features.map((f) => (
                      <div key={f.text} className="flex items-center gap-2">
                        <span className={`text-sm ${f.included ? 'text-signal-low' : 'text-geo-steel line-through'}`}>
                          {f.included ? '✓' : '✗'}
                        </span>
                        <span className={`text-[11px] ${f.included ? 'text-geo-cloud' : 'text-geo-steel line-through'}`}>
                          {f.text}
                        </span>
                      </div>
                    ))}
                  </div>
                  {plan.id === 'enterprise' && (
                    <button className="mt-3 w-full h-8 border border-geo-steel rounded-lg text-xs text-geo-cloud hover:bg-geo-steel transition-colors">
                      Contact Sales →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Order summary */}
          <div className="bg-geo-graphite rounded-xl border border-geo-steel p-4">
            <div className="space-y-2 mb-3">
              {territories.map((t) => (
                <div key={t.name} className="flex items-center justify-between text-xs">
                  <span className="text-geo-mist">{t.name} — Professional</span>
                  <span className="font-mono text-geo-cloud">$1,890</span>
                </div>
              ))}
              <div className="h-px bg-geo-steel my-2" />
              <div className="flex items-center justify-between text-xs">
                <span className="text-geo-mist">Subtotal</span>
                <span className="font-mono text-geo-cloud">${monthlyTotal.toLocaleString()}</span>
              </div>
              {billingAnnual && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-signal-low">Annual discount (20%)</span>
                  <span className="font-mono text-signal-low">−${discount.toLocaleString()}</span>
                </div>
              )}
              <div className="h-px bg-geo-steel my-2" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-geo-white">Total / month</span>
                <span className="font-mono font-bold text-lg text-geo-white">${finalTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Billing toggle */}
            <div className="flex gap-1 bg-geo-slate rounded-lg p-1 mb-4">
              {[
                { label: 'Monthly', value: false },
                { label: 'Annual -20%', value: true },
              ].map(({ label, value }) => (
                <button
                  key={label}
                  onClick={() => setBillingAnnual(value)}
                  className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${
                    billingAnnual === value ? 'bg-brand-primary text-white' : 'text-geo-mist hover:text-geo-cloud'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Checkout button */}
            <button className="w-full h-12 bg-signal-low hover:bg-green-500 text-white rounded-xl text-sm font-bold transition-colors">
              Proceed to Checkout →
            </button>
            <div className="flex items-center justify-center gap-2 mt-2.5">
              <svg className="w-3.5 h-3.5 text-geo-mist" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
              <span className="text-[11px] text-geo-mist">Secured by Stripe · Cancel anytime</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
