const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");

const router = express.Router();
const uid = () => crypto.randomBytes(9).toString("hex");

function serialize(row) {
  return {
    id: row.id,
    userEmail: row.user_email,
    productId: row.product_id,
    gender: row.gender,
    createdAt: row.created_at,
  };
}

// POST /footprints — log that the logged-in user viewed a product
router.post("/", requireAuth, async (req, res) => {
  try {
    const { productId, gender } = req.body || {};
    if (!productId) {
      return res.status(400).json({ error: "productId is required." });
    }

    const row = {
      id: uid(),
      user_email: req.user.email,
      product_id: productId,
      gender: gender || null,
      created_at: Date.now(),
    };

    await db.query(
      "INSERT INTO footprints (id, user_email, product_id, gender, created_at) VALUES ($1,$2,$3,$4,$5)",
      [row.id, row.user_email, row.product_id, row.gender, row.created_at]
    );

    res.status(201).json(serialize(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record footprint." });
  }
});

// GET /footprints/mine — the logged-in user's recent footprints, newest first
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const { rows } = await db.query(
      "SELECT * FROM footprints WHERE user_email = $1 ORDER BY created_at DESC LIMIT $2",
      [req.user.email, limit]
    );
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load footprints." });
  }
});

// GET /footprints — all footprints (admin only), for analytics
router.get("/", requireAdmin("full"), async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 5000);
    const { rows } = await db.query(
      "SELECT * FROM footprints ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load footprints." });
  }
});

module.exports = router;
