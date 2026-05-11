import axios from 'axios';
import { db } from '../db/client';
import { MTN_MOMO_BASE_URL, MTN_MOMO_TARGET_ENV } from '../config/momo';
import { getUsdToRate } from './fxService';

export type MobileMoneyProvider =
  | 'mpesa_kenya'
  | 'mpesa_tanzania'
  | 'mtn_ghana'
  | 'mtn_zambia'
  | 'airtel_zambia'
  | 'flutterwave_drc'
  | 'flutterwave_zimbabwe'
  | 'wave_senegal'         // Wave — Senegal, Côte d'Ivoire, Mali, Burkina Faso, Guinea, Cameroon, Uganda
  | 'wave_cotedivoire'
  | 'orange_money_senegal' // Orange Money — Senegal, Côte d'Ivoire, Mali, Cameroon, Guinea, DRC, Madagascar
  | 'orange_money_cotedivoire'
  | 'orange_money_mali'
  | 'orange_money_cameroon'
  | 'opay_nigeria'         // OPay — Nigeria, Egypt
  | 'opay_egypt'
  | 'mtn_uganda'           // MTN — fill coverage gaps
  | 'mtn_cameroon'
  | 'mtn_rwanda'
  | 'airtel_uganda'
  | 'airtel_tanzania'
  | 'airtel_kenya';

export interface PayoutRequest {
  paymentId: string;
  scoutId: string;
  phoneNumber: string;
  amount: number;
  currency: string;
  provider: MobileMoneyProvider;
  description: string;
}

export interface PayoutResult {
  success: boolean;
  providerReference?: string;
  errorCode?: string;
  errorMessage?: string;
}

export async function disburseFinderfee(request: PayoutRequest): Promise<PayoutResult> {
  process.stdout.write(JSON.stringify({ level: 'info', service: 'payment-service', ts: new Date().toISOString(), msg: 'Disbursing finder fee', provider: request.provider, currency: request.currency, amount: request.amount }) + '\n');

  // Idempotency guard: if this payment already completed (e.g. on retry after timeout),
  // return the original provider reference rather than double-disbursing.
  const idempCheck = await db.query(
    `SELECT status, provider_transaction_id FROM payments WHERE id = $1`,
    [request.paymentId]
  );
  if (idempCheck.rows[0]?.status === 'completed') {
    return { success: true, providerReference: idempCheck.rows[0].provider_transaction_id };
  }

  await db.query(
    `UPDATE payments SET status = 'processing', updated_at = NOW() WHERE id = $1`,
    [request.paymentId]
  );

  let result: PayoutResult;

  try {
    switch (request.provider) {
      case 'mpesa_kenya':
      case 'mpesa_tanzania':
        result = await disburseMpesa(request);
        break;
      case 'mtn_ghana':
      case 'mtn_zambia':
        result = await disburseMTN(request);
        break;
      case 'airtel_zambia':
        result = await disburseAfricasTalking(request);
        break;
      case 'flutterwave_drc':
      case 'flutterwave_zimbabwe':
        result = await disburseFlutterwave(request);
        break;
      case 'wave_senegal':
      case 'wave_cotedivoire':
        result = await disburseWave(request);
        break;
      case 'orange_money_senegal':
      case 'orange_money_cotedivoire':
      case 'orange_money_mali':
      case 'orange_money_cameroon':
        result = await disburseOrangeMoney(request);
        break;
      case 'opay_nigeria':
      case 'opay_egypt':
        result = await disburseOpay(request);
        break;
      case 'mtn_uganda':
      case 'mtn_cameroon':
      case 'mtn_rwanda':
        result = await disburseMTN(request);
        break;
      case 'airtel_uganda':
      case 'airtel_tanzania':
      case 'airtel_kenya':
        result = await disburseAfricasTalking(request);
        break;
      default:
        result = { success: false, errorMessage: 'Unknown provider' };
    }

    if (result.success) {
      // Update payment status and scout earnings atomically — if either fails,
      // neither is committed, preventing a completed payment with uncredited scout.
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE payments SET status = 'completed', provider_transaction_id = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
          [result.providerReference, request.paymentId]
        );
        await client.query(
          `UPDATE scouts SET total_earnings_usd = total_earnings_usd + $1, pending_earnings_usd = GREATEST(0, pending_earnings_usd - $1), updated_at = NOW() WHERE id = $2`,
          [request.amount, request.scoutId]
        );
        await client.query('COMMIT');
      } catch (txError) {
        await client.query('ROLLBACK');
        throw txError;
      } finally {
        client.release();
      }
    } else {
      await db.query(
        `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [request.paymentId]
      );
    }
  } catch (error) {
    result = { success: false, errorMessage: (error as Error).message };
    await db.query(
      `UPDATE payments SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [request.paymentId]
    );
  }

  return result;
}

