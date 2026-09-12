const jwt = require("jsonwebtoken");

function getToken(req) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  return scheme === "Bearer" ? token : null;
}

function requireUser(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ error: "Log in to continue." });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== "user") throw new Error("wrong token type");
    req.user = { email: payload.email, name: payload.name };
    next();
  } catch (e) {
    return res.status(401).json({ error: "Your session has expired. Log in again." });
  }
}

function requireAdmin(role) {
  return (req, res, next) => {
    const token = getToken(req);
    if (!token) return res.status(401).json({ error: "Admin sign-in required." });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (payload.type !== "admin") throw new Error("wrong token type");
      if (role && payload.role !== role) {
        return res.status(403).json({ error: "You don't have access to this." });
      }
      req.admin = { email: payload.email, role: payload.role };
      next();
    } catch (e) {
      return res.status(401).json({ error: "Admin session expired. Sign in again." });
    }
  };
}

module.exports = { requireUser, requireAdmin };
