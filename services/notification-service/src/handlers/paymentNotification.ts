import { ServiceBusReceivedMessage } from '@azure/service-bus';
import { sendSMS } from '../services/smsService';
import { db } from '../db/client';

const log = {
  info:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'info',  service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  warn:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'warn',  service: 'notification-service', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
};

interface PaymentMessage {
  scoutId: string;
  paymentId: string;
  amount: number;
  currency: string;
  type: 'finder_fee' | 'bonus' | 'adjustment';
  status: 'completed' | 'failed';
  providerReference?: string;
}

export async function sendPaymentNotification(message: ServiceBusReceivedMessage): Promise<void> {
  const body = message.body as PaymentMessage;

  log.info('Processing payment notification', {
    scoutId: body.scoutId,
    paymentId: body.paymentId,
    type: body.type,
    status: body.status,
  });

  // Look up scout's phone number for SMS
  const result = await db.query(
    `SELECT phone, full_name FROM scouts WHERE id = $1`,
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
}

function buildSuccessSMS(body: PaymentMessage, fullName: string): string {
  const firstName = fullName.split(' ')[0];
  return (
    `AfriXplore Payment\n` +
    `Hi ${firstName}! Your ${body.type.replace('_', ' ')} of ` +
    `${body.currency} ${body.amount.toFixed(2)} has been sent.\n` +
    `Ref: ${body.providerReference?.slice(0, 8) ?? body.paymentId.slice(0, 8)}`
  ).slice(0, 160);
}

function buildFailureSMS(body: PaymentMessage, fullName: string): string {
  const firstName = fullName.split(' ')[0];
  return (
    `AfriXplore Payment\n` +
    `Hi ${firstName}, your ${body.type.replace('_', ' ')} of ` +
    `${body.currency} ${body.amount.toFixed(2)} could not be processed. ` +
    `Please contact support.`
  ).slice(0, 160);
}
