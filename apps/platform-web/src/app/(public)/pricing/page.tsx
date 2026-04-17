'use client';

import { useState, useTransition } from 'react';
import { createCheckoutSession } from '../../actions/createCheckout';

const TIERS = [
  {
    id: 'starter' as const,
    name: 'Starter',
    price: 25000,
    description: '1 country · 6-month data lag · 50 exports/year',
    features: [
      '1 country coverage',
      'Web dashboard access',
      '6-month data lag',
      '50 exports per year',
      'Email support',
    ],
    color: '#6B7280',
    cta: 'Start Free Trial',
    trial: '14-day free trial',
  },
  {
    id: 'professional' as const,
    name: 'Professional',
    price: 100000,
    description: '1 region · Real-time · API access · 100 req/min',
    features: [
      '1 region (3–5 countries)',
      'Real-time anomaly alerts',
      'Full API access (100 req/min)',
      'MSIM target library',
      '500 exports per year',
      'Webhook subscriptions',
      'Priority support',
    ],
    color: '#F59E0B',
    cta: 'Start Free Trial',
    trial: '30-day free trial',
    highlighted: true,
  },
  {
    id: 'enterprise' as const,
    name: 'Enterprise',
    price: 300000,
    description: 'Pan-Africa · White-label · Raw feed · 1000 req/min',
    features: [
      'Pan-Africa coverage',
      'White-label portal',
      'Raw data feed',
      'API (1000 req/min)',
      'Unlimited exports',
      'SAML SSO',
      'Dedicated CSM',
      'SLA guarantee',
    ],
    color: '#8B5CF6',
    cta: 'Contact Sales',
    trial: 'Custom onboarding',
  },
];

const TERRITORIES = [
  { id: 'drc_zambia',   name: 'DRC / Zambia Copperbelt',  commodity: 'Cu, Co' },
  { id: 'ghana_civ',    name: "Ghana / Côte d'Ivoire",    commodity: 'Au' },
  { id: 'zimbabwe',     name: 'Zimbabwe Great Dyke',       commodity: 'Li, Au, PGM' },
  { id: 'tanzania',     name: 'Tanzania',                  commodity: 'Au, Graphite' },
  { id: 'namibia',      name: 'Namibia',                   commodity: 'U, Cu' },
  { id: 'mali_burkina', name: 'Mali / Burkina Faso',       commodity: 'Au' },
  { id: 'madagascar',   name: 'Madagascar',                commodity: 'Graphite, REE' },
  { id: 'west_africa',  name: 'West Africa (Full)',        commodity: 'Au, Bauxite' },
];

export default function PricingPage() {
  const [isPending, startTransition] = useTransition();
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedTerritories, setSelectedTerritories] = useState<string[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const handleSelectTier = (tierId: string) => {
    setSelectedTier(tierId);
    setShowForm(true);
    setError('');
  };

  const toggleTerritory = (id: string) => {
    setSelectedTerritories((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleCheckout = () => {
    if (!selectedTier || !companyName || !email) {
      setError('Please fill in all fields');
      return;
    }
    if (selectedTerritories.length === 0) {
      setError('Please select at least one territory');
      return;
    }
    startTransition(async () => {
      const result = await createCheckoutSession(
        selectedTier as 'starter' | 'professional' | 'enterprise',
        companyName,
        email,
        selectedTerritories
      );
      if (result.error) {
        setError(result.error);
      } else if (result.url) {
        window.location.href = result.url;
      }
    });
  };

  const activeTier = TIERS.find((t) => t.id === selectedTier);

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-16">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">
            AfriXplore{' '}
            <span className="text-amber-400">Intelligence Platform</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Africa&apos;s only real-time mineral intelligence platform.
            Powered by 10M+ artisanal miners as geological sensors.
          </p>
        </div>

        {/* Pricing Cards */}
        {!showForm && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {TIERS.map((tier) => (
              <div
                key={tier.id}
                className="relative rounded-2xl border p-8 flex flex-col"
                style={{
                  borderColor: tier.highlighted ? tier.color : '#374151',
                  backgroundColor: tier.highlighted ? 'rgba(245,158,11,0.05)' : '#111827',
                }}
              >
                {tier.highlighted && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1
                                rounded-full text-xs font-bold text-black"
                    style={{ backgroundColor: tier.color }}
                  >
                    Most Popular
                  </div>
                )}
                <h2 className="text-xl font-bold mb-2">{tier.name}</h2>
                <div className="mb-2">
                  <span className="text-4xl font-bold">
                    ${(tier.price / 1000).toFixed(0)}K
                  </span>
                  <span className="text-gray-400"> / year</span>
                </div>
                <p className="text-sm text-gray-400 mb-6">{tier.description}</p>
                <ul className="space-y-2 mb-8 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <span className="text-green-400">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleSelectTier(tier.id)}
                  className="w-full py-3 rounded-xl font-bold text-sm transition-all"
                  style={{
                    backgroundColor: tier.highlighted ? tier.color : 'transparent',
                    color: tier.highlighted ? '#000' : tier.color,
                    border: `2px solid ${tier.color}`,
                  }}
                >
                  {tier.cta}
                </button>
                <p className="text-xs text-center text-gray-500 mt-3">{tier.trial}</p>
              </div>
            ))}
          </div>
        )}

        {/* Checkout Form */}
        {showForm && activeTier && (
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => { setShowForm(false); setSelectedTier(null); }}
              className="text-gray-400 hover:text-white mb-8 flex items-center gap-2 text-sm"
            >
              ← Back to pricing
            </button>

            <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">{activeTier.name} Plan</h2>
                <span
                  className="text-sm px-3 py-1 rounded-full"
                  style={{ backgroundColor: `${activeTier.color}20`, color: activeTier.color }}
                >
                  {activeTier.trial}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Company Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acacia Mining Ltd"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl
                               px-4 py-3 text-white placeholder-gray-500
                               focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Work Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="geologist@company.com"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl
                               px-4 py-3 text-white placeholder-gray-500
                               focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm text-gray-400 mb-3">
                  Select Territories{' '}
                  <span className="text-gray-500">(choose regions you need intelligence for)</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {TERRITORIES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTerritory(t.id)}
                      className={`p-3 rounded-xl text-left text-sm border-2 transition-all ${
                        selectedTerritories.includes(t.id)
                          ? 'border-amber-400 bg-amber-400/10 text-white'
                          : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500'
                      }`}
                    >
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs opacity-60">{t.commodity}</div>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm mb-4 bg-red-400/10 px-4 py-3 rounded-xl">
                  {error}
                </p>
              )}

              <button
                onClick={handleCheckout}
                disabled={isPending}
                className="w-full py-4 rounded-xl font-bold text-black transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: activeTier.color }}
              >
                {isPending ? 'Redirecting to Stripe...' : 'Continue to Payment →'}
              </button>

              <p className="text-xs text-center text-gray-500 mt-4">
                Secured by Stripe · Cancel anytime · No credit card required during trial
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
