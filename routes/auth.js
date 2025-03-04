const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bigquery = require('../db/index');

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const query = `
            SELECT id, email, username, password_hash 
            FROM math_solver.users 
            WHERE email = @email 
            LIMIT 1
        `;

        const options = {
            query,
            params: { email }
        };

        const [rows] = await bigquery.query(options);

        if (!rows || rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Xóa session cũ
        await bigquery.query({
            query: `DELETE FROM math_solver.sessions WHERE user_id = @userId`,
            params: { userId: user.id }
        });

        // Tạo token mới
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Lưu session mới
        await bigquery.query({
            query: `INSERT INTO math_solver.sessions (user_id, token) VALUES (@userId, @token)`,
            params: { userId: user.id, token }
        });

        res.json({ token, user: { id: user.id, email: user.email, username: user.username } });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Đảm bảo export đúng
module.exports = router;
