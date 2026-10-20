// The one place that says what Premium costs and what it includes. Every
// upgrade surface reads from here, so the popup cannot contradict itself.
// Only list what actually exists in the product.

export interface Plan {
  id: 'monthly' | 'yearly';
  name: string;
  price: string;
  priceId: string; // Stripe price ID
  period: 'month' | 'year';
  features: string[];
  popular?: boolean;
}

export const FREE_BLOCKED_SITES_LIMIT = 3;
export const FREE_HISTORY_DAYS = 7;
export const PREMIUM_HISTORY_DAYS = 30;

export const PREMIUM_FEATURES: string[] = [
  'Unlimited website blocking',
  `${PREMIUM_HISTORY_DAYS} days of history instead of ${FREE_HISTORY_DAYS}`,
  'Focus sessions that block your distracting sites',
  'Sync and a combined view across your devices',
];

// Stripe price IDs come from the build settings (STRIPE_PRICE_MONTHLY and
// STRIPE_PRICE_YEARLY in .env): test-mode prices for local builds, live prices
// for the store build.
export const PLANS: Plan[] = [
  {
    id: 'monthly',
    name: 'Premium Monthly',
    price: '$4.99',
    priceId: process.env.STRIPE_PRICE_MONTHLY as string,
    period: 'month',
    features: PREMIUM_FEATURES,
  },
  {
    id: 'yearly',
    name: 'Premium Yearly',
    price: '$49.99',
    priceId: process.env.STRIPE_PRICE_YEARLY as string,
    period: 'year',
    popular: true,
    // 12 x $4.99 = $59.88, so the yearly price is about ten months' worth
    features: [...PREMIUM_FEATURES, '2 months free compared with paying monthly'],
  },
];

export const PRICE_SUMMARY = `${PLANS[0].price}/month or ${PLANS[1].price}/year`;
