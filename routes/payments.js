const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const paystackConfigured = !!PAYSTACK_SECRET_KEY;
if (!paystackConfigured) {
  console.warn("PAYSTACK_SECRET_KEY is not set — /payments routes will return 503 until it is added.");
}

const PAYSTACK_BASE = "https://api.paystack.co";
const CURRENCY = process.env.PAYSTACK_CURRENCY || "ZAR";

// POST /payments/initialize — start a Paystack transaction for an existing order.
router.post("/initialize", requireAuth, async (req, res) => {
  if (!paystackConfigured) return res.status(503).json({ error: "Payments are not configured yet." });
  try {
    const { orderId } = req.body || {};
    if (!orderId) return res.status(400).json({ error: "orderId is required." });

    const { rows } = await db.query("SELECT * FROM orders WHERE id = $1", [orderId]);
    if (rows.length === 0) return res.status(404).json({ error: "Order not found." });

    const order = rows[0];
    if (order.user_email !== req.user.email) {
      return res.status(403).json({ error: "Not authorized to pay for this order." });
    }
    if (order.status !== "pending payment") {
      return res.status(400).json({ error: "This order is not awaiting payment." });
    }

    const paystackRes = await fetch(`${PAYSTACK_BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: req.user.email,
        amount: Math.round(Number(order.total) * 100),
        currency: CURRENCY,
        reference: `${order.id}-${Date.now()}`,
        metadata: { order_id: order.id },
        callback_url: process.env.PAYSTACK_CALLBACK_URL || undefined,
      }),
    });

    const data = await paystackRes.json();
    if (!paystackRes.ok || !data.status) {
      console.error("Paystack initialize failed:", data);
      return res.status(502).json({ error: "Could not start payment. Try again shortly." });
    }

    res.json({
      authorizationUrl: data.data.authorization_url,
      reference: data.data.reference,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start payment." });
  }
});

// POST /payments/webhook — Paystack calls this directly when a payment event happens.
router.post("/webhook", async (req, res) => {
  if (!paystackConfigured) return res.sendStatus(503);
  try {
    const signature = req.headers["x-paystack-signature"];
    const expected = crypto
      .createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(req.rawBody || Buffer.from(JSON.stringify(req.body)))
      .digest("hex");

    if (!signature || signature !== expected) {
      return res.status(401).json({ error: "Invalid signature." });
    }

    const event = req.body;

    if (event.event === "charge.success") {
      const orderId = event.data?.metadata?.order_id;
      const reference = event.data?.reference;
      if (orderId) {
        await db.query(
          "UPDATE orders SET status = 'paid', payment_reference = $1 WHERE id = $2 AND status = 'pending payment'",
          [reference, orderId]
        );
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(200);
  }
});

// GET /payments/verify/:reference — optional instant-feedback check for the frontend.
router.get("/verify/:reference", requireAuth, async (req, res) => {
  if (!paystackConfigured) return res.status(503).json({ error: "Payments are not configured yet." });
  try {
    const paystackRes = await fetch(
      `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(req.params.reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
    );
    const data = await paystackRes.json();
    if (!paystackRes.ok || !data.status) {
      return res.status(502).json({ error: "Could not verify payment." });
    }
    res.json({ status: data.data.status, orderId: data.data.metadata?.order_id || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to verify payment." });
  }
});

module.exports = router;
