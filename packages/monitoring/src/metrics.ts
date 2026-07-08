import { Request, Response, NextFunction } from 'express';

interface Metric {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

class MetricsCollector {
  private metrics: Map<string, number[]> = new Map();
  private counters: Map<string, number> = new Map();

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>) {
    const key = this.getKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Record a histogram value (for timing, sizes, etc.)
   */
  recordHistogram(name: string, value: number, labels?: Record<string, string>) {
    const key = this.getKey(name, labels);
    const values = this.metrics.get(key) || [];
    values.push(value);

    // Keep only last 1000 values
    if (values.length > 1000) {
      values.shift();
    }

    this.metrics.set(key, values);
  }

  /**
   * Get counter value
   */
  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.getKey(name, labels);
    return this.counters.get(key) || 0;
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(name: string, labels?: Record<string, string>) {
    const key = this.getKey(name, labels);
    const values = this.metrics.get(key) || [];

    if (values.length === 0) {
      return { count: 0, min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: this.percentile(sorted, 50),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };
  }

  /**
   * Get all metrics in Prometheus format
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // Counters
    for (const [key, value] of this.counters.entries()) {
      lines.push(`${key} ${value}`);
    }

    // Histograms (as summaries)
    for (const [key, values] of this.metrics.entries()) {
      if (values.length > 0) {
        const stats = this.getHistogramStats(key);
        lines.push(`# TYPE ${key} summary`);
        lines.push(`${key}_count ${stats.count}`);
        lines.push(`${key}_sum ${values.reduce((a, b) => a + b, 0)}`);
        lines.push(`${key}{quantile="0.5"} ${stats.p50}`);
        lines.push(`${key}{quantile="0.95"} ${stats.p95}`);
        lines.push(`${key}{quantile="0.99"} ${stats.p99}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Reset all metrics
   */
  reset() {
    this.metrics.clear();
    this.counters.clear();
  }

  private getKey(name: string, labels?: Record<string, string>): string {
    if (!labels) return name;
    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }
}

// Global metrics collector
export const metrics = new MetricsCollector();

/**
 * Middleware to track HTTP metrics
 */
export function metricsMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();

    // Increment request counter
    metrics.incrementCounter('http_requests_total', 1, {
      method: req.method,
      path: req.route?.path || req.path,
    });

    // Track response
    const originalSend = res.send;
    res.send = function (data) {
      const duration = Date.now() - startTime;

      // Record request duration
      metrics.recordHistogram('http_request_duration_ms', duration, {
        method: req.method,
        path: req.route?.path || req.path,
        status: res.statusCode.toString(),
      });

      // Increment status counter
      metrics.incrementCounter('http_responses_total', 1, {
        method: req.method,
        path: req.route?.path || req.path,
        status: res.statusCode.toString(),
      });

      // Track errors
      if (res.statusCode >= 400) {
        metrics.incrementCounter('http_errors_total', 1, {
          method: req.method,
          path: req.route?.path || req.path,
          status: res.statusCode.toString(),
        });
      }

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Endpoint to expose metrics
 */
export function metricsEndpoint() {
  return (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(metrics.getPrometheusMetrics());
  };
}

/**
 * Business metrics helpers
 */
export const businessMetrics = {
  /**
   * Track convergence score computation
   */
  trackConvergenceComputation(mineId: string, duration: number, score: number) {
    metrics.recordHistogram('convergence_computation_duration_ms', duration);
    metrics.recordHistogram('convergence_score_value', score);
    metrics.incrementCounter('convergence_computations_total', 1);
  },

  /**
   * Track search queries
   */
  trackSearch(query: string, resultCount: number, duration: number) {
    metrics.recordHistogram('search_duration_ms', duration);
    metrics.recordHistogram('search_result_count', resultCount);
    metrics.incrementCounter('search_queries_total', 1);
  },

  /**
   * Track data ingestion
   */
  trackIngestion(source: string, recordCount: number, duration: number) {
    metrics.recordHistogram('ingestion_duration_ms', duration, { source });
    metrics.incrementCounter('ingestion_records_total', recordCount, { source });
    metrics.incrementCounter('ingestion_runs_total', 1, { source });
  },
};