async function disburseMpesa(request: PayoutRequest): Promise<PayoutResult> {
  const apiKey = process.env.AFRICAS_TALKING_API_KEY!;
  const username = process.env.AFRICAS_TALKING_USERNAME!;

  try {
    const response = await axios.post(
      'https://payments.africastalking.com/mobile/b2c/request',
      new URLSearchParams({
        username,
        productName: 'AfriXplore Finder Fees',
        recipients: JSON.stringify([{
          phoneNumber: request.phoneNumber,
          amount: `KES ${(request.amount * 130).toFixed(0)}`,
          name: 'AfriXplore Scout',
          reason: 'BusinessPayment',
          metadata: { payment_id: request.paymentId },
        }]),
      }),
      { headers: { Accept: 'application/json', apiKey, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10_000 }
    );

    const entry = response.data.entries?.[0];
    if (entry?.status === 'Queued') {
      return { success: true, providerReference: entry.transactionId };
    }
    return { success: false, errorCode: entry?.status, errorMessage: entry?.errorMessage || 'M-Pesa disbursement failed' };
  } catch (error) {
    return { success: false, errorMessage: `M-Pesa error: ${(error as Error).message}` };
  }
}

async function disburseMTN(request: PayoutRequest): Promise<PayoutResult> {
  const subscriptionKey = process.env.MTN_MOMO_SUBSCRIPTION_KEY!;
  const apiUser = process.env.MTN_MOMO_API_USER!;
  const apiKey = process.env.MTN_MOMO_API_KEY!;

  try {
    const tokenResponse = await axios.post(
      `${MTN_MOMO_BASE_URL}/disbursement/token/`,
      {},
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiUser}:${apiKey}`).toString('base64')}`,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
        },
        timeout: 10_000,
      }
    );

    const accessToken = tokenResponse.data.access_token;
    const referenceId = crypto.randomUUID();

    await axios.post(
      `${MTN_MOMO_BASE_URL}/disbursement/v1_0/transfer`,
      {
        amount: request.amount.toFixed(2),
        currency: request.currency,
        externalId: request.paymentId,
        payee: { partyIdType: 'MSISDN', partyId: request.phoneNumber.replace('+', '') },
        payerMessage: 'AfriXplore Finder Fee',
        payeeNote: request.description,
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': MTN_MOMO_TARGET_ENV,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      }
    );

    return { success: true, providerReference: referenceId };
  } catch (error) {
    return { success: false, errorMessage: `MTN MoMo error: ${(error as Error).message}` };
  }
}

