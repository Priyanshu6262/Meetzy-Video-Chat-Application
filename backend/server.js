const express = require('express');
const cors = require('cors');
const { admin } = require('./firebase');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

// Import Models
const User = require('./models/User');
const Chat = require('./models/Chat');
const Message = require('./models/Message');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/meetzy')
  .then(() => console.log('📦 Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

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

    // Upsert User in MongoDB
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      user = new User({
        firebaseUid: uid,
        email,
        name: name || email.split('@')[0],
        photo: picture || '',
        isOnline: true
      });
      await user.save();
    } else {
      // Update profile in case it changed
      user.name = name || user.name;
      user.photo = picture || user.photo;
      user.isOnline = true;
      await user.save();
    }

    console.log(`✅ User authenticated & saved: ${email} (UID: ${uid})`);

    res.status(200).json({
      message: 'Authentication successful',
      user: { 
        uid: user.firebaseUid, 
        mongoId: user._id,
        email: user.email, 
        name: user.name, 
        photo: user.photo 
      }
    });
  } catch (error) {
    console.error('❌ Error verifying ID token:', error);
    res.status(401).json({ error: 'Invalid or expired ID token' });
  }
});

// Check if user exists by email (and add to contacts if requested via socket instead)
// For now, this just verifies existence. The actual contact adding will happen here.
app.post('/api/users/check', async (req, res) => {
  const { email, callerUid } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Check MongoDB instead of Firebase Auth directly (since we sync them)
    const targetUser = await User.findOne({ email });
    
    if (!targetUser) {
      return res.status(200).json({ exists: false });
    }

    // If callerUid is provided, automatically add them to each other's contacts
    if (callerUid) {
      const callerUser = await User.findOne({ firebaseUid: callerUid });
      if (callerUser && callerUser._id.toString() !== targetUser._id.toString()) {
        // Add to contacts if not already there
        if (!callerUser.addedContacts.includes(targetUser._id)) {
          callerUser.addedContacts.push(targetUser._id);
          await callerUser.save();
        }
        if (!targetUser.addedContacts.includes(callerUser._id)) {
          targetUser.addedContacts.push(callerUser._id);
          await targetUser.save();
        }

        // Create Chat document if it doesn't exist
        const existingChat = await Chat.findOne({
          participants: { $all: [callerUser._id, targetUser._id] }
        });

        if (!existingChat) {
          const newChat = new Chat({
            participants: [callerUser._id, targetUser._id],
            unreadCounts: {
              [callerUser.firebaseUid]: 0,
              [targetUser.firebaseUid]: 0
            }
          });
          await newChat.save();
        }
      }
    }

    res.status(200).json({
      exists: true,
      user: {
        uid: targetUser.firebaseUid,
        email: targetUser.email,
        name: targetUser.name,
        photo: targetUser.photo,
        isOnline: targetUser.isOnline
      }
    });
  } catch (error) {
    console.error('❌ Error checking user by email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────
// Socket.io Memory Maps (for online status tracking ONLY)
// onlineSockets: Map<firebaseUid, socketId>
// ─────────────────────────────────────────────────────────────
const onlineSockets = new Map();

// Helper to get all populated chat info for a user
const getPopulatedChats = async (mongoUserId) => {
  const user = await User.findById(mongoUserId).populate('addedContacts');
  if (!user) return { contacts: [], chats: [] };

  const chats = await Chat.find({ participants: mongoUserId })
    .populate('participants', 'firebaseUid name email photo isOnline')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

  return {
    contacts: user.addedContacts.map(c => ({
      uid: c.firebaseUid,
      name: c.name,
      email: c.email,
      photo: c.photo,
      isOnline: c.isOnline
    })),
    chats
  };
};

// ─────────────────────────────────────────────────────────────
// Socket.io connection handler
// ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('🔗 Socket connected:', socket.id);

  // ── WebRTC Signaling ──────────────────────────────────────
  socket.on('join-room', (roomId, userId) => {
    socket.join(roomId);
    console.log(`👤 User ${userId} (${socket.id}) joined room ${roomId}`);

    socket.to(roomId).emit('user-connected', userId, socket.id);

    socket.on('offer', (payload) => {
      io.to(payload.target).emit('offer', payload);
    });

    socket.on('answer', (payload) => {
      io.to(payload.target).emit('answer', payload);
    });

    socket.on('ice-candidate', (incoming) => {
      io.to(incoming.target).emit('ice-candidate', incoming);
    });
  });

  // ── Chat: Register User ───────────────────────────────────
  socket.on('chat:register', async ({ uid, name, photo, email }) => {
    // Remove old sockets for this uid to prevent ghosts
    for (const [sUid, sid] of onlineSockets.entries()) {
      if (sUid === uid && sid !== socket.id) {
        onlineSockets.delete(sUid);
      }
    }
    
    onlineSockets.set(uid, socket.id);
    socket.data.uid = uid;

    try {
      let user = await User.findOne({ firebaseUid: uid });
      if (user) {
        user.isOnline = true;
        await user.save();
        socket.data.mongoId = user._id;

        // Fetch their contacts and chats
        const data = await getPopulatedChats(user._id);
        socket.emit('chat:init', data);

        // Broadcast to others that this user is online
        io.emit('chat:user:status', { uid, isOnline: true });
        console.log(`💬 Chat user registered: ${name} (${uid})`);
      }
    } catch (err) {
      console.error('Error in chat:register:', err);
    }
  });

  // ── Chat: Send Message ────────────────────────────────────
  socket.on('chat:send', async ({ to, message, timestamp }) => {
    const fromUid = socket.data.uid;
    const mongoId = socket.data.mongoId;
    if (!fromUid || !mongoId) return;

    try {
      const recipient = await User.findOne({ firebaseUid: to });
      if (!recipient) return;

      // Find or create chat
      let chat = await Chat.findOne({
        participants: { $all: [mongoId, recipient._id] }
      });

      if (!chat) {
        chat = new Chat({
          participants: [mongoId, recipient._id],
          unreadCounts: {
            [fromUid]: 0,
            [to]: 0
          }
        });
      }

      // Create message
      const newMsg = new Message({
        chatId: chat._id,
        senderId: mongoId,
        text: message
      });
      await newMsg.save();

      // Update chat last message and recipient unread count
      chat.lastMessage = newMsg._id;
      chat.unreadCounts.set(to, (chat.unreadCounts.get(to) || 0) + 1);
      await chat.save();

      const msgObj = {
        id: newMsg._id.toString(),
        from: fromUid,
        to,
        message: newMsg.text,
        timestamp: newMsg.createdAt.getTime(),
      };

      // Relay to recipient if online
      const recipientSocketId = onlineSockets.get(to);
      if (recipientSocketId) {
        io.to(recipientSocketId).emit('chat:receive', msgObj);
        
        // Also send them updated chat info so their sidebar updates
        const recipientChats = await getPopulatedChats(recipient._id);
        io.to(recipientSocketId).emit('chat:init', recipientChats);
      }

      // Echo back to sender
      socket.emit('chat:receive', msgObj);
      const senderChats = await getPopulatedChats(mongoId);
      socket.emit('chat:init', senderChats);

    } catch (err) {
      console.error('Error sending message:', err);
    }
  });

  // ── Chat: Typing Indicator ────────────────────────────────
  socket.on('chat:typing', ({ to, isTyping }) => {
    const fromUid = socket.data.uid;
    if (!fromUid) return;

    const recipientSocketId = onlineSockets.get(to);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit('chat:typing', { from: fromUid, isTyping });
    }
  });

  // ── Chat: Get Message History ─────────────────────────────
  socket.on('chat:history:get', async ({ with: withUid }) => {
    const fromUid = socket.data.uid;
    const mongoId = socket.data.mongoId;
    if (!fromUid || !mongoId) return;

    try {
      const recipient = await User.findOne({ firebaseUid: withUid });
      if (!recipient) return;

      const chat = await Chat.findOne({
        participants: { $all: [mongoId, recipient._id] }
      });

      if (!chat) {
        socket.emit('chat:history', { with: withUid, messages: [] });
        return;
      }

      // Clear unread count for the caller
      chat.unreadCounts.set(fromUid, 0);
      await chat.save();

      const messages = await Message.find({ chatId: chat._id }).sort({ createdAt: 1 }).limit(100);
      
      const formattedHistory = messages.map(m => ({
        id: m._id.toString(),
        from: m.senderId.toString() === mongoId.toString() ? fromUid : withUid,
        to: m.senderId.toString() === mongoId.toString() ? withUid : fromUid,
        message: m.text,
        timestamp: m.createdAt.getTime()
      }));

      socket.emit('chat:history', { with: withUid, messages: formattedHistory });
      
      // Send updated chat list to clear the unread badge
      const updatedChats = await getPopulatedChats(mongoId);
      socket.emit('chat:init', updatedChats);

    } catch (err) {
      console.error('Error fetching history:', err);
    }
  });

  // ── Disconnect ────────────────────────────────────────────
  socket.on('disconnect', async () => {
    const uid = socket.data.uid;
    if (uid) {
      onlineSockets.delete(uid);
      try {
        const user = await User.findOne({ firebaseUid: uid });
        if (user) {
          user.isOnline = false;
          user.lastSeen = new Date();
          await user.save();
          io.emit('chat:user:status', { uid, isOnline: false });
          console.log(`🔴 Chat user disconnected: ${user.name} (${uid})`);
        }
      } catch (err) {
        console.error('Error handling disconnect:', err);
      }
    }

    // Also notify WebRTC rooms
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit('user-disconnected', socket.data.uid, socket.id);
      }
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
