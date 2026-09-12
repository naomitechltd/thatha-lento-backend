const express = require("express");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const db = require("../db");
const { requireUser } = require("../middleware/auth");

const router = express.Router();
const uid = () => crypto.randomBytes(9).toString("hex");

// Any signed-in admin (full or bugs-only) may view reports — checked manually
// here since both roles are allowed, unlike the strict role gate elsewhere.
function requireAnyAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const [, token] = header.split(" ");
  if (!token) return res.status(401).json({ error: "Admin sign-in required." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== "admin") throw new Error("wrong type");
    req.admin = payload;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Admin session expired." });
  }
}

router.post("/", requireUser, (req, res) => {
  const { message } = req.body || {};
  if (!message || !message.trim()) return res.status(400).json({ error: "Report can't be empty." });
  const row = { id: uid(), user_email: req.user.email, message: message.trim(), created_at: Date.now() };
  db.prepare("INSERT INTO bug_reports (id,user_email,message,created_at) VALUES (@id,@user_email,@message,@created_at)").run(row);
  res.status(201).json(row);
});

router.get("/", requireAnyAdmin, (req, res) => {
  const rows = db.prepare("SELECT * FROM bug_reports ORDER BY created_at DESC").all();
  res.json(rows);
});

module.exports = router;
