import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { healthRouter } from './routes/health';
import { mineralSystemsRouter } from './routes/mineralSystems';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use('/health', healthRouter);
app.use('/api/v1/mineral-systems', mineralSystemsRouter);

app.listen(PORT, () => console.log(`MSIM API on port ${PORT}`));
export default app;
