import { Router, Request, Response } from 'express';
import { db } from '../db/client';

const router = Router();

router.get('/providers', (req: Request, res: Response) => {
  res.json({
    providers: [
      { id: 'mpesa_kenya', name: 'M-Pesa Kenya', countries: ['KE'] },
      { id: 'mpesa_tanzania', name: 'M-Pesa Tanzania', countries: ['TZ'] },
      { id: 'mtn_ghana', name: 'MTN MoMo Ghana', countries: ['GH'] },
      { id: 'mtn_zambia', name: 'MTN MoMo Zambia', countries: ['ZM'] },
      { id: 'airtel_zambia', name: 'Airtel Money Zambia', countries: ['ZM'] },
      { id: 'flutterwave_drc', name: 'Flutterwave DRC', countries: ['CD'] },
      { id: 'flutterwave_zimbabwe', name: 'Flutterwave Zimbabwe', countries: ['ZW'] },
    ],
  });
});

export { router as mobileMoneyRouter };
