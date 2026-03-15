import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { buffer } from "micro";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Webhook signature error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const userId = session.metadata?.userId;
    const customerId = session.customer;
    if (userId) {
      // Activate Pro+ and store stripe_customer_id for future cancellation lookup
      const { error } = await supabase
        .from("pros")
        .update({ is_pro_plus: true, stripe_customer_id: customerId || null })
        .eq("id", userId);
      if (error) console.error("Supabase update error:", error.message);
    }
  }

  if (event.type === "customer.subscription.deleted" || event.type === "customer.subscription.updated") {
    const subscription = event.data.object;
    // Only deactivate if status is cancelled/unpaid — not on pause or other states
    const shouldDeactivate = ["canceled", "unpaid", "incomplete_expired"].includes(subscription.status);
    if (shouldDeactivate) {
      const customerId = subscription.customer;
      const { error } = await supabase
        .from("pros")
        .update({ is_pro_plus: false })
        .eq("stripe_customer_id", customerId);
      if (error) console.error("Supabase deactivation error:", error.message);
      else console.log("Pro+ deactivated for customer:", customerId);
    }
  }

  res.status(200).json({ received: true });
}
