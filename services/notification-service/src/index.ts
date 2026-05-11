import express from 'express';
import { healthRouter } from './routes/health';
import { anomalyConsumer } from './consumers/anomalyConsumer';
import { paymentConsumer } from './consumers/paymentConsumer';
import { reportsIngestedConsumer } from './consumers/reportsIngestedConsumer';
import 'dotenv/config';

const log = {
  info:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'info',  service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  error: (msg: string, extra?: object) => process.stderr.write(JSON.stringify({ level: 'error', service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
};

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use('/health', healthRouter);

// SERVICE_BUS_CONNECTION_STRING is required for all consumers.
// Fail fast at startup rather than running silently with no message processing.
if (!process.env.SERVICE_BUS_CONNECTION_STRING) {
  log.error('FATAL: SERVICE_BUS_CONNECTION_STRING is not set — notification-service cannot process any messages');
  process.exit(1);
}

(async () => {
  const CONSUMER_NAMES = ['anomaly', 'payment', 'reports-ingested'] as const;
  const consumerResults = await Promise.allSettled([
    anomalyConsumer.start(),
    paymentConsumer.start(),
    reportsIngestedConsumer.start(),
  ]);

  const failed = consumerResults.filter((r) => r.status === 'rejected');
  failed.forEach((r, i) => {
    log.error(`Consumer failed to start: ${CONSUMER_NAMES[i]}`, { error: (r as PromiseRejectedResult).reason?.message });
  });

  if (failed.length === consumerResults.length) {
    log.error('FATAL: All consumers failed to start — exiting');
    process.exit(1);
  }

  // Graceful shutdown — drain in-flight messages before exit
  const shutdown = async () => {
    log.info('Shutting down notification service...');
    await Promise.allSettled([anomalyConsumer.stop(), paymentConsumer.stop(), reportsIngestedConsumer.stop()]);
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  app.listen(PORT, () => log.info(`AfriXplore Notification Service on port ${PORT}`));
})();
