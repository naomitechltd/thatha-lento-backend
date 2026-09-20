const jwt = require("jsonwebtoken");

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set. Add it in Render Environment variables.");
  process.exit(1);
}

const SECRET = process.env.JWT_SECRET;

// Role hierarchy: higher number = more access
const ADMIN_LEVELS = { limited: 1, full: 2 };

function signUserToken(user) {
  return jwt.sign(
    { type: "user", id: user.id, email: user.email, name: user.name },
    SECRET,
    { expiresIn: "30d" }
  );
}

function signAdminToken(admin) {
  return jwt.sign(
    { type: "admin", email: admin.email, name: admin.name, role: admin.role },
    SECRET,
    { expiresIn: "7d" }
  );
}

function getToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;
  return token;
}

// Requires a valid user (customer) token. Sets req.user = { id, email, name }
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated." });

  try {
    const payload = jwt.verify(token, SECRET);
    if (payload.type !== "user") {
      return res.status(401).json({ error: "Not authenticated." });
    }
    req.user = { id: payload.id, email: payload.email, name: payload.name };
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

// Requires a valid admin token with at least `minLevel` role ("limited" or "full").
// Sets req.admin = { email, name, role }
function requireAdmin(minLevel = "limited") {
  const required = ADMIN_LEVELS[minLevel] || ADMIN_LEVELS.limited;

  return (req, res, next) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Admin authentication required." });

    try {
      const payload = jwt.verify(token, SECRET);
      if (payload.type !== "admin") {
        return res.status(401).json({ error: "Admin authentication required." });
      }
      const level = ADMIN_LEVELS[payload.role] || 0;
      if (level < required) {
        return res.status(403).json({ error: "Insufficient admin permissions." });
      }
      req.admin = { email: payload.email, name: payload.name, role: payload.role };
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired admin token." });
    }
  };
}

module.exports = { requireAuth, requireAdmin, signUserToken, signAdminToken };
