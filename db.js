const { Pool } = require("pg");
require("dotenv").config();

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Add it in Render Environment variables.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // needed for Supabase
});

// Helper so routes can do: const { rows } = await db.query(...)
const db = {
  query: (text, params) => pool.query(text, params),
};

// Create tables if they don't exist
async function init() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      colors TEXT NOT NULL DEFAULT '[]',
      sizes TEXT NOT NULL DEFAULT '[]',
      gender TEXT NOT NULL,
      special_active INTEGER NOT NULL DEFAULT 0,
      special_percent INTEGER NOT NULL DEFAULT 0,
      image_url TEXT NOT NULL DEFAULT '',
      color_images TEXT NOT NULL DEFAULT '{}',
      created_by TEXT,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending payment',
      recipient_name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT '',
      terms_accepted_at BIGINT,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bug_reports (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS footprints (
      id TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      product_id TEXT NOT NULL,
      gender TEXT,
      created_at BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // Seed default currency if missing
  const { rows } = await db.query(
    "SELECT value FROM settings WHERE key = 'currency_symbol'"
  );
  if (rows.length === 0) {
    await db.query(
      "INSERT INTO settings (key, value) VALUES ('currency_symbol', '$')"
    );
  }

  console.log("Database ready (Supabase/Postgres)");
}

init().catch((err) => {
  console.error("Failed to initialize database:", err);
  process.exit(1);
});

module.exports = db;
