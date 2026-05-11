import { ServiceBusReceivedMessage } from '@azure/service-bus';
import { sendSMS } from '../services/smsService';
import { sendFCMPush } from '../services/fcmService';
import { db } from '../db/client';

const log = {
  info:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'info',  service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  warn:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'warn',  service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
};

interface PaymentMessage {
  event: string;
  scoutId: string;
  paymentId: string;
  amount: number;
  provider: string;
  reference?: string;
  // Normalised fields populated below
  currency?: string;
  type?: 'finder_fee' | 'bonus' | 'adjustment';
  status?: 'completed' | 'failed';
  providerReference?: string;
}

interface NormalisedPaymentMessage {
  scoutId: string;
  paymentId: string;
  amount: number;
  currency: string;
  type: 'finder_fee' | 'bonus' | 'adjustment';
  status: 'completed' | 'failed';
  providerReference?: string;
}

function normalise(body: PaymentMessage): NormalisedPaymentMessage {
  return {
    scoutId: body.scoutId,
    paymentId: body.paymentId,
    amount: body.amount,
    currency: body.currency ?? 'USD',
    type: body.type ?? 'finder_fee',
    status: body.event === 'disbursed' ? 'completed' : (body.status ?? 'failed'),
    providerReference: body.reference ?? body.providerReference,
  };
}

export async function sendPaymentNotification(message: ServiceBusReceivedMessage): Promise<void> {
  const body = normalise(message.body as PaymentMessage);

  log.info('Processing payment notification', {
    scoutId: body.scoutId,
    paymentId: body.paymentId,
    type: body.type,
    status: body.status,
  });

  // Look up scout's contact details
  const result = await db.query(
    `SELECT phone, full_name, fcm_token FROM scouts WHERE id = $1`,
    [body.scoutId]
  );

  if (!result.rows.length) {
    log.warn('Scout not found for payment notification', { scoutId: body.scoutId });
    return;
  }

  const scout = result.rows[0];

  if (!scout.phone) {
    log.warn('Scout has no phone number — skipping SMS', { scoutId: body.scoutId });
    return;
  }

  const smsText = body.status === 'completed'
    ? buildSuccessSMS(body, scout.full_name)
    : buildFailureSMS(body, scout.full_name);

  await sendSMS(scout.phone, smsText);

  if (scout.fcm_token) {
    const pushTitle = body.status === 'completed' ? 'Payment Sent!' : 'Payment Failed';
    await sendFCMPush(scout.fcm_token, pushTitle, smsText, {
      paymentId: body.paymentId,
      type: body.type,
    }).catch((err: Error) =>
      log.warn('FCM push failed for payment notification', { scoutId: body.scoutId, error: err.message })
    );
  }
}

function buildSuccessSMS(body: NormalisedPaymentMessage, fullName: string): string {
  const firstName = fullName.split(' ')[0];
  return (
    `AfriXplore Payment\n` +
    `Hi ${firstName}! Your ${body.type.replace('_', ' ')} of ` +
    `${body.currency} ${body.amount.toFixed(2)} has been sent.\n` +
    `Ref: ${body.providerReference?.slice(0, 8) ?? body.paymentId.slice(0, 8)}`
  ).slice(0, 160);
}

function buildFailureSMS(body: NormalisedPaymentMessage, fullName: string): string {
  const firstName = fullName.split(' ')[0];
  return (
    `AfriXplore Payment\n` +
    `Hi ${firstName}, your ${body.type.replace('_', ' ')} of ` +
    `${body.currency} ${body.amount.toFixed(2)} could not be processed. ` +
    `Please contact support.`
  ).slice(0, 160);
}
