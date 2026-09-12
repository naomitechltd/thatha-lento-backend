const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

function uid() {
  return crypto.randomBytes(9).toString("hex");
}

function issueUserToken(user) {
  return jwt.sign({ type: "user", email: user.email, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email and password are all required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = { id: uid(), name, email: email.toLowerCase(), password_hash: passwordHash, created_at: Date.now() };
  db.prepare("INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?,?,?,?,?)")
    .run(user.id, user.name, user.email, user.password_hash, user.created_at);

  const token = issueUserToken(user);
  res.status(201).json({ token, user: { name: user.name, email: user.email } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: "No matching account found." });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "No matching account found." });

  const token = issueUserToken(user);
  res.json({ token, user: { name: user.name, email: user.email } });
});

module.exports = router;
