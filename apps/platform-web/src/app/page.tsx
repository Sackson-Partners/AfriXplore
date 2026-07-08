'use client';

import { useIsAuthenticated, useMsal } from '@azure/msal-react';
import { loginRequest } from '@/lib/msal-config';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { canBypassAuth } from '@/lib/featureFlags';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function useAuth() {
  const msalAuth = useIsAuthenticated();
  return canBypassAuth() || msalAuth;
}

// Simplified Africa outline path (viewBox "0 0 460 500")
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

// Constellation dots [x, y, opacity, size]
const DOTS: Array<[number, number, number, number]> = [
  [920, 280, 0.8, 3], [960, 310, 0.6, 2], [1000, 260, 0.7, 2.5],
  [1050, 290, 0.5, 2], [1080, 340, 0.9, 3], [1020, 370, 0.6, 2],
  [970, 400, 0.7, 2.5], [940, 440, 0.5, 2], [1000, 450, 0.8, 3],
  [1060, 420, 0.6, 2], [1120, 380, 0.4, 2], [1150, 320, 0.7, 2.5],
  [1180, 270, 0.5, 2], [1140, 240, 0.8, 3], [1100, 210, 0.6, 2],
  [1060, 180, 0.4, 2], [1000, 200, 0.7, 2.5], [940, 220, 0.5, 2],
  [880, 260, 0.6, 2], [870, 320, 0.8, 3], [850, 380, 0.5, 2],
  [880, 430, 0.7, 2.5], [920, 480, 0.4, 2], [980, 500, 0.6, 2],
  [1040, 490, 0.8, 3], [1100, 460, 0.5, 2], [1160, 430, 0.7, 2.5],
  [1200, 400, 0.4, 2], [1220, 350, 0.6, 2], [1210, 300, 0.8, 3],
  [1190, 250, 0.5, 2], [1160, 200, 0.7, 2.5], [1120, 160, 0.4, 2],
  [1070, 150, 0.6, 2], [1020, 160, 0.8, 3], [970, 150, 0.5, 2],
  [920, 180, 0.7, 2.5], [880, 210, 0.4, 2], [840, 250, 0.6, 2],
  [810, 300, 0.8, 3], [820, 360, 0.5, 2], [860, 410, 0.7, 2.5],
];

// Lines connecting pairs of dots [i, j]
const LINES: Array<[number, number]> = [
  [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9],[9,10],
  [10,11],[11,12],[12,13],[13,14],[14,15],[0,18],[18,17],[17,16],
  [16,15],[4,21],[21,22],[22,23],[23,24],[24,25],[25,26],[20,21],
  [19,20],[30,29],[29,28],[28,27],[27,26],[36,37],[37,38],[38,39],
  [39,40],[40,41],[41,42],[35,36],[34,35],[33,34],[32,33],[31,32],
];

const STATS = [
  { value: '20,000', label: 'Mines Targeted', accent: '#F59E0B' },
  { value: '847', label: 'Drill Targets Generated', accent: '#B45309' },
  { value: '34', label: 'Countries Covered', accent: '#1D4ED8' },
];

