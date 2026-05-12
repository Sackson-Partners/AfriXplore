import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { publishToServiceBus } from '../utils/serviceBus';

const router = Router();

router.get('/providers', (req: Request, res: Response) => {
  res.json({
    providers: [
      { id: 'mpesa_kenya',              name: 'M-Pesa Kenya',               countries: ['KE'],                     currency: 'KES', min_usd: 1 },
      { id: 'mpesa_tanzania',           name: 'M-Pesa Tanzania',            countries: ['TZ'],                     currency: 'TZS', min_usd: 1 },
      { id: 'mtn_ghana',                name: 'MTN MoMo Ghana',             countries: ['GH'],                     currency: 'GHS', min_usd: 1 },
      { id: 'mtn_zambia',               name: 'MTN MoMo Zambia',            countries: ['ZM'],                     currency: 'ZMW', min_usd: 1 },
      { id: 'mtn_uganda',               name: 'MTN MoMo Uganda',            countries: ['UG'],                     currency: 'UGX', min_usd: 1 },
      { id: 'mtn_cameroon',             name: 'MTN MoMo Cameroon',          countries: ['CM'],                     currency: 'XAF', min_usd: 1 },
      { id: 'mtn_rwanda',               name: 'MTN MoMo Rwanda',            countries: ['RW'],                     currency: 'RWF', min_usd: 1 },
      { id: 'airtel_zambia',            name: 'Airtel Money Zambia',        countries: ['ZM'],                     currency: 'ZMW', min_usd: 1 },
      { id: 'airtel_uganda',            name: 'Airtel Money Uganda',        countries: ['UG'],                     currency: 'UGX', min_usd: 1 },
      { id: 'airtel_tanzania',          name: 'Airtel Money Tanzania',      countries: ['TZ'],                     currency: 'TZS', min_usd: 1 },
      { id: 'airtel_kenya',             name: 'Airtel Money Kenya',         countries: ['KE', 'ET'],               currency: 'KES', min_usd: 1 },
      { id: 'flutterwave_drc',          name: 'Flutterwave DRC',            countries: ['CD'],                     currency: 'CDF', min_usd: 1 },
      { id: 'flutterwave_zimbabwe',     name: 'Flutterwave Zimbabwe',       countries: ['ZW'],                     currency: 'USD', min_usd: 1 },
      { id: 'wave_senegal',             name: 'Wave Senegal',               countries: ['SN', 'GN'],               currency: 'XOF', min_usd: 1 },
      { id: 'wave_cotedivoire',         name: 'Wave Côte d\'Ivoire',        countries: ['CI', 'BF'],               currency: 'XOF', min_usd: 1 },
      { id: 'orange_money_senegal',     name: 'Orange Money Senegal',       countries: ['SN', 'GN', 'MG'],        currency: 'XOF', min_usd: 1 },
      { id: 'orange_money_cotedivoire', name: 'Orange Money Côte d\'Ivoire', countries: ['CI'],                   currency: 'XOF', min_usd: 1 },
      { id: 'orange_money_mali',        name: 'Orange Money Mali',          countries: ['ML'],                     currency: 'XOF', min_usd: 1 },
      { id: 'orange_money_cameroon',    name: 'Orange Money Cameroon',      countries: ['CM'],                     currency: 'XAF', min_usd: 1 },
      { id: 'opay_nigeria',             name: 'OPay Nigeria',               countries: ['NG'],                     currency: 'NGN', min_usd: 1 },
      { id: 'opay_egypt',               name: 'OPay Egypt',                 countries: ['EG'],                     currency: 'EGP', min_usd: 1 },
    ],
  });
});

// ─── GET /balance ─────────────────────────────────────────────────────────────
router.get('/balance', async (req: Request, res: Response) => {
  const scoutId = (req as any).userId;

  const result = await db.query(
    `SELECT pending_earnings_usd FROM scouts WHERE id = $1`,
    [scoutId]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({
      type: 'https://afrixplore.io/errors/not-found',
      title: 'Scout Not Found',
      status: 404,
    });
  }

  return res.json({
    pending_earnings_usd: result.rows[0].pending_earnings_usd,
    currency: 'USD',
    scout_id: scoutId,
  });
});

// ─── POST /payout/request ─────────────────────────────────────────────────────
router.post('/payout/request', async (req: Request, res: Response) => {
  const scoutId = (req as any).userId;

  // 1. Get scout pending_earnings_usd
  const scoutResult = await db.query(
    `SELECT pending_earnings_usd FROM scouts WHERE id = $1`,
    [scoutId]
  );

  if (scoutResult.rows.length === 0) {
    return res.status(404).json({
      type: 'https://afrixplore.io/errors/not-found',
      title: 'Scout Not Found',
      status: 404,
    });
  }

  const pendingBalance: number = parseFloat(scoutResult.rows[0].pending_earnings_usd);

  if (pendingBalance < 1.00) {
    return res.status(400).json({
      type: 'https://afrixplore.io/errors/400',
      title: 'Minimum payout is $1.00',
      status: 400,
      detail: `Current pending balance is $${pendingBalance.toFixed(2)}`,
    });
  }

  // 2. Check no other payment is 'pending' or 'processing' for this scout
  const inflightResult = await db.query(
    `SELECT id FROM payments WHERE scout_id = $1 AND status IN ('pending', 'processing') LIMIT 1`,
    [scoutId]
  );

  if (inflightResult.rows.length > 0) {
    return res.status(409).json({
      type: 'https://afrixplore.io/errors/409',
      title: 'Payout already in progress',
      status: 409,
      detail: 'A payout is already pending or processing for this scout',
    });
  }

  // 3. INSERT into payments table
  const insertResult = await db.query(
    `INSERT INTO payments (scout_id, type, amount_usd, currency, provider, status)
     VALUES ($1, 'finder_fee', $2, 'USD', 'mpesa', 'pending')
     RETURNING id, amount_usd, status`,
    [scoutId, pendingBalance]
  );

  const payment = insertResult.rows[0];

  // 4. Publish to Service Bus topic 'payment-triggered' (fire-and-forget)
  publishToServiceBus('payment-triggered', {
    type: 'finder_fee',
    scoutId,
    paymentId: payment.id,
    amountUsd: pendingBalance,
    reason: 'manual_payout_request',
  }).catch((err) => process.stderr.write(JSON.stringify({ level: 'error', service: 'payment-service', ts: new Date().toISOString(), msg: 'ServiceBus payment trigger failed', error: (err as Error).message }) + '\n'));

  // 5. Return 202
  return res.status(202).json({
    payment_id: payment.id,
    amount_usd: parseFloat(payment.amount_usd),
    status: 'pending',
    message: 'Payout initiated',
  });
});

export { router as mobileMoneyRouter };
