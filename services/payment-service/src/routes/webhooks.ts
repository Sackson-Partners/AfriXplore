import { Router, Request, Response } from 'express';
import express from 'express';

const router = Router();

// Stripe webhook — raw body required for signature verification
router.post('/stripe', express.raw({ type: 'application/json' }), (req: Request, res: Response) => {
  // TODO: Verify Stripe webhook signature
  // TODO: Handle subscription events (invoice.paid, customer.subscription.deleted, etc.)
  res.json({ received: true });
});

export { router as webhookRouter };
