/**
 * OpenTelemetry Distributed Tracing
 * Enables request tracing across services for performance monitoring
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ParentBasedSampler, TraceIdRatioBasedSampler } from '@opentelemetry/sdk-trace-node';

export interface OpenTelemetryConfig {
  serviceName: string;
  serviceVersion?: string;
  endpoint?: string;
  sampleRate?: number;
  environment?: string;
}

let sdk: NodeSDK | null = null;

/**
 * Initialize OpenTelemetry SDK
 * Must be called before any other modules are imported
 */
export function initializeOpenTelemetry(config: OpenTelemetryConfig): void {
  if (sdk) {
    console.warn('[OpenTelemetry] Already initialized');
    return;
  }

  const {
    serviceName,
    serviceVersion = '1.0.0',
    endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    sampleRate = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '0.1'),
    environment = process.env.NODE_ENV || 'development',
  } = config;

  // Skip in test environment
  if (environment === 'test') {
    console.log('[OpenTelemetry] Skipping initialization in test environment');
    return;
  }

  const resource = Resource.default().merge(
    new Resource({
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      environment,
    })
  );

  const traceExporter = new OTLPTraceExporter({
    url: endpoint,
    headers: {
      // Add authentication headers if needed
      // 'Authorization': `Bearer ${process.env.OTEL_AUTH_TOKEN}`,
    },
  });

  sdk = new NodeSDK({
    resource,
    traceExporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable instrumentations that are too verbose
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: false,
        },
        // Configure HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingRequestHook: (request: any) => {
            // Ignore health check requests
            return request.url?.includes('/health') || false;
          },
        },
        // Configure Express instrumentation
        '@opentelemetry/instrumentation-express': {
          enabled: true,
        },
        // Configure PostgreSQL instrumentation
        '@opentelemetry/instrumentation-pg': {
          enabled: true,
        },
      }),
    ],
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(sampleRate),
    }),
  });

  sdk.start();

  console.log(`[OpenTelemetry] Initialized for ${serviceName} (${environment})`);
  console.log(`[OpenTelemetry] Exporting to: ${endpoint}`);
  console.log(`[OpenTelemetry] Sample rate: ${sampleRate * 100}%`);

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    try {
      await sdk!.shutdown();
      console.log('[OpenTelemetry] Shutdown complete');
    } catch (error) {
      console.error('[OpenTelemetry] Error during shutdown:', error);
    }
  });
}

/**
 * Shutdown OpenTelemetry SDK
 */
export async function shutdownOpenTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
    console.log('[OpenTelemetry] Shutdown');
  }
}

/**
 * Get the current trace context (for manual instrumentation)
 */
export function getTraceContext(): {
  traceId: string;
  spanId: string;
  traceFlags: string;
} | null {
  const trace = require('@opentelemetry/api').trace;
  const span = trace.getActiveSpan();

  if (!span) {
    return null;
  }

  const spanContext = span.spanContext();

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags.toString(16).padStart(2, '0'),
  };
}

/**
 * Create a custom span for manual instrumentation
 */
export function createSpan(
  name: string,
  options?: {
    kind?: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
    attributes?: Record<string, string | number | boolean>;
  }
): any {
  const trace = require('@opentelemetry/api').trace;
  const tracer = trace.getTracer('manual-instrumentation');

  const spanKindMap = {
    internal: 0,
    server: 1,
    client: 2,
    producer: 3,
    consumer: 4,
  };

  return tracer.startSpan(name, {
    kind: spanKindMap[options?.kind || 'internal'],
    attributes: options?.attributes,
  });
}

/**
 * Execute a function within a span
 */
export async function withSpan<T>(
  name: string,
  fn: () => Promise<T>,
  options?: {
    attributes?: Record<string, string | number | boolean>;
  }
): Promise<T> {
  const span = createSpan(name, {
    kind: 'internal',
    attributes: options?.attributes,
  });

  try {
    const result = await fn();
    span.setStatus({ code: 1 }); // OK
    return result;
  } catch (error) {
    span.setStatus({ code: 2 }); // ERROR
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add attributes to the current span
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const trace = require('@opentelemetry/api').trace;
  const span = trace.getActiveSpan();

  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Add an event to the current span
 */
export function addSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const trace = require('@opentelemetry/api').trace;
  const span = trace.getActiveSpan();

  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Record an exception in the current span
 */
export function recordSpanException(error: Error): void {
  const trace = require('@opentelemetry/api').trace;
  const span = trace.getActiveSpan();

  if (span) {
    span.recordException(error);
    span.setStatus({ code: 2 }); // ERROR
  }
}
