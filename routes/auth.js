const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const bigquery = require('../db/index');

router.post('/register', async (req, res) => {
    try {
        const { email, password, username } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const query = `
            INSERT INTO math_solver.users (email, password_hash, username)
            VALUES (@email, @password_hash, @username)
        `;
        
        const options = {
            query: query,
            params: {
                email: email,
                password_hash: hashedPassword,
                username: username
            }
        };

        const [result] = await bigquery.query(options);
        const [user] = await bigquery.query({
            query: `SELECT * FROM math_solver.users WHERE email = @email LIMIT 1`,
            params: { email: email }
        });
        
        const token = jwt.sign(
            { userId: user.id }, 
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ 
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const [rows] = await bigquery.query({
            query: `
                SELECT id, email, username, password_hash 
                FROM math_solver.users 
                WHERE email = @email 
                LIMIT 1
            `,
            params: { email: email }
        });

        if (!rows || rows.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const user = rows[0];

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                username: user.username
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 