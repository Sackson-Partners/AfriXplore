'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const PLANS = [
  {
    id: 'scout',
    name: 'Scout',
    tagline: 'Field intelligence for exploration teams',
    priceAnnual: 490,
    priceMonthly: 59,
    color: '#22C55E',
    badge: null,
    features: [
      '5 active exploration zones',
      'Real-time ASM activity heatmaps',
      'Basic mineral signal alerts',
      '7-day data history',
      'CSV export',
      'Email support',
      '1 user seat',
    ],
    cta: 'Start Scout',
    stripePrice: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'Advanced intelligence for active exploration companies',
    priceAnnual: 1890,
    priceMonthly: 229,
    color: '#F59E0B',
    badge: 'Most Popular',
    features: [
      'Unlimited exploration zones',
      'Live ASM miner density feeds',
      'Priority mineral anomaly alerts',
      '90-day data history + trend analysis',
      'GeoJSON / Shapefile export',
      'Drill target prioritisation (DPI scores)',
      'API access (10,000 req/mo)',
      'Slack / webhook integrations',
      '5 user seats + roles',
      'Priority support',
    ],
    cta: 'Start Professional',
    stripePrice: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROFESSIONAL,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Custom intelligence for majors and institutions',
    priceAnnual: null,
    priceMonthly: null,
    color: '#6366F1',
    badge: 'Custom',
    features: [
      'All Professional features',
      'Dedicated country/region data feeds',
      'White-label reporting suite',
      'Custom mineral system modelling',
      'Full data history (10+ years)',
      'GeoSwarm drone integration',
      'Unlimited API access',
      'MSIM deal room & data room',
      'Unlimited seats + SSO/SAML',
      'Dedicated account manager',
      'SLA & custom contracts',
    ],
    cta: 'Contact Sales',
    stripePrice: null,
  },
];

const STATS = [
  { value: '10M+', label: 'Artisanal miners as geological sensors' },
  { value: '34', label: 'African countries covered' },
  { value: '847', label: 'Drill targets identified this quarter' },
  { value: '20K+', label: 'Mine sites digitised' },
];

