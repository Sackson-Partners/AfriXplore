import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { paymentsRouter } from './routes/payments';
import { stripeWebhookRouter } from './routes/stripeWebhook';
import { mobileMoneyRouter } from './routes/mobileMoney';
import { authMiddleware } from './middleware/auth';
import { paymentLimiter, mobileMoneyLimiter } from './middleware/rateLimiter';
import { serviceBusConsumer } from './consumers/paymentConsumer';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3003;

app.use(helmet());

// Raw body needed for Stripe webhook signature verification
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://platform.afrixplore.io' }));
app.use(express.json());

app.use('/health', healthRouter);
app.use('/webhooks/stripe', stripeWebhookRouter);

app.use('/api/v1', authMiddleware);
app.use('/api/v1/payments', paymentLimiter, paymentsRouter);
app.use('/api/v1/mobile-money', mobileMoneyLimiter, mobileMoneyRouter);

serviceBusConsumer.start().catch((err: Error) =>
  process.stderr.write(JSON.stringify({ level: 'error', service: 'payment-service', ts: new Date().toISOString(), msg: 'Service Bus consumer failed to start', error: err.message }) + '\n')
);

app.listen(PORT, () => {
  process.stdout.write(JSON.stringify({ level: 'info', service: 'payment-service', ts: new Date().toISOString(), msg: `AfriXplore Payment Service on port ${PORT}` }) + '\n');
});

export default app;
