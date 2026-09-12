const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { requireUser } = require("../middleware/auth");

const router = express.Router();
const uid = () => crypto.randomBytes(9).toString("hex");

router.post("/", requireUser, (req, res) => {
  const { productId, gender } = req.body || {};
  if (!productId) return res.status(400).json({ error: "productId is required." });
  db.prepare(
    "INSERT INTO footprints (id,user_email,product_id,gender,created_at) VALUES (?,?,?,?,?)"
  ).run(uid(), req.user.email, productId, gender || null, Date.now());
  res.status(201).json({ ok: true });
});

router.get("/mine", requireUser, (req, res) => {
  const rows = db
    .prepare("SELECT product_id as productId, gender, created_at as ts FROM footprints WHERE user_email = ? ORDER BY created_at DESC LIMIT 50")
    .all(req.user.email);
  res.json(rows);
});

module.exports = router;
