import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import authRoutes from './routes/auth';
import scoutRoutes from './routes/scouts';
import uploadRoutes from './routes/upload';
import ussdRoutes from './routes/ussd';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || '*' }));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));
app.use(requestLogger);

// Routes
app.use('/scout/v1/auth', authRoutes);
app.use('/scout/v1/scouts', scoutRoutes);
app.use('/scout/v1/upload', uploadRoutes);
app.use('/scout/v1/ussd', ussdRoutes);

// Health probe
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'scout-api', ts: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Scout API listening on :${PORT}`);
});

export default app;
