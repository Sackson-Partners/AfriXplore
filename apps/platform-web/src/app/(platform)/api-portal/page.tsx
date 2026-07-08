'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const ENDPOINTS = [
  {
    method: 'GET',
    path: '/v2/targets',
    description: 'Return ranked drill targets as GeoJSON FeatureCollection',
    params: [
      { name: 'country', type: 'string', required: false, description: 'ISO 3166-1 alpha-2 country code (e.g. "ZM")' },
      { name: 'commodity', type: 'string', required: false, description: 'Commodity code: Cu, Au, Sn, Ni, Co' },
      { name: 'dpi_min', type: 'integer', required: false, description: 'Minimum DPI score (0–100)' },
      { name: 'limit', type: 'integer', required: false, description: 'Max results per page (default: 25, max: 100)' },
      { name: 'offset', type: 'integer', required: false, description: 'Pagination offset' },
      { name: 'format', type: 'string', required: false, description: 'Response format: geojson | csv | shapefile' },
    ],
    curlExample: `curl -X GET \\
  "https://api.msim.io/v2/targets" \\
  -H "Authorization: Bearer msim_live_k8f2j9..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "country": "ZM",
    "commodity": "Cu",
    "dpi_min": 70,
    "limit": 25
  }'`,
    pythonExample: `import requests

response = requests.get(
    "https://api.msim.io/v2/targets",
    headers={"Authorization": "Bearer msim_live_k8f2j9..."},
    json={
        "country": "ZM",
        "commodity": "Cu",
        "dpi_min": 70,
        "limit": 25
    }
)
data = response.json()
print(f"{data['count']} targets found")`,
    jsExample: `const response = await fetch('https://api.msim.io/v2/targets', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer msim_live_k8f2j9...',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    country: 'ZM',
    commodity: 'Cu',
    dpi_min: 70,
    limit: 25,
  }),
});
const data = await response.json();`,
    response: `{
  "type": "FeatureCollection",
  "count": 12,
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [28.6891, -13.2234]
      },
      "properties": {
        "target_id": "ZM-CU-0247",
        "mine_name": "Luanshya NE Extension",
        "dpi_score": 91,
        "commodity": "Cu",
        "priority_rank": 1,
        "drill_status": "ready",
        "target_book_url": "https://api.msim.io/v2/targets/ZM-CU-0247"
      }
    }
  ]
}`,
  },
  {
    method: 'GET',
    path: '/v2/mines/{id}',
    description: 'Retrieve full MSIM card for a specific historical mine',
    params: [
      { name: 'id', type: 'string', required: true, description: 'Mine identifier (e.g. "ZM-CU-0247")' },
      { name: 'include_documents', type: 'boolean', required: false, description: 'Include document vault metadata' },
    ],
    curlExample: `curl "https://api.msim.io/v2/mines/ZM-CU-0247" \\
  -H "Authorization: Bearer msim_live_k8f2j9..."`,
    pythonExample: `response = requests.get(
    "https://api.msim.io/v2/mines/ZM-CU-0247",
    headers={"Authorization": "Bearer msim_live_k8f2j9..."}
)`,
    jsExample: `const mine = await fetch('/v2/mines/ZM-CU-0247', {
  headers: { 'Authorization': 'Bearer ...' }
}).then(r => r.json());`,
    response: `{
  "id": "ZM-CU-0247",
  "name": "Luanshya Mine",
  "country": "ZM",
  "dpi_score": 91,
  "commodity": ["Cu"],
  "system_type": "Sediment-hosted",
  "coordinates": { "lat": -13.2234, "lng": 28.6891 }
}`,
  },
];

const NAV_SECTIONS = [
  { label: 'GETTING STARTED', items: ['Authentication', 'Rate Limits', 'Errors', 'Pagination'] },
  { label: 'ENDPOINTS', items: ['Mines', 'Targets', 'Anomalies', 'Territories', 'Webhooks', 'Analytics'] },
  { label: 'SCHEMAS', items: ['MineCard', 'TargetBook', 'DPIEvent', 'AnomalyReport'] },
];

type LangTab = 'curl' | 'python' | 'js';

