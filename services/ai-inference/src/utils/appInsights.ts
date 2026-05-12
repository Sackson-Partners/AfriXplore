export function trackEvent(name: string, properties?: Record<string, string>) {
  if (process.env.NODE_ENV !== 'production') {
    process.stdout.write(JSON.stringify({ level: 'info', service: 'ai-inference', ts: new Date().toISOString(), msg: `[telemetry] event: ${name}`, properties }) + '\n');
    return;
  }
  // In production, applicationinsights auto-collects via setup in index.ts
}

export function trackMetric(name: string, value: number, properties?: Record<string, string>) {
  if (process.env.NODE_ENV !== 'production') {
    process.stdout.write(JSON.stringify({ level: 'info', service: 'ai-inference', ts: new Date().toISOString(), msg: `[telemetry] metric: ${name} = ${value}`, properties }) + '\n');
    return;
  }
}
