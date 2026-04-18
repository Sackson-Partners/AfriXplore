import Script from 'next/script'

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-16">
      <Script
        src="https://js.stripe.com/v3/pricing-table.js"
        strategy="lazyOnload"
      />
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold mb-4">
            AfriXplore{' '}
            <span className="text-amber-400">Intelligence Platform</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Africa&apos;s only real-time mineral intelligence platform.
            Powered by 10M+ artisanal miners as geological sensors.
          </p>
          <p className="text-sm text-gray-500 mt-3">
            Annual billing · USD · Enterprise licensing
          </p>
        </div>

        {/* Stripe Pricing Table */}
        <stripe-pricing-table
          pricing-table-id={process.env.NEXT_PUBLIC_STRIPE_PRICING_TABLE_ID}
          publishable-key={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
        />
      </div>
    </main>
  )
}
