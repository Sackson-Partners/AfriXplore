/**
 * AfriXplore — Unified Telemetry
 * Azure Application Insights wrapper
 */

import {
  TelemetryClient,
  setup as aiSetup,
  defaultClient,
} from 'applicationinsights';

let client: TelemetryClient | null = null;

export function initTelemetry(serviceName: string) {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!connectionString) {
    console.warn('Application Insights connection string not set — telemetry disabled');
    return;
  }

  aiSetup(connectionString)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true, true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(true)
    .start();

  client = defaultClient;
  client.context.tags[client.context.keys.cloudRole] = serviceName;
  client.context.tags[client.context.keys.cloudRoleInstance] =
    process.env.HOSTNAME || serviceName;

  client.commonProperties = {
    service: serviceName,
    environment: process.env.NODE_ENV || 'unknown',
    version: process.env.npm_package_version || '0.0.0',
  };

  console.log(`Application Insights initialized for ${serviceName}`);
}

export function trackEvent(name: string, properties?: Record<string, string>, measurements?: Record<string, number>) {
  if (!client) return;
  client.trackEvent({ name, properties, measurements });
}

export function trackMetric(name: string, value: number, properties?: Record<string, string>) {
  if (!client) return;
  client.trackMetric({ name, value, properties });
}

export function trackException(error: Error, properties?: Record<string, string>) {
  if (!client) return;
  client.trackException({ exception: error, properties });
}

export function trackDependency(
  dependencyTypeName: string,
  name: string,
  data: string,
  duration: number,
  success: boolean
) {
  if (!client) return;
  client.trackDependency({ dependencyTypeName, name, data, duration, success });
}

export function telemetryMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();

    res.on('finish', () => {
      const duration = Date.now() - start;
      const success = res.statusCode < 400;

      if (!client) return;
      client.trackRequest({
        name: `${req.method} ${req.route?.path || req.path}`,
        url: req.originalUrl,
        duration,
        resultCode: res.statusCode.toString(),
        success,
      });

      if (duration > 2000) {
        trackEvent('slow_request', {
          path: req.path,
          method: req.method,
          durationMs: duration.toString(),
          statusCode: res.statusCode.toString(),
        });
      }
    });

    next();
  };
}
