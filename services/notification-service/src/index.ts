import express from 'express';
import { healthRouter } from './routes/health';
import { anomalyConsumer } from './consumers/anomalyConsumer';
import { paymentConsumer } from './consumers/paymentConsumer';
import 'dotenv/config';

const log = {
  info:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'info',  service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  error: (msg: string, extra?: object) => process.stderr.write(JSON.stringify({ level: 'error', service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
};

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use('/health', healthRouter);

anomalyConsumer.start().catch((err: Error) => log.error('Anomaly consumer failed to start', { error: err.message }));
paymentConsumer.start().catch((err: Error) => log.error('Payment consumer failed to start', { error: err.message }));

// Graceful shutdown — drain in-flight messages before exit
const shutdown = async () => {
  log.info('Shutting down notification service...');
  await Promise.allSettled([anomalyConsumer.stop(), paymentConsumer.stop()]);
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

app.listen(PORT, () => log.info(`AfriXplore Notification Service on port ${PORT}`));
