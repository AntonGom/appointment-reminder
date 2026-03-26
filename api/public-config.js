export default function handler(req, res) {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "";
  const stripePriceLabel = process.env.PRO_MONTHLY_PRICE_LABEL || "$9/month";

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    supabaseUrl,
    supabasePublishableKey,
    accountsEnabled: Boolean(supabaseUrl && supabasePublishableKey),
    paymentsEnabled: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRO_MONTHLY_PRICE_ID),
    stripePriceLabel
  });
}