export default function AuthPage() {
  const isAuthenticated = useAuth();
  const { instance } = useMsal();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, router]);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await instance.loginPopup(loginRequest);
    } catch (e) {
      // User cancelled or error
    } finally {
      setIsLoading(false);
    }
  };

  const handleSSO = async () => {
    setIsLoading(true);
    try {
      await instance.loginPopup({ ...loginRequest, prompt: 'select_account' });
    } catch {
      // cancelled
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthenticated) return null;

  return (
    <div className="relative min-h-screen bg-geo-obsidian overflow-hidden flex">
      {/* ─── Background layer ─── */}
      <div className="absolute inset-0 pointer-events-none select-none">
        {/* Africa silhouette */}
        <svg
          className="absolute"
          style={{ right: '-60px', top: '30px', width: '700px', height: '760px', opacity: 0.07 }}
          viewBox="0 0 460 500"
          preserveAspectRatio="xMidYMid meet"
        >
          <path d={AFRICA_PATH} fill="#D1D5DB" />
        </svg>

        {/* Constellation */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Connection lines */}
          {LINES.map(([i, j], idx) => {
            const a = DOTS[i], b = DOTS[j];
            if (!a || !b) return null;
            return (
              <line
                key={idx}
                x1={a[0]} y1={a[1]}
                x2={b[0]} y2={b[1]}
                stroke="#D1D5DB"
                strokeWidth="0.5"
                opacity="0.08"
              />
            );
          })}
          {/* Dots */}
          {DOTS.map(([x, y, opacity, size], idx) => (
            <circle
              key={idx}
              cx={x} cy={y}
              r={size}
              fill="#D1D5DB"
              opacity={opacity * 0.5}
            />
          ))}
          {/* Mine marker hotspots */}
          {[
            { cx: 1010, cy: 360, color: '#F59E0B', r: 5 }, // Copper Belt
            { cx: 980, cy: 390, color: '#F59E0B', r: 4 },
            { cx: 1040, cy: 350, color: '#F59E0B', r: 6 },
            { cx: 890, cy: 280, color: '#FCD34D', r: 4 },  // West Africa gold
            { cx: 860, cy: 300, color: '#FCD34D', r: 3 },
            { cx: 1090, cy: 400, color: '#34D399', r: 4 }, // East Africa
            { cx: 960, cy: 460, color: '#60A5FA', r: 3 },  // South
          ].map((marker, idx) => (
            <g key={idx}>
              <circle cx={marker.cx} cy={marker.cy} r={marker.r + 4} fill={marker.color} opacity="0.1" />
              <circle cx={marker.cx} cy={marker.cy} r={marker.r} fill={marker.color} opacity="0.6" />
            </g>
          ))}
        </svg>

        {/* Gradient fade from left */}
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(to right, #0A0E14 40%, #0A0E14aa 60%, transparent 80%)' }}
        />
        {/* Bottom fade */}
        <div className="absolute inset-x-0 bottom-0 h-48"
          style={{ background: 'linear-gradient(to top, #0A0E14, transparent)' }}
        />
      </div>

      {/* ─── Left panel ─── */}
      <div className="relative z-10 w-full max-w-[560px] flex flex-col justify-between min-h-screen px-12 py-10">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center shadow-glow-brand">
            <span className="font-display font-bold text-white text-lg">M</span>
          </div>
          <div>
            <p className="font-display font-bold text-geo-white text-base leading-none">MSIM</p>
            <p className="text-[9px] font-semibold tracking-[0.2em] text-geo-mist uppercase mt-0.5">
              Mineral Systems Intelligence
            </p>
          </div>
        </div>

        {/* Headline */}
        <div className="flex flex-col gap-8 -mt-8">
          <div>
            <h1 className="font-display font-semibold text-4xl text-geo-white leading-tight">
              Discover Africa&apos;s
            </h1>
            <h1 className="font-display font-semibold text-4xl leading-tight text-copper-light">
              Hidden Mineral Systems
            </h1>
            <p className="mt-4 text-sm text-geo-cloud leading-relaxed max-w-sm">
              80 years of colonial mining data. Reconstructed, modelled, and ranked
              for modern exploration intelligence.
            </p>
          </div>

          {/* Sign in form */}
          <div className="flex flex-col gap-4 w-full max-w-[400px]">
            {/* Email */}
            <div>
              <label className="block text-xs font-medium text-geo-cloud mb-1.5 tracking-wide">
                Work Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full h-11 px-4 bg-geo-graphite border border-geo-steel rounded-lg
                  text-sm text-geo-cloud placeholder-geo-mist
                  focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30
                  transition-colors"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-medium text-geo-cloud mb-1.5 tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-4 pr-10 bg-geo-graphite border border-geo-steel rounded-lg
                    text-sm text-geo-cloud placeholder-geo-mist
                    focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/30
                    transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-geo-mist hover:text-geo-cloud transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Sign in button */}
            <button
              onClick={handleSignIn}
              disabled={isLoading}
              className="w-full h-11 bg-brand-primary hover:bg-brand-hover text-white rounded-lg
                text-sm font-semibold transition-all duration-150 active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed shadow-md
                flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : null}
              Sign In to Platform
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-geo-steel" />
              <span className="text-xs text-geo-mist px-1">or</span>
              <div className="flex-1 h-px bg-geo-steel" />
            </div>

            {/* SSO button */}
            <button
              onClick={handleSSO}
              disabled={isLoading}
              className="w-full h-11 border border-geo-steel bg-transparent hover:bg-geo-graphite text-geo-cloud rounded-lg
                text-sm font-medium transition-all duration-150 active:scale-[0.98]
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
              Continue with SSO
            </button>

            <p className="text-center text-xs text-geo-mist">
              Don&apos;t have access?{' '}
              <button className="text-brand-primary hover:underline font-medium">
                Request a demo →
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-[10px] text-geo-steel">
          © 2024 AfriXplore Ltd. All rights reserved. · MSIM Platform v2.4
        </p>
      </div>

      {/* ─── Bottom-right stats strip ─── */}
      <div className="absolute bottom-8 right-8 flex items-end gap-3 z-10">
        {STATS.map((stat, i) => (
          <div
            key={i}
            className="w-44 bg-geo-slate/90 backdrop-blur-sm border border-geo-steel rounded-xl p-4 shadow-lg"
            style={{ borderTop: `2px solid ${stat.accent}` }}
          >
            <p className="font-mono font-bold text-2xl text-geo-white leading-none">{stat.value}</p>
            <p className="text-[11px] text-geo-mist mt-1.5 leading-snug">{stat.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
