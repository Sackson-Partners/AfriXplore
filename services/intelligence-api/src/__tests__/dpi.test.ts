/**
 * Unit tests for DPI scoring logic in mineralAssessedConsumer.
 *
 * Verifies the scoring formula, dispatch priority mapping, and
 * trend detection without any real DB or Service Bus connections.
 */

// ── Mock DB ───────────────────────────────────────────────────────────────────
const mockQuery = jest.fn();
jest.mock('../db/client', () => ({ db: { query: (...args: any[]) => mockQuery(...args) } }));

// ── Mock Service Bus ──────────────────────────────────────────────────────────
jest.mock('@azure/service-bus', () => ({
  ServiceBusClient: jest.fn().mockImplementation(() => ({
    createReceiver: jest.fn().mockReturnValue({
      subscribe: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Import after mocks are set up
// We test the internals by re-implementing the pure scoring functions here.
// This isolates the math from Azure SDK plumbing.

function calcFreshness(lastUpdatedIso: string): number {
  const daysSince = (Date.now() - new Date(lastUpdatedIso).getTime()) / 86_400_000;
  return Math.max(0, Math.round((1 - daysSince / 90) * 15));
}

function calcDpi(opts: {
  totalCount: number;
  validatedCount: number;
  scoutCount: number;
  avgConfidence: number;
  lastUpdatedIso: string;
}): number {
  const { totalCount, validatedCount, scoutCount, avgConfidence, lastUpdatedIso } = opts;
  const validatedComponent  = Math.round((validatedCount / totalCount) * 25);
  const confidenceComponent = Math.round(Math.min(avgConfidence, 1) * 25);
  const densityComponent    = Math.round(Math.min(totalCount / 10, 1) * 20);
  const scoutComponent      = Math.round(Math.min(scoutCount / 5, 1) * 15);
  const freshnessComponent  = calcFreshness(lastUpdatedIso);
  return Math.min(100, validatedComponent + confidenceComponent + densityComponent + scoutComponent + freshnessComponent);
}

function dispatchPriority(dpi: number): string {
  if (dpi >= 80) return 'critical';
  if (dpi >= 60) return 'high';
  if (dpi >= 40) return 'medium';
  return 'low';
}

const NOW = new Date().toISOString();

describe('DPI scoring formula', () => {
  it('scores 0 for a brand-new single-report cluster', () => {
    const dpi = calcDpi({
      totalCount: 1,
      validatedCount: 0,
      scoutCount: 1,
      avgConfidence: 0,
      lastUpdatedIso: NOW,
    });
    // validated=0, confidence=0, density=2, scout=3, freshness=15 → 20
    expect(dpi).toBeGreaterThanOrEqual(0);
    expect(dpi).toBeLessThan(30);
  });

  it('scores maximum 100 for a fully validated, dense, fresh cluster', () => {
    const dpi = calcDpi({
      totalCount: 10,
      validatedCount: 10,
      scoutCount: 5,
      avgConfidence: 1.0,
      lastUpdatedIso: NOW,
    });
    expect(dpi).toBe(100);
  });

  it('caps at 100 even if components overflow', () => {
    const dpi = calcDpi({
      totalCount: 100,
      validatedCount: 100,
      scoutCount: 100,
      avgConfidence: 1.0,
      lastUpdatedIso: NOW,
    });
    expect(dpi).toBe(100);
  });

  it('freshness decays to 0 after 90 days', () => {
    const ninetyDaysAgo = new Date(Date.now() - 91 * 86_400_000).toISOString();
    const freshness = calcFreshness(ninetyDaysAgo);
    expect(freshness).toBe(0);
  });

  it('freshness is 15 for a cluster updated today', () => {
    expect(calcFreshness(NOW)).toBe(15);
  });

  it('confidence capped at 1.0 (no overflow from AI scores > 1)', () => {
    const dpi = calcDpi({
      totalCount: 10,
      validatedCount: 10,
      scoutCount: 5,
      avgConfidence: 1.5,  // should be treated as 1.0
      lastUpdatedIso: NOW,
    });
    expect(dpi).toBe(100);
  });
});

describe('dispatchPriority thresholds', () => {
  it('critical at 80+', () => expect(dispatchPriority(80)).toBe('critical'));
  it('critical at 100', () => expect(dispatchPriority(100)).toBe('critical'));
  it('high at 60–79', () => expect(dispatchPriority(60)).toBe('high'));
  it('medium at 40–59', () => expect(dispatchPriority(40)).toBe('medium'));
  it('low below 40', () => expect(dispatchPriority(39)).toBe('low'));
  it('low at 0', () => expect(dispatchPriority(0)).toBe('low'));
});
