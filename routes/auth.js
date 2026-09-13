const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const db = require("../db");
const { requireUser } = require("../middleware/auth");

const router = express.Router();

function uid() {
  return crypto.randomBytes(9).toString("hex");
}

function issueUserToken(user) {
  return jwt.sign({ type: "user", email: user.email, name: user.name }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

function publicUser(user) {
  return { name: user.name, email: user.email, phone: user.phone || "", location: user.location || "" };
}

router.post("/signup", async (req, res) => {
  const { name, email, password, phone, location } = req.body || {};
  if (!name || !email || !password || !phone || !location) {
    return res.status(400).json({ error: "Name, email, password, phone number and location are all required." });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters." });
  }
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists." });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  const user = {
    id: uid(),
    name,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    phone: String(phone).trim(),
    location: String(location).trim(),
    created_at: Date.now(),
  };
  db.prepare(
    "INSERT INTO users (id, name, email, password_hash, phone, location, created_at) VALUES (@id,@name,@email,@password_hash,@phone,@location,@created_at)"
  ).run(user);

  const token = issueUserToken(user);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: "No matching account found." });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "No matching account found." });

  const token = issueUserToken(user);
  res.json({ token, user: publicUser(user) });
});

// Customer: update their own delivery details (phone / location) — used when
// they've moved, or want to confirm/change where orders should go.
router.patch("/profile", requireUser, (req, res) => {
  const { phone, location } = req.body || {};
  if (!phone || !location) {
    return res.status(400).json({ error: "Phone number and location are required." });
  }
  db.prepare("UPDATE users SET phone = ?, location = ? WHERE email = ?").run(
    String(phone).trim(),
    String(location).trim(),
    req.user.email
  );
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(req.user.email);
  res.json({ user: publicUser(user) });
});

module.exports = router;
