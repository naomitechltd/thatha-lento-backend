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
    message: row.message,
    createdAt: row.created_at,
  };
}

// POST /bug-reports — logged-in user submits a bug report
router.post("/", requireAuth, async (req, res) => {
  try {
    const { message } = req.body || {};
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const row = {
      id: uid(),
      user_email: req.user.email,
      message: message.trim().slice(0, 5000),
      created_at: Date.now(),
    };

    await db.query(
      "INSERT INTO bug_reports (id, user_email, message, created_at) VALUES ($1,$2,$3,$4)",
      [row.id, row.user_email, row.message, row.created_at]
    );

    res.status(201).json(serialize(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit bug report." });
  }
});

// GET /bug-reports/mine — user's own submitted reports
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM bug_reports WHERE user_email = $1 ORDER BY created_at DESC",
      [req.user.email]
    );
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load bug reports." });
  }
});

// GET /bug-reports — all reports (admin only)
router.get("/", requireAdmin("bugs"), async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM bug_reports ORDER BY created_at DESC");
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load bug reports." });
  }
});

// DELETE /bug-reports/:id — full admin only
router.delete("/:id", requireAdmin("full"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM bug_reports WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Report not found." });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete bug report." });
  }
});

module.exports = router;
