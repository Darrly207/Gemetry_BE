const jwt = require('jsonwebtoken');
const bigquery = require('../db/index');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.userId };

    // Kiểm tra token có hợp lệ không
    const [rows] = await bigquery.query({
      query: `SELECT id FROM math_solver.sessions WHERE user_id = @userId AND token = @token`,
      params: { userId: req.user.id, token }
    });

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

module.exports = authMiddleware;