const express = require("express");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// GET /settings — public, all key/value settings (e.g. currency symbol)
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query("SELECT key, value FROM settings");
    const out = {};
    for (const row of rows) out[row.key] = row.value;
    res.json(out);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load settings." });
  }
});

// PATCH /settings/:key — full admin only
router.patch("/:key", requireAdmin("full"), async (req, res) => {
  try {
    const { value } = req.body || {};
    if (value == null || typeof value !== "string") {
      return res.status(400).json({ error: "A string value is required." });
    }

    await db.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [req.params.key, value]
    );

    res.json({ key: req.params.key, value });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update setting." });
  }
});

module.exports = router;
