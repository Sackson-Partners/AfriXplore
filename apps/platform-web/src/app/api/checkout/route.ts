import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { z } from 'zod';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const BodySchema = z.object({
  priceId: z.string().min(1),
  planId: z.enum(['scout', 'professional']),
  annual: z.boolean(),
});

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://platform.afrixplore.io';

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: body.priceId, quantity: 1 }],
    success_url: `${origin}/dashboard?checkout=success&plan=${body.planId}`,
    cancel_url:  `${origin}/pricing?checkout=cancelled`,
    subscription_data: {
      metadata: { planId: body.planId, billing: body.annual ? 'annual' : 'monthly' },
      trial_period_days: 14,
    },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
