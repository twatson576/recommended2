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
    if (userId) {
      const { error } = await supabase
        .from("pros")
        .update({ is_pro_plus: true })
        .eq("id", userId);
      if (error) console.error("Supabase update error:", error.message);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const customerId = subscription.customer;
    // Look up user by stripe_customer_id if you store it, or use metadata
    console.log("Subscription cancelled for customer:", customerId);
    // TODO: set is_pro_plus = false when cancellation is implemented
  }

  res.status(200).json({ received: true });
}
