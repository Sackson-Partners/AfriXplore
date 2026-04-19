import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { loadSecrets } from '@afrixplore/config';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger';
import { healthRouter } from './routes/health';
import { paymentsRouter } from './routes/payments';
import { stripeWebhookRouter } from './routes/stripeWebhook';
import { mobileMoneyRouter } from './routes/mobileMoney';
import { authMiddleware } from './middleware/auth';
import { paymentLimiter, mobileMoneyLimiter } from './middleware/rateLimiter';
import { serviceBusConsumer } from './consumers/paymentConsumer';
import { validateMomoConfig } from './config/momo';

const log = {
  info:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'info',  service: 'payment-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  error: (msg: string, extra?: object) => process.stderr.write(JSON.stringify({ level: 'error', service: 'payment-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
};

async function bootstrap() {
  // Load secrets from Azure Key Vault before starting HTTP server.
  // In production, secrets MUST come from the vault. In development the
  // vault client falls back to env vars automatically (see @afrixplore/config).
  if (process.env.NODE_ENV === 'production') {
    await loadSecrets([
      'database-url',
      'service-bus-connection-string',
      'momo-subscription-key',
      'momo-api-key',
      'momo-api-user',
      'stripe-secret-key',
      'stripe-webhook-secret',
      'africas-talking-api-key',
    ]).then((secrets) => {
      // Inject into process.env so downstream config consumers find them
      if (secrets['database-url'])                   process.env.DATABASE_URL                   = secrets['database-url'];
      if (secrets['service-bus-connection-string'])  process.env.SERVICE_BUS_CONNECTION_STRING  = secrets['service-bus-connection-string'];
      if (secrets['momo-subscription-key'])          process.env.MTN_MOMO_SUBSCRIPTION_KEY      = secrets['momo-subscription-key'];
      if (secrets['momo-api-key'])                   process.env.MTN_MOMO_API_KEY               = secrets['momo-api-key'];
      if (secrets['momo-api-user'])                  process.env.MTN_MOMO_API_USER              = secrets['momo-api-user'];
      if (secrets['stripe-secret-key'])              process.env.STRIPE_SECRET_KEY              = secrets['stripe-secret-key'];
      if (secrets['stripe-webhook-secret'])          process.env.STRIPE_WEBHOOK_SECRET          = secrets['stripe-webhook-secret'];
      if (secrets['africas-talking-api-key'])        process.env.AFRICAS_TALKING_API_KEY        = secrets['africas-talking-api-key'];
    });
  }

  validateMomoConfig();

  const app = express();
  const PORT = process.env.PORT || 3003;

  app.use(helmet());
  app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));
  app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://platform.afrixplore.io' }));
  app.use(express.json());

  app.use('/health', healthRouter);
  if (process.env.NODE_ENV !== 'production') {
    app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'AfriXplore Payment Service Docs' }));
  }
  app.get('/api/v1/docs.json', (_req, res) => res.json(swaggerSpec));
  app.use('/webhooks/stripe', stripeWebhookRouter);

  app.use('/api/v1', authMiddleware);
  app.use('/api/v1/payments', paymentLimiter, paymentsRouter);
  app.use('/api/v1/mobile-money', mobileMoneyLimiter, mobileMoneyRouter);

  serviceBusConsumer.start().catch((err: Error) =>
    log.error('Service Bus consumer failed to start', { error: err.message })
  );

  app.listen(PORT, () => log.info(`AfriXplore Payment Service on port ${PORT}`));

  return app;
}

bootstrap().catch((err: Error) => {
  process.stderr.write(JSON.stringify({ level: 'error', service: 'payment-service', ts: new Date().toISOString(), msg: 'Fatal startup error', error: err.message }) + '\n');
  process.exit(1);
});
