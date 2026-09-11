const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { requireUser, requireAdmin } = require("../middleware/auth");

const router = express.Router();
const uid = () => crypto.randomBytes(9).toString("hex");

function serialize(row) {
  return { ...row, items: JSON.parse(row.items) };
}

// Customer: place an order. Prices and stock are re-checked here — never trust
// totals or availability sent from the browser.
router.post("/", requireUser, (req, res) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Your bag is empty." });
  }

  let total = 0;
  const verifiedItems = [];

  const tx = db.transaction(() => {
    for (const item of items) {
      const product = db.prepare("SELECT * FROM products WHERE id = ?").get(item.productId);
      if (!product) throw new Error(`Item no longer available.`);
      if (product.stock < item.qty) throw new Error(`Not enough stock for ${product.name}.`);

      const unitPrice = product.special_active
        ? +(product.price * (1 - product.special_percent / 100)).toFixed(2)
        : product.price;

      total += unitPrice * item.qty;
      verifiedItems.push({
        productId: product.id,
        name: product.name,
        price: unitPrice,
        size: item.size,
        color: item.color,
        qty: item.qty,
      });

      db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").run(item.qty, product.id);
    }

    const order = {
      id: uid(),
      user_email: req.user.email,
      items: JSON.stringify(verifiedItems),
      total: +total.toFixed(2),
      status: "pending payment",
      created_at: Date.now(),
    };
    db.prepare(
      "INSERT INTO orders (id,user_email,items,total,status,created_at) VALUES (@id,@user_email,@items,@total,@status,@created_at)"
    ).run(order);
    return order;
  });

  try {
    const order = tx();
    res.status(201).json(serialize(order));
  } catch (e) {
    res.status(409).json({ error: e.message || "Could not place order." });
  }
});

// Customer: view their own order history only.
router.get("/mine", requireUser, (req, res) => {
  const rows = db.prepare("SELECT * FROM orders WHERE user_email = ? ORDER BY created_at DESC").all(req.user.email);
  res.json(rows.map(serialize));
});

// Admin (full): view and manage all orders.
router.get("/", requireAdmin("full"), (req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  res.json(rows.map(serialize));
});

router.patch("/:id/status", requireAdmin("full"), (req, res) => {
  const { status } = req.body || {};
  const allowed = ["pending payment", "confirmed", "shipped", "delivered"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status." });
  const result = db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Order not found." });
  res.json({ ok: true });
});

module.exports = router;
