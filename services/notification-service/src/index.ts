import express from 'express';
import { healthRouter } from './routes/health';
import { anomalyConsumer } from './consumers/anomalyConsumer';
import { paymentConsumer } from './consumers/paymentConsumer';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());
app.use('/health', healthRouter);

anomalyConsumer.start().catch(console.error);
paymentConsumer.start().catch(console.error);

app.listen(PORT, () => {
  console.log(`AfriXplore Notification Service on port ${PORT}`);
});
