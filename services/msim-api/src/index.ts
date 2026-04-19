import 'dotenv/config';
import { initTelemetry } from '@afrixplore/telemetry';
initTelemetry('msim-api');

import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './docs/swagger';
import helmet from 'helmet';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { mineralSystemsRouter } from './routes/mineralSystems';
import { authMiddleware } from './middleware/auth';
import { generalLimiter } from './middleware/rateLimiter';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://platform.afrixplore.io' }));
app.use(express.json());
app.use('/health', healthRouter);
if (process.env.NODE_ENV !== 'production') {
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, { customSiteTitle: 'AfriXplore MSIM API Docs' }));
}
app.get('/api/v1/docs.json', (_req, res) => res.json(swaggerSpec));
app.use('/api/v1', authMiddleware, generalLimiter);
app.use('/api/v1/mineral-systems', mineralSystemsRouter);

app.listen(PORT, () => process.stdout.write(JSON.stringify({ level: 'info', service: 'msim-api', ts: new Date().toISOString(), msg: `MSIM API on port ${PORT}` }) + '\n'));
export default app;
