require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');

// Import Socket Handler
const socketHandler = require('./socket/socketHandler');

// Connect to MongoDB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

// Create Server and Setup Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For development, allow all. In production, specify your frontend URL
    methods: ['GET', 'POST'],
  },
});

// Initialize Socket Events
socketHandler(io);

// Start Server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