async function disburseFlutterwave(request: PayoutRequest): Promise<PayoutResult> {
  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY!;

  try {
    const response = await axios.post(
      'https://api.flutterwave.com/v3/transfers',
      {
        account_bank: 'MPS',
        account_number: request.phoneNumber,
        amount: request.amount,
        narration: request.description,
        currency: request.currency,
        reference: request.paymentId,
        callback_url: `${process.env.API_BASE_URL}/webhooks/flutterwave`,
        debit_currency: 'USD',
        meta: { sender: 'AfriXplore', mobile_number: request.phoneNumber, payment_type: 'mobilemoney' },
      },
      { headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' }, timeout: 10_000 }
    );

    if (response.data.status === 'success') {
      return { success: true, providerReference: response.data.data?.id?.toString() };
    }
    return { success: false, errorMessage: response.data.message };
  } catch (error: any) {
    return { success: false, errorMessage: `Flutterwave error: ${error.response?.data?.message || error.message}` };
  }
}

async function disburseAfricasTalking(request: PayoutRequest): Promise<PayoutResult> {
  const apiKey = process.env.AFRICAS_TALKING_API_KEY!;
  const username = process.env.AFRICAS_TALKING_USERNAME!;

  try {
    const response = await axios.post(
      'https://payments.africastalking.com/mobile/b2c/request',
      new URLSearchParams({
        username,
        productName: 'AfriXplore',
        recipients: JSON.stringify([{
          phoneNumber: request.phoneNumber,
          amount: `${request.currency} ${request.amount}`,
          reason: 'BusinessPayment',
        }]),
      }),
      { headers: { Accept: 'application/json', apiKey, 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 10_000 }
    );

    const entry = response.data.entries?.[0];
    if (entry?.status === 'Queued') return { success: true, providerReference: entry.transactionId };
    return { success: false, errorMessage: entry?.errorMessage };
  } catch (error) {
    return { success: false, errorMessage: `Africa's Talking error: ${(error as Error).message}` };
  }
}

async function disburseWave(request: PayoutRequest): Promise<PayoutResult> {
  const apiKey = process.env.WAVE_API_KEY!;
  try {
    const xofRate = await getUsdToRate('XOF');
    const response = await axios.post(
      'https://api.wave.com/v1/payout',
      {
        currency: 'XOF',  // WAEMU zone
        receive_amount: String(Math.round(request.amount * xofRate)),  // USD → XOF (live rate)
        mobile: request.phoneNumber,
        name: 'AfriXplore Scout',
        client_reference: request.paymentId,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': request.paymentId,
        },
        timeout: 10_000,
      }
    );
    if (response.data.id) {
      return { success: true, providerReference: response.data.id };
    }
    return { success: false, errorMessage: response.data.error ?? 'Wave payout failed' };
  } catch (error: any) {
    return { success: false, errorMessage: `Wave error: ${error.response?.data?.error || error.message}` };
  }
}

async function disburseOrangeMoney(request: PayoutRequest): Promise<PayoutResult> {
  const clientId = process.env.ORANGE_MONEY_CLIENT_ID!;
  const clientSecret = process.env.ORANGE_MONEY_CLIENT_SECRET!;
  try {
    // Step 1: Get access token
    const tokenRes = await axios.post(
      'https://api.orange.com/oauth/v3/token',
      new URLSearchParams({ grant_type: 'client_credentials' }),
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        },
        timeout: 10_000,
      }
    );
    const token = tokenRes.data.access_token;

    // Step 2: B2C cashout
    const country = request.provider.includes('senegal') ? 'SN'
      : request.provider.includes('mali') ? 'ML'
      : request.provider.includes('cameroon') ? 'CM'
      : 'CI';

    const xofRate = await getUsdToRate('XOF');
    const response = await axios.post(
      `https://api.orange.com/orange-money-webpay/${country}/v1/cashout`,
      {
        merchant_key: process.env.ORANGE_MONEY_MERCHANT_KEY,
        currency: 'XOF',
        order_id: request.paymentId,
        amount: String(Math.round(request.amount * xofRate)),  // USD → XOF (live rate)
        return_url: `${process.env.API_BASE_URL}/webhooks/orange-money`,
        cancel_url: `${process.env.API_BASE_URL}/webhooks/orange-money`,
        notif_url: `${process.env.API_BASE_URL}/webhooks/orange-money`,
        lang: 'fr',
        reference: request.paymentId,
        subscriber_msisdn: request.phoneNumber.replace('+', ''),
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, timeout: 10_000 }
    );

    if (response.data.status === '00') {
      return { success: true, providerReference: response.data.txnid };
    }
    return { success: false, errorMessage: response.data.message ?? 'Orange Money payout failed' };
  } catch (error: any) {
    return { success: false, errorMessage: `Orange Money error: ${error.response?.data?.message || error.message}` };
  }
}

