import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import { clustersRouter } from './routes/clusters';
import { targetsRouter } from './routes/targets';
import { exportRouter } from './routes/export';
import { streamRouter } from './routes/stream';
import { db } from './db/client';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(compression());
app.use(express.json());

app.get('/health', async (_req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', service: 'intelligence-api', ts: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ status: 'error', detail: String(err) });
  }
});

app.use('/api/v1/clusters',  clustersRouter);
app.use('/api/v1/targets',   targetsRouter);
app.use('/api/v1/export',    exportRouter);
app.use('/api/v1/stream',    streamRouter);

app.listen(PORT, () => {
  console.log(`AfriXplore Intelligence API on port ${PORT}`);
});
