import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger';
import helmet from 'helmet';
import cors from 'cors';
import { aiInferenceConsumer } from './consumers/reportConsumer';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://platform.afrixplore.io' }));
app.use(express.json());

if (process.env.NODE_ENV !== 'production') {
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'AfriXplore AI Inference Docs' }));
}
app.get('/docs.json', (_req, res) => res.json(swaggerSpec));

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'ai-inference', timestamp: new Date().toISOString() });
});

app.get('/health/ready', (_, res) => {
  res.json({ status: 'ready', service: 'ai-inference' });
});

aiInferenceConsumer.start().catch((err: Error) =>
  process.stderr.write(JSON.stringify({ level: 'error', service: 'ai-inference', ts: new Date().toISOString(), msg: 'AI inference consumer failed to start', error: err.message }) + '\n')
);

app.listen(PORT, () => {
  process.stdout.write(JSON.stringify({ level: 'info', service: 'ai-inference', ts: new Date().toISOString(), msg: `AfriXplore AI Inference Service on port ${PORT}` }) + '\n');
});

export default app;