async function disburseOpay(request: PayoutRequest): Promise<PayoutResult> {
  const merchantId = process.env.OPAY_MERCHANT_ID!;
  const secretKey = process.env.OPAY_SECRET_KEY!;
  const country = request.provider === 'opay_egypt' ? 'EG' : 'NG';
  const currency = country === 'EG' ? 'EGP' : 'NGN';
  const rate = await getUsdToRate(currency);  // live USD → EGP or NGN

  try {
    const payload = {
      amount: { currency, total: String(Math.round(request.amount * rate)) },
      country,
      reason: 'AfriXplore Finder Fee',
      receiver: {
        type: 'USER',
        phoneNumber: request.phoneNumber,
        name: 'AfriXplore Scout',
      },
      reference: request.paymentId,
    };

    const hash = require('crypto')
      .createHmac('sha512', secretKey)
      .update(JSON.stringify(payload))
      .digest('hex');

    const response = await axios.post(
      'https://cashierapi.opayweb.com/api/v3/transfer/toWallet',
      payload,
      {
        headers: {
          Authorization: `Bearer ${Buffer.from(merchantId).toString('base64')}`,
          MerchantId: merchantId,
          HashKey: hash,
          'Content-Type': 'application/json',
        },
        timeout: 10_000,
      }
    );

    if (response.data.code === '00000') {
      return { success: true, providerReference: response.data.data?.orderNo };
    }
    return { success: false, errorMessage: response.data.message ?? 'OPay transfer failed' };
  } catch (error: any) {
    return { success: false, errorMessage: `OPay error: ${error.response?.data?.message || error.message}` };
  }
}

export function getProviderForCountry(country: string, preferredProvider?: string): MobileMoneyProvider {
  if (preferredProvider && preferredProvider !== 'manual') {
    return preferredProvider as MobileMoneyProvider;
  }

  const countryProviderMap: Record<string, MobileMoneyProvider> = {
    KE: 'mpesa_kenya',
    TZ: 'airtel_tanzania',    // Tanzania — Airtel (was mpesa)
    GH: 'mtn_ghana',
    ZM: 'mtn_zambia',
    CD: 'flutterwave_drc',
    ZW: 'flutterwave_zimbabwe',
    SN: 'wave_senegal',       // Senegal — Wave dominant
    CI: 'orange_money_cotedivoire', // Côte d'Ivoire
    ML: 'orange_money_mali',  // Mali
    BF: 'wave_cotedivoire',   // Burkina Faso — Wave
    GN: 'orange_money_senegal', // Guinea
    CM: 'orange_money_cameroon', // Cameroon
    MG: 'orange_money_senegal', // Madagascar
    UG: 'mtn_uganda',         // Uganda
    RW: 'mtn_rwanda',         // Rwanda
    NG: 'opay_nigeria',       // Nigeria — OPay
    EG: 'opay_egypt',         // Egypt
    ET: 'airtel_kenya',       // Ethiopia — best available
  };

  return countryProviderMap[country.toUpperCase()] || 'mpesa_kenya';
}

export async function createFinderFeePayment(
  scoutId: string,
  reportId: string,
  clusterId: string,
  amountUsd: number
): Promise<string> {
  const result = await db.query(
    `INSERT INTO payments (scout_id, report_id, cluster_id, amount_usd, type, provider, status)
     SELECT $1, $2, $3, $4, 'finder_fee', COALESCE(s.wallet_provider, 'mpesa')::payment_provider, 'pending'
     FROM scouts s WHERE s.id = $1
     RETURNING id`,
    [scoutId, reportId, clusterId, amountUsd]
  );
  return result.rows[0].id;
}
