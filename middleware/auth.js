const { ObjectId } = require('mongodb');
const { collections } = require('../config/db');
const jwt = require('jsonwebtoken');

// MIDDLEWARE: Verify Session Token in MongoDB or JWT
async function verifySession(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (req.headers.cookie) {
      // Parse session or JWT token from cookies
      const cookies = req.headers.cookie.split(';').reduce((acc, c) => {
        const parts = c.trim().split('=');
        if (parts.length === 2) {
          acc[parts[0]] = parts[1];
        }
        return acc;
      }, {});
      token = cookies['token'] || cookies['better-auth.session-token'];
    }

    if (!token) {
      return res.status(401).json({ error: "Unauthorized: No session token provided" });
    }

    // Try verifying as JWT first
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret-key-123');
      
      let userIdQuery = decoded.id;
      if (typeof userIdQuery === "string") {
        try {
          userIdQuery = new ObjectId(userIdQuery);
        } catch (e) {
          // Fallback to string if not a valid ObjectId format
        }
      }

      const userDoc = await collections.users.findOne({ _id: userIdQuery });
      if (!userDoc) {
        return res.status(401).json({ error: "Unauthorized: User not found" });
      }

      if (userDoc.status === "suspended") {
        return res.status(403).json({ error: "Forbidden: Your account has been suspended" });
      }

      req.user = userDoc;
      return next();
    } catch (jwtErr) {
      // Fallback: search for Better Auth session token in DB
      const sessionDoc = await collections.session.findOne({
        $or: [
          { token: token },
          { sessionToken: token }
        ]
      });
      if (!sessionDoc || new Date(sessionDoc.expiresAt) < new Date()) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired session" });
      }

      let userIdQuery = sessionDoc.userId;
      if (typeof userIdQuery === "string") {
        try {
          userIdQuery = new ObjectId(userIdQuery);
        } catch (e) {
          // Fall back to string if not a valid ObjectId format
        }
      }

      const userDoc = await collections.users.findOne({ _id: userIdQuery });
      if (!userDoc) {
        return res.status(401).json({ error: "Unauthorized: User not found" });
      }

      if (userDoc.status === "suspended") {
        return res.status(403).json({ error: "Forbidden: Your account has been suspended" });
      }

      req.user = userDoc;
      return next();
    }
  } catch (err) {
    res.status(500).json({ error: "Error in authentication middleware: " + err.message });
  }
}

module.exports = {
  verifySession
};
