const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
const uid = () => crypto.randomBytes(9).toString("hex");

function cleanImageUrl(value) {
  if (!value || typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return "";
  return trimmed;
}

function cleanColorImages(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out = {};
  for (const [color, url] of Object.entries(value)) {
    const cleaned = cleanImageUrl(url);
    if (color && cleaned) out[String(color).trim()] = cleaned;
  }
  return out;
}

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    stock: row.stock,
    colors: JSON.parse(row.colors || "[]"),
    sizes: JSON.parse(row.sizes || "[]"),
    gender: row.gender,
    special: { active: !!row.special_active, percent: row.special_percent },
    imageUrl: row.image_url || "",
    colorImages: row.color_images ? JSON.parse(row.color_images) : {},
    createdBy: row.created_by,
  };
}

// Public: anyone can browse the catalogue
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      "SELECT * FROM products ORDER BY created_at DESC"
    );
    res.json(rows.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

// Admin (full) only: post a new item
router.post("/", requireAdmin("full"), async (req, res) => {
  try {
    const { name, description, price, stock, colors, sizes, gender, imageUrl, colorImages } = req.body || {};
    if (!name || price == null || !gender) {
      return res.status(400).json({ error: "Name, price and gender are required." });
    }

    const row = {
      id: uid(),
      name,
      description: description || "",
      price: Number(price),
      stock: Number(stock) || 0,
      colors: JSON.stringify(Array.isArray(colors) ? colors : []),
      sizes: JSON.stringify(Array.isArray(sizes) ? sizes : []),
      gender,
      special_active: 0,
      special_percent: 0,
      image_url: cleanImageUrl(imageUrl),
      color_images: JSON.stringify(cleanColorImages(colorImages)),
      created_by: req.admin.email,
      created_at: Date.now(),
    };

    await db.query(
      `INSERT INTO products 
        (id, name, description, price, stock, colors, sizes, gender, special_active, special_percent, image_url, color_images, created_by, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        row.id, row.name, row.description, row.price, row.stock,
        row.colors, row.sizes, row.gender, row.special_active, row.special_percent,
        row.image_url, row.color_images, row.created_by, row.created_at
      ]
    );

    res.status(201).json(serialize(row));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// Admin (full) only: update product
router.patch("/:id", requireAdmin("full"), async (req, res) => {
  try {
    const { rows } = await db.query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: "Item not found." });

    const existing = rows[0];
    const patch = req.body || {};

    const next = {
      name: patch.name ?? existing.name,
      description: patch.description ?? existing.description,
      price: patch.price != null ? Number(patch.price) : existing.price,
      stock: patch.stock != null ? Number(patch.stock) : existing.stock,
      colors: patch.colors ? JSON.stringify(patch.colors) : existing.colors,
      sizes: patch.sizes ? JSON.stringify(patch.sizes) : existing.sizes,
      gender: patch.gender ?? existing.gender,
      special_active: patch.special ? (patch.special.active ? 1 : 0) : existing.special_active,
      special_percent: patch.special ? Number(patch.special.percent) || 0 : existing.special_percent,
      image_url: patch.imageUrl !== undefined ? cleanImageUrl(patch.imageUrl) : existing.image_url,
      color_images: patch.colorImages !== undefined ? JSON.stringify(cleanColorImages(patch.colorImages)) : existing.color_images,
    };

    await db.query(
      `UPDATE products SET 
        name=$1, description=$2, price=$3, stock=$4, colors=$5, sizes=$6, gender=$7,
        special_active=$8, special_percent=$9, image_url=$10, color_images=$11
       WHERE id=$12`,
      [
        next.name, next.description, next.price, next.stock, next.colors, next.sizes, next.gender,
        next.special_active, next.special_percent, next.image_url, next.color_images, req.params.id
      ]
    );

    res.json(serialize({ ...existing, ...next, id: req.params.id }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update product" });
  }
});

// Admin (full) only: delete product
router.delete("/:id", requireAdmin("full"), async (req, res) => {
  try {
    const result = await db.query("DELETE FROM products WHERE id = $1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Item not found." });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

module.exports = router;
