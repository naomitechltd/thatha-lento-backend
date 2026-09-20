const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
const uid = () => crypto.randomBytes(9).toString("hex");

const VALID_STATUSES = ["pending payment", "paid", "processing", "shipped", "delivered", "cancelled"];

function serialize(row) {
  return {
    id: row.id,
    userEmail: row.user_email,
    items: JSON.parse(row.items || "[]"),
    total: row.total,
    status: row.status,
    recipientName: row.recipient_name,
    phone: row.phone,
    location: row.location,
    termsAcceptedAt: row.terms_accepted_at,
    createdAt: row.created_at,
  };
}

// POST /orders — create a new order for the logged-in user
router.post("/", requireAuth, async (req, res) => {
  try {
    const { items, total, recipientName, phone, location, termsAccepted } = req.body || {};
    if (!Array.isArray(items) || items.length === 0 || total == null || !termsAccepted) {
      return res.status(400).json({ error: "Items, total and accepted terms are required." });
    }

    const row = {
      id: uid(),
      user_email: req.user.email,
      items: JSON.stringify(items),
      total: Number(total),
      status: "pending payment",
      recipient_name: recipientName || req.user.name || "",
      phone: phone || "",
      location: location || "",
      terms_accepted_at: Date.now(),
      created_at: Date.now(),
    };

    await db.query(
      `INSERT INTO orders
        (id, user_email, items, total, status, recipient_name, phone, location, terms_accepted_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        row.id, row.user_email, row.items, row.total, row.status,
        row.recipient_name, row.phone, row.location, row.terms_accepted_at, row.created_at
      ]
    );

    res.status(201).json(serialize(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create order." });
  }
});

// GET /orders/mine — logged-in user's own orders
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM orders WHERE user_email = $1 ORDER BY created_at DESC",
      [req.user.email]
    );
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load orders." });
  }
});

// GET /orders/:id — a single order (owner only)
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Order not found." });
    if (rows[0].user_email !== req.user.email) {
      return res.status(403).json({ error: "Not authorized to view this order." });
    }
    res.json(serialize(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load order." });
  }
});

// GET /orders — all orders (admin only)
router.get("/", requireAdmin("full"), async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM orders ORDER BY created_at DESC");
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load orders." });
  }
});

// PATCH /orders/:id/status — update order status (admin only)
router.patch("/:id/status", requireAdmin("full"), async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}` });
    }

    const result = await db.query("UPDATE orders SET status=$1 WHERE id=$2", [status, req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Order not found." });

    const { rows } = await db.query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    res.json(serialize(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update order status." });
  }
});

// DELETE /orders/:id — full admin only
router.delete("/:id", requireAdmin("full"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM orders WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Order not found." });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete order." });
  }
});

module.exports = router;
