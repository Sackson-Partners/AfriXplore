'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// Simplified Africa outline (viewBox "0 0 460 500")
const AFRICA_PATH = `
  M 200,18 L 230,14 L 265,18 L 295,26 L 318,36 L 340,48 L 360,60
  L 378,76 L 390,94 L 396,112 L 392,128 L 396,145 L 402,164
  L 406,184 L 404,206 L 410,228 L 412,252 L 408,274 L 398,296
  L 385,318 L 368,342 L 348,365 L 324,386 L 298,408 L 272,428
  L 245,446 L 220,456 L 195,450 L 168,438 L 140,420 L 112,400
  L 86,376 L 64,348 L 46,318 L 32,287 L 24,255 L 22,222
  L 28,192 L 38,165 L 36,144 L 36,124 L 42,104 L 54,86
  L 68,70 L 86,56 L 108,44 L 132,34 L 158,24 L 180,18 Z
`;

// Drone flight path waypoints [x%, y%] (relative to SVG canvas)
const DRONE_PATH = "M 50,80 C 120,60 200,40 280,55 C 340,65 380,90 420,70 C 460,50 500,30 540,45";

const FEATURES = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    ),
    title: 'Sub-10cm Resolution',
    desc: 'Ultra-high fidelity geophysical data captured by autonomous drone swarms at continental scale.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: 'AI Anomaly Detection',
    desc: 'Machine learning models trained on 50 years of geophysical survey data identify mineral signatures automatically.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: '48hr Turnaround',
    desc: 'From flight plan to interpreted anomaly report in 48 hours. Full data room delivery in 14 days.',
  },
];

export default function LandingPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleAccess = () => {
    setIsLoading(true);
    // TODO: wire MSAL
    router.push('/dashboard');
  };

  return (
    <div className="relative min-h-screen bg-geo-obsidian overflow-hidden flex">
      {/* Background layer */}
      <div className="absolute inset-0 pointer-events-none select-none">
        {/* Africa silhouette */}
        <svg
          className="absolute"
          style={{ right: '-40px', top: '40px', width: '620px', height: '680px', opacity: 0.06 }}
          viewBox="0 0 460 500"
          preserveAspectRatio="xMidYMid meet"
        >
          <path d={AFRICA_PATH} fill="#0EA5E9" />
        </svg>

        {/* Drone flight path animation */}
        <svg
          className="absolute inset-0 w-full h-full"
          xmlns="http://www.w3.org/2000/svg"
          style={{ opacity: 0.18 }}
        >
          <defs>
            <filter id="glow-drone">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Scan grid lines */}
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={i}
              x1="50%" y1={`${8 + i * 7}%`}
              x2="100%" y2={`${8 + i * 7}%`}
              stroke="#0EA5E9"
              strokeWidth="0.5"
              opacity="0.3"
            />
          ))}

          {/* Drone flight path */}
          <path
            d={DRONE_PATH}
            fill="none"
            stroke="#0EA5E9"
            strokeWidth="1.5"
            strokeDasharray="8 4"
            filter="url(#glow-drone)"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="120"
              to="0"
              dur="4s"
              repeatCount="indefinite"
            />
          </path>

          {/* Survey area markers */}
          {[
            { cx: '72%', cy: '32%', r: 18, label: 'ACTIVE' },
            { cx: '85%', cy: '55%', r: 12, label: 'QUEUED' },
            { cx: '78%', cy: '70%', r: 10, label: 'DONE' },
          ].map((m, i) => (
            <g key={i}>
              <circle cx={m.cx} cy={m.cy} r={m.r} fill="#0EA5E9" opacity="0.08" />
              <circle cx={m.cx} cy={m.cy} r={m.r * 0.4} fill="#0EA5E9" opacity="0.4" />
              <circle cx={m.cx} cy={m.cy} r={m.r}>
                <animate attributeName="r" from={m.r} to={m.r * 1.8} dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.3" to="0" dur={`${2 + i * 0.5}s`} repeatCount="indefinite" />
              </circle>
            </g>
          ))}
        </svg>

        {/* Gradient overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, #0A0E14 40%, #0A0E14aa 60%, transparent 80%)' }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-48"
          style={{ background: 'linear-gradient(to top, #0A0E14, transparent)' }}
        />
      </div>

      {/* Left panel */}
      <div className="relative z-10 w-full max-w-[560px] flex flex-col justify-between min-h-screen px-12 py-10">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-drone-primary rounded-xl flex items-center justify-center shadow-glow-drone">
            {/* Drone icon */}
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </div>
          <div>
            <p className="font-display font-bold text-geo-white text-base leading-none">GeoSwarm</p>
            <p className="text-[9px] font-semibold tracking-[0.2em] text-geo-mist uppercase mt-0.5">
              AI-Powered Drone Geophysics
            </p>
          </div>
        </div>

        {/* Headline + CTA */}
        <div className="flex flex-col gap-8 -mt-8">
          <div>
            <h1 className="font-display font-semibold text-4xl text-geo-white leading-tight">
              AI-Powered Drone Geophysics
            </h1>
            <h1 className="font-display font-semibold text-4xl leading-tight text-drone-primary">
              for Africa
            </h1>
            <p className="mt-4 text-sm text-geo-cloud leading-relaxed max-w-sm">
              Deploy autonomous drone swarms for aeromagnetic, gravity, and hyperspectral surveys.
              AI-interpreted anomaly reports in 48 hours.
            </p>
          </div>

          {/* Feature cards */}
          <div className="flex flex-col gap-3 w-full max-w-[420px]">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="flex items-start gap-4 bg-geo-slate/80 border border-geo-steel rounded-xl p-4 animate-fade-in-up"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-drone-primary/10 border border-drone-primary/20 flex items-center justify-center text-drone-primary">
                  {f.icon}
                </div>
                <div>
                  <p className="font-display font-semibold text-sm text-geo-white">{f.title}</p>
                  <p className="text-xs text-geo-mist mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="w-full max-w-[420px]">
            <button
              onClick={handleAccess}
              disabled={isLoading}
              className="w-full h-12 bg-drone-primary hover:bg-drone-dark text-white rounded-xl
                text-sm font-semibold transition-all duration-150 active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-drone-primary/20
                flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              )}
              Access Platform
            </button>
            <p className="text-center text-xs text-geo-mist mt-3">
              No account?{' '}
              <button className="text-drone-primary hover:underline font-medium">
                Request survey quote →
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-geo-steel">
          © 2026 AfriXplore Ltd. All rights reserved. · GeoSwarm v1.0
        </p>
      </div>
    </div>
  );
}
