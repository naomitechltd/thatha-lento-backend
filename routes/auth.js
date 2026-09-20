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
