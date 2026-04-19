import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { aiInferenceConsumer } from './consumers/reportConsumer';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://platform.afrixplore.io' }));
app.use(express.json());

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'ai-inference', timestamp: new Date().toISOString() });
});

app.get('/health/ready', (_, res) => {
  res.json({ status: 'ready', service: 'ai-inference' });
});

aiInferenceConsumer.start().catch(console.error);

app.listen(PORT, () => {
  console.log(`AfriXplore AI Inference Service on port ${PORT}`);
});

export default app;
