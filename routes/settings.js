const express = require("express");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

function getCurrencySymbol() {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'currency_symbol'").get();
  return row ? row.value : "$";
}

// Public: the storefront needs this to display prices correctly.
router.get("/", (req, res) => {
  res.json({ currencySymbol: getCurrencySymbol() });
});

// Admin (full) only: change the store's currency symbol (e.g. "$", "KES ", "₦", "£").
router.patch("/", requireAdmin("full"), (req, res) => {
  const { currencySymbol } = req.body || {};
  if (typeof currencySymbol !== "string" || !currencySymbol.trim() || currencySymbol.length > 6) {
    return res.status(400).json({ error: "Give a short currency symbol (up to 6 characters)." });
  }
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('currency_symbol', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(currencySymbol.trim());
  res.json({ currencySymbol: currencySymbol.trim() });
});

module.exports = router;
