require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db/index');
const authRoutes = require('./routes/auth');
const problemRoutes = require('./routes/problems');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/problems', problemRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 