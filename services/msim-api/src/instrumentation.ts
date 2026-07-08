/**
 * OpenTelemetry Instrumentation
 * Must be imported before any other modules to enable auto-instrumentation
 */

import { initializeOpenTelemetry } from '@ain/monitoring';

// Initialize OpenTelemetry
initializeOpenTelemetry({
  serviceName: process.env.OTEL_SERVICE_NAME || 'msim-api',
  serviceVersion: process.env.npm_package_version || '1.0.0',
  endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
  sampleRate: parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '0.1'),
  environment: process.env.NODE_ENV,
});

export {};
