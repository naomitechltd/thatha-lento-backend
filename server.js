require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/auth");
const adminRoutes = require("./routes/admin");
const productRoutes = require("./routes/products");
const orderRoutes = require("./routes/orders");
const bugRoutes = require("./routes/bugs");
const footprintRoutes = require("./routes/footprints");
const settingsRoutes = require("./routes/settings");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes("replace-with")) {
  console.warn("WARNING: JWT_SECRET is not set to a real secret. Set it in .env before deploying.");
}

const app = express();
app.use(express.json());

// Only allow requests from your actual frontend origin(s) in production.
const allowedOrigins = (process.env.CORS_ORIGIN || "").split(",").map((s) => s.trim()).filter(Boolean);
app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    credentials: true,
  })
);

// Basic protection against being hammered; tune per route as needed.
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/admin", adminRoutes);
app.use("/products", productRoutes);
app.use("/orders", orderRoutes);
app.use("/bugs", bugRoutes);
app.use("/footprints", footprintRoutes);
app.use("/settings", settingsRoutes);

// Fallback error handler — never leak stack traces to clients.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Thatha Lento API listening on port ${PORT}`));
