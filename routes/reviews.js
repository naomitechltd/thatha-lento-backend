const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
const uid = () => crypto.randomBytes(9).toString("hex");

function serialize(row) {
  return {
    id: row.id,
    productId: row.product_id,
    userName: row.user_name,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  };
}

// GET /reviews/summary — average rating + count for every product, for showing badges on product cards.
router.get("/summary", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT product_id, AVG(rating)::float AS average, COUNT(*)::int AS count FROM reviews GROUP BY product_id"
    );
    const out = {};
    for (const row of rows) {
      out[row.product_id] = { average: Math.round(row.average * 10) / 10, count: row.count };
    }
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load review summary." });
  }
});

// GET /reviews/:productId — all reviews for one product, newest first.
router.get("/:productId", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM reviews WHERE product_id = $1 ORDER BY created_at DESC",
      [req.params.productId]
    );
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load reviews." });
  }
});

// POST /reviews — leave or update a review. Only allowed for products the user has actually ordered.
router.post("/", requireAuth, async (req, res) => {
  try {
    const { productId, rating, comment } = req.body || {};
    const ratingNum = Number(rating);
    if (!productId || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "productId and a rating from 1 to 5 are required." });
    }

    const { rows: orderRows } = await db.query(
      "SELECT items FROM orders WHERE user_email = $1 AND status != 'cancelled'",
      [req.user.email]
    );
    const purchased = orderRows.some((o) => {
      const items = JSON.parse(o.items || "[]");
      return items.some((it) => it.productId === productId);
    });
    if (!purchased) {
      return res.status(403).json({ error: "You can only review items you've purchased." });
    }

    const row = {
      id: uid(),
      product_id: productId,
      user_email: req.user.email,
      user_name: req.user.name || "",
      rating: ratingNum,
      comment: (comment || "").trim().slice(0, 2000),
      created_at: Date.now(),
    };

    await db.query(
      `INSERT INTO reviews (id, product_id, user_email, user_name, rating, comment, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (product_id, user_email)
       DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, user_name = EXCLUDED.user_name, created_at = EXCLUDED.created_at`,
      [row.id, row.product_id, row.user_email, row.user_name, row.rating, row.comment, row.created_at]
    );

    res.status(201).json(serialize(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save review." });
  }
});

// DELETE /reviews/:id — admin only, for removing inappropriate reviews.
router.delete("/:id", requireAdmin("full"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM reviews WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Review not found." });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete review." });
  }
});

module.exports = router;
