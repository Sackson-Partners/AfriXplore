import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { db } from '../db/client';
import { publishToServiceBus } from '../utils/serviceBus';

const router = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
  typescript: true,
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

router.post('/', async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err) {
    console.error('Stripe webhook signature failed:', err);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  res.json({ received: true });

  try {
    await handleStripeEvent(event);
  } catch (error) {
    console.error(`Error processing Stripe event ${event.type}:`, error);
  }
});

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {

    case 'customer.subscription.created': {
      const subscription = event.data.object as Stripe.Subscription;

      await db.query(
        `UPDATE subscribers
         SET stripe_subscription_id = $1,
             subscription_start = $2,
             subscription_end = $3,
             is_active = true,
             updated_at = NOW()
         WHERE stripe_customer_id = $4`,
        [
          subscription.id,
          new Date(subscription.current_period_start * 1000).toISOString(),
          new Date(subscription.current_period_end * 1000).toISOString(),
          subscription.customer,
        ]
      );

      await publishToServiceBus('subscription-changed', {
        event: 'created',
        stripeCustomerId: subscription.customer,
        subscriptionId: subscription.id,
        tier: subscription.metadata.tier || 'starter',
        periodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
      });

      console.log(`Subscription created: ${subscription.id}`);
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;

      if (invoice.billing_reason === 'subscription_cycle') {
        await db.query(
          `UPDATE subscribers SET subscription_end = $1, updated_at = NOW() WHERE stripe_customer_id = $2`,
          [new Date((invoice.period_end!) * 1000).toISOString(), invoice.customer]
        );
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;

      await db.query(
        `UPDATE subscribers SET is_active = false, updated_at = NOW() WHERE stripe_customer_id = $1`,
        [subscription.customer]
      );

      await publishToServiceBus('subscription-changed', {
        event: 'cancelled',
        stripeCustomerId: subscription.customer,
      });
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.error(`Payment failed for customer ${invoice.customer}`);

      await publishToServiceBus('subscription-changed', {
        event: 'payment_failed',
        stripeCustomerId: invoice.customer,
        invoiceId: invoice.id,
      });
      break;
    }

    default:
      console.log(`Unhandled Stripe event: ${event.type}`);
  }
}

export { router as stripeWebhookRouter };
