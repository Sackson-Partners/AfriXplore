'use server';

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const PRICE_IDS: Record<string, string> = {
  starter:      process.env.STRIPE_PRICE_STARTER!,
  professional: process.env.STRIPE_PRICE_PROFESSIONAL!,
  enterprise:   process.env.STRIPE_PRICE_ENTERPRISE!,
};

export interface CheckoutResult {
  error?: string;
  url?: string;
}

export async function createCheckoutSession(
  tier: 'starter' | 'professional' | 'enterprise',
  companyName: string,
  contactEmail: string,
  selectedTerritories: string[]
): Promise<CheckoutResult> {
  const priceId = PRICE_IDS[tier];
  if (!priceId) {
    return { error: `No price configured for tier: ${tier}` };
  }

  try {
    const customers = await stripe.customers.list({ email: contactEmail, limit: 1 });

    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: contactEmail,
        name: companyName,
        metadata: { tier, territories: selectedTerritories.join(','), source: 'platform_web' },
      });
      customerId = customer.id;
    }

    const TRIAL_DAYS: Record<string, number> = { starter: 14, professional: 30, enterprise: 30 };

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url:
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:
        `${process.env.NEXT_PUBLIC_APP_URL}/pricing?checkout=cancelled`,
      metadata: { tier, company_name: companyName, territories: selectedTerritories.join(',') },
      subscription_data: {
        metadata: { tier, company_name: companyName, territories: selectedTerritories.join(',') },
        trial_period_days: TRIAL_DAYS[tier] ?? 14,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      customer_update: { address: 'auto', name: 'auto' },
    });

    if (!session.url) return { error: 'Failed to create checkout session' };
    return { url: session.url };
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return {
      error: error instanceof Error ? error.message : 'Checkout failed. Please try again.',
    };
  }
}

export async function getCheckoutStatus(
  sessionId: string
): Promise<{ status: string; tier: string; companyName: string }> {
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  });

  return {
    status:      session.payment_status,
    tier:        session.metadata?.tier || 'starter',
    companyName: session.metadata?.company_name || '',
  };
}
