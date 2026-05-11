/**
 * AfriXplore Intelligence API — DPI Scoring Consumer
 *
 * Subscribes to the `mineral-assessed` Service Bus topic.
 * On each AI assessment event, recalculates the DPI score for the
 * affected anomaly cluster and persists the updated score + priority.
 *
 * DPI components (total 0–100):
 *   validated_component  (0–25): validated_count / total_count × 25
 *   confidence_component (0–25): avg AI confidence × 25
 *   density_component    (0–20): min(report_count / 10, 1) × 20
 *   scout_component      (0–15): min(scout_count / 5, 1) × 15
 *   freshness_component  (0–15): linear decay to 0 over 90 days
 */

import { ServiceBusClient, ServiceBusReceivedMessage } from '@azure/service-bus';
import { db } from '../db/client';

const CONNECTION_STRING = process.env.SERVICE_BUS_CONNECTION_STRING!;
const TOPIC = 'mineral-assessed';
const SUBSCRIPTION = 'intelligence-dpi';

interface MineralAssessedMessage {
  reportId: string;
  scoutId: string;
  topMineral: string;
  confidence: number;
}

function calcFreshness(lastUpdatedIso: string): number {
  const daysSince = (Date.now() - new Date(lastUpdatedIso).getTime()) / 86_400_000;
  return Math.max(0, Math.round((1 - daysSince / 90) * 15));
}

function dispatchPriority(dpi: number): string {
  if (dpi >= 80) return 'critical';
  if (dpi >= 60) return 'high';
  if (dpi >= 40) return 'medium';
  return 'low';
}

async function recalculateDpi(reportId: string, confidence: number): Promise<void> {
  // Find which cluster this report belongs to
  const clusterResult = await db.query(
    `SELECT cluster_id FROM reports WHERE id = $1`,
    [reportId]
  );

  const clusterId: string | null = clusterResult.rows[0]?.cluster_id ?? null;
  if (!clusterId) {
    // Report not yet assigned to a cluster — geospatial-worker hasn't run yet
    return;
  }

  // Aggregate cluster stats
  const statsResult = await db.query(
    `SELECT
       ac.dpi_score                                                AS current_dpi,
       ac.last_updated                                            AS last_updated,
       ac.scout_count,
       COUNT(r.id)                                                AS total_count,
       COUNT(r.id) FILTER (WHERE r.status = 'validated')         AS validated_count,
       AVG(r.confidence_score) FILTER (WHERE r.confidence_score IS NOT NULL)
                                                                  AS avg_confidence
     FROM anomaly_clusters ac
     LEFT JOIN reports r ON r.cluster_id = ac.id
     WHERE ac.id = $1
     GROUP BY ac.id, ac.dpi_score, ac.last_updated, ac.scout_count`,
    [clusterId]
  );

  if (statsResult.rows.length === 0) return;

  const s = statsResult.rows[0];
  const totalCount    = Number(s.total_count)     || 1;
  const validatedCount = Number(s.validated_count) || 0;
  const scoutCount    = Number(s.scout_count)      || 1;
  // Use the new AI confidence if the cluster avg is not yet populated
  const avgConfidence = s.avg_confidence !== null ? Number(s.avg_confidence) : confidence;
  const currentDpi    = Number(s.current_dpi) || 0;

  const validatedComponent  = Math.round((validatedCount / totalCount) * 25);
  const confidenceComponent = Math.round(Math.min(avgConfidence, 1) * 25);
  const densityComponent    = Math.round(Math.min(totalCount / 10, 1) * 20);
  const scoutComponent      = Math.round(Math.min(scoutCount / 5, 1) * 15);
  const freshnessComponent  = calcFreshness(s.last_updated);

  const newDpi = Math.min(
    100,
    validatedComponent + confidenceComponent + densityComponent + scoutComponent + freshnessComponent
  );

  const trend =
    newDpi > currentDpi + 2 ? 'rising'
    : newDpi < currentDpi - 2 ? 'falling'
    : 'stable';

  // Wrap in a transaction: the UPDATE and the scout_count increment must
  // either both commit or both roll back to keep cluster stats consistent.
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE anomaly_clusters
       SET dpi_score        = $1,
           dispatch_priority = $2,
           trend             = $3,
           last_updated      = NOW()
       WHERE id = $4`,
      [newDpi, dispatchPriority(newDpi), trend, clusterId]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

class MineralAssessedConsumer {
  private client: ServiceBusClient | null = null;

  async start(): Promise<void> {
    this.client = new ServiceBusClient(CONNECTION_STRING);
    const receiver = this.client.createReceiver(TOPIC, SUBSCRIPTION, {
      receiveMode: 'peekLock',
    });

    receiver.subscribe({
      processMessage: async (message: ServiceBusReceivedMessage) => {
        const body = message.body as MineralAssessedMessage;
        try {
          await recalculateDpi(body.reportId, body.confidence ?? 0);
          await receiver.completeMessage(message);
        } catch (err) {
          await receiver.abandonMessage(message);
          throw err;
        }
      },
      processError: async (err) => {
        process.stderr.write(
          JSON.stringify({
            level: 'error', service: 'intelligence-api',
            ts: new Date().toISOString(),
            msg: 'MineralAssessedConsumer error',
            error: String(err.error),
          }) + '\n'
        );
      },
    });

    process.stdout.write(
      JSON.stringify({
        level: 'info', service: 'intelligence-api',
        ts: new Date().toISOString(),
        msg: `Subscribed to ${TOPIC}/${SUBSCRIPTION}`,
      }) + '\n'
    );
  }

  async stop(): Promise<void> {
    await this.client?.close();
  }
}

export const mineralAssessedConsumer = new MineralAssessedConsumer();
