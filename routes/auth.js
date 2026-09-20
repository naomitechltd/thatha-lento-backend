const express = require("express");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../db");
const { requireAuth, requireAdmin, signUserToken, signAdminToken } = require("../middleware/auth");

const router = express.Router();
const uid = () => crypto.randomBytes(9).toString("hex");

function isValidEmail(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone, location } = req.body || {};
    if (!name || !isValidEmail(email) || !password || password.length < 8) {
      return res.status(400).json({ error: "Name, valid email and password (min 8 chars) are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { rows: existing } = await db.query("SELECT id FROM users WHERE email = $1", [normalizedEmail]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const row = {
      id: uid(),
      name,
      email: normalizedEmail,
      password_hash: passwordHash,
      phone: phone || "",
      location: location || "",
      created_at: Date.now(),
    };

    await db.query(
      `INSERT INTO users (id, name, email, password_hash, phone, location, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [row.id, row.name, row.email, row.password_hash, row.phone, row.location, row.created_at]
    );

    const token = signUserToken(row);
    res.status(201).json({
      token,
      user: { id: row.id, name: row.name, email: row.email, phone: row.phone, location: row.location },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to register." });
  }
});

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [normalizedEmail]);
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = signUserToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, location: user.location },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to log in." });
  }
});

// GET /auth/me — current logged-in user
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT id, name, email, phone, location, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "User not found." });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load profile." });
  }
});

// PATCH /auth/me — update own profile (name/phone/location; not email/password here)
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const { name, phone, location } = req.body || {};
    const { rows } = await db.query("SELECT * FROM users WHERE id = $1", [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: "User not found." });

    const existing = rows[0];
    const next = {
      name: name ?? existing.name,
      phone: phone ?? existing.phone,
      location: location ?? existing.location,
    };

    await db.query(
      "UPDATE users SET name=$1, phone=$2, location=$3 WHERE id=$4",
      [next.name, next.phone, next.location, req.user.id]
    );

    res.json({ id: req.user.id, email: existing.email, ...next });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update profile." });
  }
});

// POST /auth/admin/login — separate login for the admin dashboard
router.post("/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isValidEmail(email) || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const { rows } = await db.query("SELECT * FROM admins WHERE email = $1", [normalizedEmail]);
    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const admin = rows[0];
    const ok = await bcrypt.compare(password, admin.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    const token = signAdminToken(admin);
    res.json({ token, admin: { email: admin.email, name: admin.name, role: admin.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to log in." });
  }
});

// GET /auth/admin/me
router.get("/admin/me", requireAdmin("limited"), (req, res) => {
  res.json(req.admin);
});

module.exports = router;
  
