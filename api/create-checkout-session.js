import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { userId, email, interval } = req.body;
    if (!userId || !email) return res.status(400).json({ error: "Missing userId or email" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: email,
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: "reffered Pro+" },
            unit_amount: interval === "year" ? 7500 : 999,
            recurring: { interval: interval === "year" ? "year" : "month" },
          },
          quantity: 1,
        },
      ],
      metadata: { userId },
      success_url: `${req.headers.origin}/?pro_success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin}/?page=dashboard`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err.message);
    res.status(500).json({ error: err.message });
  }
}
