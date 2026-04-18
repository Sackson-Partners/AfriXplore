import axios from 'axios';
import { db } from '../db/client';

export type MobileMoneyProvider =
  | 'mpesa_kenya'
  | 'mpesa_tanzania'
  | 'mtn_ghana'
  | 'mtn_zambia'
  | 'airtel_zambia'
  | 'flutterwave_drc'
  | 'flutterwave_zimbabwe';

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
  console.log(`Disbursing ${request.currency} ${request.amount} to ${request.phoneNumber} via ${request.provider}`);

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
      default:
        result = { success: false, errorMessage: 'Unknown provider' };
    }

    if (result.success) {
      await db.query(
        `UPDATE payments SET status = 'completed', provider_transaction_id = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
        [result.providerReference, request.paymentId]
      );

      await db.query(
        `UPDATE scouts SET total_earnings_usd = total_earnings_usd + $1, pending_earnings_usd = GREATEST(0, pending_earnings_usd - $1), updated_at = NOW() WHERE id = $2`,
        [request.amount, request.scoutId]
      );
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
      { headers: { Accept: 'application/json', apiKey, 'Content-Type': 'application/x-www-form-urlencoded' } }
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
      'https://sandbox.momodeveloper.mtn.com/disbursement/token/',
      {},
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${apiUser}:${apiKey}`).toString('base64')}`,
          'Ocp-Apim-Subscription-Key': subscriptionKey,
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    const referenceId = crypto.randomUUID();

    await axios.post(
      'https://sandbox.momodeveloper.mtn.com/disbursement/v1_0/transfer',
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
          'X-Target-Environment': process.env.NODE_ENV === 'production' ? 'mtnzambia' : 'sandbox',
          'Ocp-Apim-Subscription-Key': subscriptionKey,
          'Content-Type': 'application/json',
        },
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
      { headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' } }
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
      { headers: { Accept: 'application/json', apiKey, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const entry = response.data.entries?.[0];
    if (entry?.status === 'Queued') return { success: true, providerReference: entry.transactionId };
    return { success: false, errorMessage: entry?.errorMessage };
  } catch (error) {
    return { success: false, errorMessage: `Africa's Talking error: ${(error as Error).message}` };
  }
}

export function getProviderForCountry(country: string, preferredProvider?: string): MobileMoneyProvider {
  if (preferredProvider && preferredProvider !== 'manual') {
    return preferredProvider as MobileMoneyProvider;
  }

  const countryProviderMap: Record<string, MobileMoneyProvider> = {
    KE: 'mpesa_kenya',
    TZ: 'mpesa_tanzania',
    GH: 'mtn_ghana',
    ZM: 'mtn_zambia',
    CD: 'flutterwave_drc',
    ZW: 'flutterwave_zimbabwe',
    NG: 'flutterwave_drc',
    CI: 'flutterwave_drc',
    SN: 'flutterwave_drc',
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
