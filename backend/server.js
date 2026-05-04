const express = require('express');
const cors = require('cors');
const { admin } = require('./firebase');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // For development, allow all. In production, specify your frontend URL
    methods: ['GET', 'POST'],
  },
});

// Authentication Endpoint
app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'ID token is required' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    console.log(`✅ User authenticated: ${email} (UID: ${uid})`);

    res.status(200).json({
      message: 'Authentication successful',
      user: { uid, email, name, picture }
    });
  } catch (error) {
    console.error('❌ Error verifying ID token:', error);
    res.status(401).json({ error: 'Invalid or expired ID token' });
  }
});

// WebRTC Signaling Events
io.on('connection', (socket) => {
  console.log('🔗 User connected:', socket.id);

  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    console.log(`👤 User ${userId} (${socket.id}) joined room ${roomId}`);

    // Notify others in the room
    socket.to(roomId).emit('user-connected', userId, socket.id);

    // Relay Offer
    socket.on('offer', (payload) => {
      io.to(payload.target).emit('offer', payload);
    });

    // Relay Answer
    socket.on('answer', (payload) => {
      io.to(payload.target).emit('answer', payload);
    });

    // Relay ICE Candidate
    socket.on('ice-candidate', (incoming) => {
      io.to(incoming.target).emit('ice-candidate', incoming);
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`🔴 User ${userId} (${socket.id}) disconnected from room ${roomId}`);
      socket.to(roomId).emit('user-disconnected', userId, socket.id);
    });
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
