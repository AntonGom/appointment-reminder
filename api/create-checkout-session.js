export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const stripePriceId = process.env.STRIPE_PRO_MONTHLY_PRICE_ID;

  if (!stripeSecretKey || !stripePriceId) {
    return res.status(500).json({ error: "Stripe is not configured yet." });
  }

  try {
    const { email, returnPath } = req.body || {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(email)) {
      return res.status(400).json({ error: "A valid signed-in email address is required." });
    }

    const baseUrl = getBaseUrl(req);
    const safeReturnPath = typeof returnPath === "string" && /^\/[a-z0-9-]+\.html$/i.test(returnPath)
      ? returnPath
      : "/client-details.html";
    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("success_url", `${baseUrl}${safeReturnPath}?checkout=success`);
    form.set("cancel_url", `${baseUrl}${safeReturnPath}?checkout=cancel`);
    form.set("allow_promotion_codes", "true");
    form.set("customer_email", email);
    form.set("line_items[0][price]", stripePriceId);
    form.set("line_items[0][quantity]", "1");

    const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: form.toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `Stripe error: ${errorText}` });
    }

    const session = await response.json();
    return res.status(200).json({ url: session.url });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Unable to create checkout session." });
  }
}

function getBaseUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`;
}
