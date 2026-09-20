const jwt = require("jsonwebtoken");

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set. Add it in Render Environment variables.");
  process.exit(1);
}

const SECRET = process.env.JWT_SECRET;

function signUserToken(user) {
  return jwt.sign(
    { type: "user", id: user.id, email: user.email, name: user.name },
    SECRET,
    { expiresIn: "30d" }
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

// Requires a valid admin token. `role` is the minimum role needed ("full" or "bugs");
// admins with role "full" can access every admin route.
function requireAdmin(role = "full") {
  return (req, res, next) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Admin authentication required." });

    try {
      const payload = jwt.verify(token, SECRET);
      if (payload.type !== "admin") {
        return res.status(401).json({ error: "Admin authentication required." });
      }
      if (payload.role !== role && payload.role !== "full") {
        return res.status(403).json({ error: "Insufficient admin permissions." });
      }
      req.admin = { email: payload.email, role: payload.role };
      next();
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired admin token." });
    }
  };
}

module.exports = { requireAuth, requireAdmin, signUserToken };
