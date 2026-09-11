const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();
const uid = () => crypto.randomBytes(9).toString("hex");

function serialize(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    stock: row.stock,
    colors: JSON.parse(row.colors),
    sizes: JSON.parse(row.sizes),
    gender: row.gender,
    special: { active: !!row.special_active, percent: row.special_percent },
    createdBy: row.created_by,
  };
}

// Public: anyone can browse the catalogue.
router.get("/", (req, res) => {
  const rows = db.prepare("SELECT * FROM products ORDER BY created_at DESC").all();
  res.json(rows.map(serialize));
});

// Admin (full) only: post a new item.
router.post("/", requireAdmin("full"), (req, res) => {
  const { name, description, price, stock, colors, sizes, gender } = req.body || {};
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
    created_by: req.admin.email,
    created_at: Date.now(),
  };
  db.prepare(
    `INSERT INTO products (id,name,description,price,stock,colors,sizes,gender,special_active,special_percent,created_by,created_at)
     VALUES (@id,@name,@description,@price,@stock,@colors,@sizes,@gender,@special_active,@special_percent,@created_by,@created_at)`
  ).run(row);
  res.status(201).json(serialize(row));
});

// Admin (full) only: update price, stock, sizes, colors, gender, or special/discount.
router.patch("/:id", requireAdmin("full"), (req, res) => {
  const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Item not found." });

  const patch = req.body || {};
  const next = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    price: patch.price != null ? Number(patch.price) : existing.price,
    stock: patch.stock != null ? Number(patch.stock) : existing.stock,
    colors: patch.colors ? JSON.stringify(patch.colors) : existing.colors,
    sizes: patch.sizes ? JSON.stringify(patch.sizes) : existing.sizes,
    gender: patch.gender ?? existing.gender,
    special_active: patch.special ? (patch.special.active ? 1 : 0) : existing.special_active,
    special_percent: patch.special ? Number(patch.special.percent) || 0 : existing.special_percent,
  };
  db.prepare(
    `UPDATE products SET name=@name, description=@description, price=@price, stock=@stock,
     colors=@colors, sizes=@sizes, gender=@gender, special_active=@special_active, special_percent=@special_percent
     WHERE id=@id`
  ).run(next);
  res.json(serialize(next));
});

// Admin (full) only: delete an item.
router.delete("/:id", requireAdmin("full"), (req, res) => {
  const result = db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Item not found." });
  res.status(204).end();
});

module.exports = router;
