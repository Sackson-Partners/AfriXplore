/**
 * POST /webhooks/stripe
 *
 * Receives Stripe lifecycle events and keeps the subscribers table in sync.
 * IMPORTANT: this route must be mounted BEFORE express.json() so Express does
 * not parse the body — Stripe signature verification requires the raw buffer.
 *
 * Handled events:
 *   checkout.session.completed        → activate subscriber (trial or paid)
 *   customer.subscription.updated     → sync tier/status changes
 *   customer.subscription.deleted     → deactivate subscriber
 *   invoice.payment_failed            → flag payment failure (keeps access)
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from '../db/client';

const router = Router();

const log = {
  info:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'info',  service: 'intelligence-api', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  warn:  (msg: string, extra?: object) => process.stdout.write(JSON.stringify({ level: 'warn',  service: 'intelligence-api', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
  error: (msg: string, extra?: object) => process.stderr.write(JSON.stringify({ level: 'error', service: 'intelligence-api', ts: new Date().toISOString(), msg, ...extra }) + '\n'),
};

function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' });
}

// Derive our internal tier from Stripe metadata/plan name
function tierFromMetadata(metadata: Stripe.Metadata): 'starter' | 'professional' | 'enterprise' {
  const planId = metadata.planId ?? '';
  if (planId === 'enterprise') return 'enterprise';
  if (planId === 'professional') return 'professional';
  return 'starter';
}

router.post(
  '/',
  // express.raw() is applied at mount time in index.ts — body arrives as Buffer here
  async (req: Request, res: Response) => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      log.warn('STRIPE_WEBHOOK_SECRET not set — rejecting webhook');
      return res.status(503).json({ error: 'Webhook not configured' });
    }

    const sig = req.headers['stripe-signature'] as string | undefined;
    if (!sig) {
      return res.status(400).json({ error: 'Missing stripe-signature header' });
    }

    let event: Stripe.Event;
    try {
      event = getStripe().webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
    } catch (err) {
      log.warn('Stripe webhook signature verification failed', { error: String(err) });
      return res.status(400).json({ error: 'Invalid signature' });
    }

    log.info('Stripe webhook received', { type: event.type, id: event.id });

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session;
          const customerId = session.customer as string;
          const subscriptionId = session.subscription as string;
          const metadata = session.metadata ?? {};
          const tier = tierFromMetadata(metadata);

          // Link Stripe customer to subscriber row via email
          await db.query(
            `UPDATE subscribers
               SET stripe_customer_id  = $1,
                   stripe_subscription_id = $2,
                   tier                 = $3,
                   status               = 'active',
                   updated_at           = NOW()
             WHERE email = $4`,
            [customerId, subscriptionId, tier, session.customer_details?.email ?? '']
          );
          log.info('Subscriber activated via checkout', { customerId, tier });
          break;
        }

        case 'customer.subscription.updated': {
          const sub = event.data.object as Stripe.Subscription;
          const tier = tierFromMetadata(sub.metadata);
          const isActive = sub.status === 'active' || sub.status === 'trialing';

          await db.query(
            `UPDATE subscribers
               SET tier       = $1,
                   status     = $2,
                   updated_at = NOW()
             WHERE stripe_customer_id = $3`,
            [tier, isActive ? 'active' : 'inactive', sub.customer as string]
          );
          log.info('Subscriber tier/status synced', { customerId: sub.customer, tier, status: sub.status });
          break;
        }

        case 'customer.subscription.deleted': {
          const sub = event.data.object as Stripe.Subscription;
          await db.query(
            `UPDATE subscribers SET status = 'inactive', updated_at = NOW()
             WHERE stripe_customer_id = $1`,
            [sub.customer as string]
          );
          log.info('Subscriber deactivated', { customerId: sub.customer });
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object as Stripe.Invoice;
          log.warn('Invoice payment failed — subscriber retains access until grace period expires', {
            customerId: invoice.customer,
            invoiceId: invoice.id,
            attemptCount: invoice.attempt_count,
          });
          // Access is not revoked here — Stripe's Smart Retries handle dunning.
          // subscription.deleted fires if all retries are exhausted.
          break;
        }

        default:
          // Unhandled event types — acknowledge receipt so Stripe stops retrying
          log.info('Unhandled Stripe event type — ignoring', { type: event.type });
      }
    } catch (err) {
      log.error('Error processing Stripe webhook', { type: event.type, error: String(err) });
      // Return 500 so Stripe retries the event
      return res.status(500).json({ error: 'Internal error processing webhook' });
    }

    return res.json({ received: true });
  }
);

export { router as webhookRouter };
