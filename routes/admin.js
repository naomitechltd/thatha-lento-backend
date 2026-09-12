const express = require("express");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Slow down brute-force guessing of admin codes: 10 attempts per 15 minutes per IP.
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again later." },
});

router.post("/login", adminLoginLimiter, (req, res) => {
  const { email, code } = req.body || {};
  if (!email || !code) return res.status(400).json({ error: "Email and code are required." });

  let role = null;
  if (code === process.env.ADMIN_FULL_CODE) role = "full";
  else if (code === process.env.ADMIN_BUGS_ONLY_CODE) role = "bugs";

  if (!role) return res.status(401).json({ error: "That code isn't recognised." });

  const token = jwt.sign({ type: "admin", email, role }, process.env.JWT_SECRET, { expiresIn: "12h" });
  res.json({ token, admin: { email, role } });
});

// Example of a role-gated route: only "full" admins can see this.
router.get("/whoami", requireAdmin(), (req, res) => {
  res.json({ email: req.admin.email, role: req.admin.role });
});

module.exports = router;
