import { Router } from 'express';
const router = Router();
router.get('/', (_, res) => res.json({ status: 'ok', service: 'msim-api', timestamp: new Date().toISOString() }));
export { router as healthRouter };