const LOGOS = ['Ivanhoe Mines', 'First Quantum', 'Anglo American', 'Endeavour Mining', 'Hummingbird'];

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleCTA = async (plan: typeof PLANS[0]) => {
    if (plan.id === 'enterprise') {
      window.location.href = 'mailto:sales@afrixplore.io?subject=Enterprise Enquiry';
      return;
    }

    const priceId = annual ? plan.stripePrice : plan.stripePrice;
    if (!priceId) {
      // Stripe env vars not yet configured — fall through to dashboard
      router.push('/dashboard');
      return;
    }

    setLoading(plan.id);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, planId: plan.id, annual }),
      });

      if (!res.ok) throw new Error('Checkout session failed');
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      setLoading(null);
      alert('Could not start checkout. Please try again.');
    }
  };

  return (
    <main className="min-h-screen bg-[#050810] text-white overflow-x-hidden">

      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(34,197,94,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(34,197,94,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />

      {/* Africa SVG watermark */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-end pr-12 opacity-[0.04]">
        <svg viewBox="0 0 400 500" className="w-[500px]" fill="white">
          <path d="M200 20 C160 25 130 40 110 60 C90 80 80 110 75 130
            C70 150 72 170 68 190 C64 210 55 225 52 245
            C49 265 53 285 58 300 C63 315 72 328 78 345
            C84 362 85 382 95 400 C105 418 122 430 140 445
            C158 460 178 470 200 475 C222 480 242 475 260 465
            C278 455 292 440 305 422 C318 404 326 383 330 362
            C334 341 333 320 336 300 C339 280 348 265 350 245
            C352 225 348 205 342 188 C336 171 325 158 318 142
            C311 126 309 108 298 93 C287 78 270 68 252 55
            C234 42 218 17 200 20Z" />
        </svg>
      </div>

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-amber-500 flex items-center justify-center">
            <span className="text-black font-bold text-xs">AX</span>
          </div>
          <span className="font-semibold text-white tracking-tight">AfriXplore</span>
          <span className="text-xs text-white/30 border border-white/10 rounded px-1.5 py-0.5 ml-1">AIN Scout</span>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm text-white/50 hover:text-white transition-colors"
          >
            Sign in
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-sm bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            Get started
          </button>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-20">

        {/* Hero */}
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-green-400 font-medium">Live across 34 African countries</span>
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold mb-5 tracking-tight leading-tight">
            Africa&apos;s Mineral<br />
            <span className="bg-gradient-to-r from-green-400 via-amber-400 to-orange-400 bg-clip-text text-transparent">
              Intelligence Platform
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-xl mx-auto mb-3">
            Powered by 10M+ artisanal miners as geological sensors.
            Real-time signals. AI-ranked drill targets.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-8 mt-12 mb-4">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <p className="text-3xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-white/40 mt-1 max-w-[120px] mx-auto">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm font-medium ${!annual ? 'text-white' : 'text-white/40'}`}>Monthly</span>
          <button
            onClick={() => setAnnual(!annual)}
            className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${annual ? 'bg-green-500' : 'bg-white/10'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${annual ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
          <span className={`text-sm font-medium ${annual ? 'text-white' : 'text-white/40'}`}>
            Annual
            <span className="ml-2 text-xs bg-green-500/20 text-green-400 border border-green-500/30 rounded-full px-2 py-0.5">
              Save 30%
            </span>
          </span>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {PLANS.map((plan) => {
            const price = annual ? plan.priceAnnual : plan.priceMonthly;
            const isPopular = plan.badge === 'Most Popular';

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-[1px] transition-transform duration-200 hover:-translate-y-1 ${
                  isPopular
                    ? 'bg-gradient-to-b from-amber-500/50 to-amber-500/10'
                    : 'bg-white/5'
                }`}
              >
                <div className="relative h-full bg-[#0C1018] rounded-2xl p-7 flex flex-col">
                  {/* Badge */}
                  {plan.badge && (
                    <div
                      className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full"
                      style={{ backgroundColor: plan.color, color: '#000' }}
                    >
                      {plan.badge}
                    </div>
                  )}

                  {/* Header */}
                  <div className="mb-6">
                    <div className="w-9 h-9 rounded-lg mb-4 flex items-center justify-center" style={{ backgroundColor: `${plan.color}20`, border: `1px solid ${plan.color}40` }}>
                      <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: plan.color }} />
                    </div>
                    <h2 className="text-lg font-bold text-white">{plan.name}</h2>
                    <p className="text-xs text-white/40 mt-1">{plan.tagline}</p>
                  </div>

                  {/* Price */}
                  <div className="mb-6">
                    {price !== null ? (
                      <>
                        <div className="flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-white">${price.toLocaleString()}</span>
                          <span className="text-white/40 text-sm">/{annual ? 'yr' : 'mo'}</span>
                        </div>
                        {annual && (
                          <p className="text-xs text-white/30 mt-1">
                            ${Math.round(price / 12).toLocaleString()}/month billed annually
                          </p>
                        )}
                      </>
                    ) : (
                      <div>
                        <p className="text-3xl font-bold text-white">Custom</p>
                        <p className="text-xs text-white/30 mt-1">Tailored to your portfolio</p>
                      </div>
                    )}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleCTA(plan)}
                    disabled={loading === plan.id}
                    className="w-full py-3 rounded-xl text-sm font-semibold transition-all duration-150 mb-7 disabled:opacity-60"
                    style={isPopular ? {
                      backgroundColor: plan.color,
                      color: '#000',
                    } : {
                      border: `1px solid ${plan.color}40`,
                      color: plan.color,
                      backgroundColor: `${plan.color}10`,
                    }}
                  >
                    {loading === plan.id ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                        Redirecting...
                      </span>
                    ) : plan.cta}
                  </button>

                  {/* Divider */}
                  <div className="border-t border-white/5 mb-6" />

                  {/* Features */}
                  <ul className="space-y-3 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none">
                          <circle cx="8" cy="8" r="7" stroke={plan.color} strokeOpacity="0.3" />
                          <path d="M5 8l2 2 4-4" stroke={plan.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="text-sm text-white/60">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>

        {/* Trusted by */}
        <div className="text-center mb-16">
          <p className="text-xs text-white/25 uppercase tracking-widest mb-6">Trusted by leading exploration companies</p>
          <div className="flex flex-wrap justify-center gap-8">
            {LOGOS.map((name) => (
              <span key={name} className="text-sm text-white/20 font-medium">{name}</span>
            ))}
          </div>
        </div>

        {/* FAQ strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          {[
            { q: 'Can I switch plans later?', a: 'Yes. Upgrade or downgrade at any time. Prorated billing is applied automatically.' },
            { q: 'Is there a free trial?', a: 'Scout plan includes a 14-day free trial. No credit card required to start.' },
            { q: 'How is data sourced?', a: 'We aggregate signals from ASM networks, satellite imagery, and geological survey databases across 34 countries.' },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white/[0.02] border border-white/5 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-white mb-2">{q}</h3>
              <p className="text-sm text-white/40 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center bg-gradient-to-br from-green-900/20 to-amber-900/10 border border-green-500/10 rounded-2xl px-8 py-14">
          <h2 className="text-3xl font-bold text-white mb-3">Ready to discover Africa&apos;s next deposit?</h2>
          <p className="text-white/40 mb-8 max-w-md mx-auto">Join exploration companies using real-time intelligence to find the signals others miss.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-green-500 hover:bg-green-400 text-black font-semibold px-8 py-3 rounded-xl transition-colors"
            >
              Start free trial
            </button>
            <button
              onClick={() => { window.location.href = 'mailto:sales@afrixplore.io?subject=Demo Request'; }}
              className="border border-white/10 text-white/70 hover:text-white px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Book a demo →
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-green-500 to-amber-500 flex items-center justify-center">
              <span className="text-black font-bold text-[9px]">AX</span>
            </div>
            <span className="text-sm text-white/30">AfriXplore · AIN Scout</span>
          </div>
          <div className="flex items-center gap-6">
            <span className="text-xs text-white/20">Annual billing · USD</span>
            <span className="text-xs text-white/20">Privacy Policy</span>
            <span className="text-xs text-white/20">Terms of Service</span>
          </div>
        </div>
      </div>
    </main>
  );
}