export default function APIPortalPage() {
  const isAuthenticated = useAuth();
  const router = useRouter();
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);
  const [langTab, setLangTab] = useState<LangTab>('curl');
  const [expandedEndpoint, setExpandedEndpoint] = useState<number | null>(0);

  useEffect(() => {
    if (!isAuthenticated) router.replace('/');
  }, [isAuthenticated, router]);

  const handleCopy = () => {
    navigator.clipboard.writeText('msim_live_k8f2j9mQnT3pBxZ7vRdW1sA4cE6hK9');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getCode = (endpoint: typeof ENDPOINTS[0]) => {
    if (langTab === 'curl') return endpoint.curlExample;
    if (langTab === 'python') return endpoint.pythonExample;
    return endpoint.jsExample;
  };

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left sidebar */}
      <aside className="w-56 flex-shrink-0 bg-geo-slate border-r border-geo-steel overflow-y-auto scrollbar-hide">
        <div className="p-4 border-b border-geo-steel">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono font-bold text-geo-white text-sm">MSIM API</span>
          </div>
          <span className="text-[10px] bg-geo-graphite text-geo-mist px-2 py-0.5 rounded font-mono">v2.4.1</span>
        </div>
        <nav className="p-3 space-y-4">
          {NAV_SECTIONS.map(({ label, items }) => (
            <div key={label}>
              <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest px-2 mb-1.5">{label}</p>
              {items.map((item) => (
                <button key={item}
                  className="w-full text-left px-2 py-1.5 rounded text-xs text-geo-mist hover:bg-geo-graphite hover:text-geo-cloud transition-colors font-mono">
                  {item}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* API Key banner */}
          <div className="bg-geo-slate border border-geo-steel rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h2 className="font-display font-semibold text-base text-geo-white">API Access</h2>
                <p className="text-xs text-geo-mist mt-0.5">Professional Plan · 10,000 requests/month</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-geo-mist mb-1">6,241 / 10,000 used</p>
                <div className="w-40 h-1.5 bg-geo-graphite rounded-full overflow-hidden">
                  <div className="h-full bg-brand-primary rounded-full" style={{ width: '62.4%' }} />
                </div>
              </div>
            </div>

            {/* Key display */}
            <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-2">Active API Key</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-3 h-10 px-4 bg-geo-graphite border border-geo-steel rounded-lg">
                <code className="font-mono text-xs text-geo-cloud flex-1 truncate">
                  {showKey
                    ? 'msim_live_k8f2j9mQnT3pBxZ7vRdW1sA4cE6hK9'
                    : 'msim_live_k8f2j9••••••••••••••••••••••••••'}
                </code>
              </div>
              <button onClick={() => setShowKey(!showKey)}
                className="h-10 px-3 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-mist hover:text-geo-cloud hover:bg-geo-steel transition-colors">
                {showKey ? '🙈 Hide' : '👁 Show'}
              </button>
              <button onClick={handleCopy}
                className={`h-10 px-3 rounded-lg text-xs font-medium border transition-colors ${
                  copied ? 'bg-signal-low/20 border-signal-low/30 text-signal-low' : 'bg-geo-graphite border-geo-steel text-geo-mist hover:text-geo-cloud hover:bg-geo-steel'
                }`}>
                {copied ? '✓ Copied' : '📋 Copy'}
              </button>
              <button className="h-10 px-3 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-mist hover:text-geo-cloud hover:bg-geo-steel transition-colors">
                🔄 Rotate
              </button>
            </div>
            <p className="text-[10px] text-geo-mist mt-2">Last used: 2 hours ago from 203.0.113.42</p>
          </div>

          {/* Endpoints */}
          <div className="space-y-4">
            <h3 className="font-display font-semibold text-sm text-geo-white">Endpoint Reference</h3>

            {ENDPOINTS.map((endpoint, idx) => (
              <div key={idx} className="bg-geo-slate border border-geo-steel rounded-xl overflow-hidden">
                {/* Endpoint header */}
                <button
                  onClick={() => setExpandedEndpoint(expandedEndpoint === idx ? null : idx)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-geo-graphite/50 transition-colors"
                >
                  <span className="px-2.5 py-1 bg-signal-low/20 text-signal-low rounded text-[11px] font-bold font-mono flex-shrink-0">
                    {endpoint.method}
                  </span>
                  <code className="font-mono text-sm text-geo-white flex-1 text-left">{endpoint.path}</code>
                  <p className="text-xs text-geo-mist hidden md:block">{endpoint.description}</p>
                  <svg className={`w-4 h-4 text-geo-mist transition-transform ${expandedEndpoint === idx ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {expandedEndpoint === idx && (
                  <div className="border-t border-geo-steel">
                    {/* Parameters */}
                    <div className="px-5 py-4 border-b border-geo-steel">
                      <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest mb-3">Parameters</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-geo-steel">
                              {['Parameter', 'Type', 'Required', 'Description'].map((h) => (
                                <th key={h} className="px-3 py-2 text-left text-[10px] text-geo-mist font-semibold uppercase tracking-wide">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {endpoint.params.map((param) => (
                              <tr key={param.name} className="border-b border-geo-steel/40 last:border-0">
                                <td className="px-3 py-2"><code className="font-mono text-brand-primary">{param.name}</code></td>
                                <td className="px-3 py-2"><code className="font-mono text-geo-mist">{param.type}</code></td>
                                <td className="px-3 py-2">
                                  <span className={`text-[10px] font-semibold ${param.required ? 'text-signal-critical' : 'text-geo-mist'}`}>
                                    {param.required ? 'required' : 'optional'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-geo-cloud">{param.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Code example */}
                    <div className="px-5 py-4 border-b border-geo-steel">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest">Request</p>
                        <div className="flex gap-1">
                          {(['curl', 'python', 'js'] as const).map((lang) => (
                            <button key={lang}
                              onClick={() => setLangTab(lang)}
                              className={`px-2.5 py-1 rounded text-[10px] font-mono font-medium transition-colors ${
                                langTab === lang ? 'bg-brand-primary text-white' : 'bg-geo-graphite text-geo-mist hover:text-geo-cloud'
                              }`}>
                              {lang === 'js' ? 'JavaScript' : lang}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="relative bg-geo-graphite rounded-xl overflow-hidden">
                        <pre className="p-4 overflow-x-auto text-xs font-mono text-geo-cloud leading-relaxed scrollbar-hide">
                          {getCode(endpoint)}
                        </pre>
                        <button
                          onClick={() => navigator.clipboard.writeText(getCode(endpoint))}
                          className="absolute top-3 right-3 h-7 px-2 bg-geo-slate border border-geo-steel rounded text-[10px] text-geo-mist hover:text-geo-cloud transition-colors">
                          Copy
                        </button>
                      </div>

                      {/* Execute */}
                      <div className="flex justify-end mt-3">
                        <button className="h-8 px-4 bg-brand-primary hover:bg-brand-hover text-white rounded-lg text-xs font-semibold transition-colors">
                          ▶ Execute
                        </button>
                      </div>
                    </div>

                    {/* Response */}
                    <div className="px-5 py-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-bold text-signal-low bg-signal-low/20 px-2 py-0.5 rounded">200 OK</span>
                        <p className="text-[10px] font-semibold text-geo-mist uppercase tracking-widest">Response</p>
                      </div>
                      <div className="bg-geo-graphite rounded-xl overflow-hidden">
                        <pre className="p-4 overflow-x-auto text-[11px] font-mono text-geo-cloud leading-relaxed scrollbar-hide">
                          {endpoint.response}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Webhook config */}
          <div className="bg-geo-slate border border-geo-steel rounded-xl p-5">
            <h3 className="font-display font-semibold text-sm text-geo-white mb-4">Webhook Configuration</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-geo-mist mb-1.5">Endpoint URL</label>
                <input
                  type="url"
                  placeholder="https://your-app.com/webhooks/msim"
                  className="w-full h-10 px-3 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud placeholder-geo-mist focus:outline-none focus:border-brand-primary transition-colors font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-geo-mist mb-2">Events</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    'dpi.threshold.breach',
                    'target.status.changed',
                    'new.asm.cluster',
                    'mine.card.updated',
                    'territory.anomaly',
                    'alert.triggered',
                  ].map((event) => (
                    <label key={event} className="flex items-center gap-2 cursor-pointer">
                      <div className="w-4 h-4 rounded border border-geo-steel bg-geo-graphite flex items-center justify-center">
                        <div className="w-2 h-2 rounded-sm bg-brand-primary" />
                      </div>
                      <code className="font-mono text-[11px] text-geo-cloud">{event}</code>
                    </label>
                  ))}
                </div>
              </div>
              <button className="h-9 px-4 bg-geo-graphite border border-geo-steel rounded-lg text-xs text-geo-cloud hover:bg-geo-steel transition-colors">
                🧪 Send Test Event
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
