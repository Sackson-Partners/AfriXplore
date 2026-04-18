export function trackEvent(name: string, properties?: Record<string, string>) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[telemetry] event: ${name}`, properties);
    return;
  }
  // In production, applicationinsights auto-collects via setup in index.ts
}

export function trackMetric(name: string, value: number, properties?: Record<string, string>) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[telemetry] metric: ${name} = ${value}`, properties);
    return;
  }
}
