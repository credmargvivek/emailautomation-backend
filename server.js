const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authMiddleware = require('./middlewares/authMiddleware');
const emailRoutes = require('./routes/emailRoutes');
const authRoutes = require('./routes/authRoutes');
const dataRoutes = require('./routes/dataRoutes');
const csvRoutes = require('./routes/csvRoutes');
const startScraping = require('./utils/scrap');
const sendmailRoute = require('./routes/sendEmail')

dotenv.config();
const app = express();

// Middleware
app.use(cookieParser());
app.use(cors({ origin: process.env.FRONTEND_URL , credentials: true }));
app.use(express.json());

// Connect to MongoDB
connectDB();

// Routes
app.use('/', emailRoutes);
app.use('/', authRoutes);
app.use('/', dataRoutes);
app.use('/', csvRoutes);
app.use('/', sendmailRoute);



const PORT = process.env.PORT || 3007;
app.listen(PORT, () => {console.log(`🚀 Server running on port ${PORT}`);
});
