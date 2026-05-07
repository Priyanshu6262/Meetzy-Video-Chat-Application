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

  const blockedList = user.blockedUsers || [];
  const contactSettings = user.contactSettings || new Map();

  const contacts = user.addedContacts
    .filter(c => !blockedList.includes(c.firebaseUid))
    .map(c => {
      const settings = contactSettings.get(c.firebaseUid) || {};
      return {
        uid: c.firebaseUid,
        name: settings.customName || c.name,
        originalName: c.name,
        email: c.email,
        photo: c.photo,
        isOnline: c.isOnline,
        nickname: settings.nickname,
        customLabel: settings.customLabel
      };
    });

  let chats = await Chat.find({ participants: mongoUserId })
    .populate('participants', 'firebaseUid name email photo isOnline')
    .populate('lastMessage')
    .sort({ updatedAt: -1 });

  chats = chats.map(chat => {
    const otherParticipant = chat.participants.find(p => p._id.toString() !== mongoUserId.toString());
    if (otherParticipant && blockedList.includes(otherParticipant.firebaseUid)) {
      return null;
    }
    
    const chatObj = chat.toObject();
    chatObj.participants = chatObj.participants.map(p => {
      if (p._id.toString() !== mongoUserId.toString()) {
        const settings = contactSettings.get(p.firebaseUid) || {};
        p.originalName = p.name;
        p.name = settings.customName || p.name;
        p.nickname = settings.nickname;
        p.customLabel = settings.customLabel;
      }
      return p;
    });

    if (otherParticipant) {
      const settings = contactSettings.get(otherParticipant.firebaseUid) || {};
      if (settings.clearedChatAt && chatObj.lastMessage && new Date(chatObj.lastMessage.createdAt) < new Date(settings.clearedChatAt)) {
         chatObj.lastMessage = null;
      }
    }

    return chatObj;
  }).filter(c => c !== null);

  return { contacts, chats };
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
  socket.on('chat:send', async ({ to, message, timestamp, replyTo }) => {
    const fromUid = socket.data.uid;
    const mongoId = socket.data.mongoId;
    if (!fromUid || !mongoId) return;

    try {
      const recipient = await User.findOne({ firebaseUid: to });
      if (!recipient) return;

      const sender = await User.findById(mongoId);
      
      // Block Check
      if (sender.blockedUsers && sender.blockedUsers.includes(to)) {
        return; // sender blocked recipient
      }
      if (recipient.blockedUsers && recipient.blockedUsers.includes(fromUid)) {
        return; // recipient blocked sender
      }

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

      let threadId = null;
      let replyToMsg = null;
      let populatedReplyTo = null;

      if (replyTo) {
        replyToMsg = await Message.findById(replyTo).populate('senderId', 'name');
        if (replyToMsg) {
          threadId = replyToMsg.threadId || replyToMsg._id;
          // Increment replyCount on root thread message
          await Message.findByIdAndUpdate(threadId, { $inc: { replyCount: 1 } });
          
          populatedReplyTo = {
            id: replyToMsg._id.toString(),
            text: replyToMsg.text,
            senderName: replyToMsg.senderId.name
          };
        }
      }

      // Create message
      const newMsg = new Message({
        chatId: chat._id,
        senderId: mongoId,
        text: message,
        replyTo: replyToMsg ? replyToMsg._id : null,
        threadId: threadId
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
        replyTo: populatedReplyTo,
        threadId: threadId ? threadId.toString() : null,
        replyCount: 0
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

      // Check for clearedChatAt
      const callerUser = await User.findById(mongoId);
      const settings = callerUser.contactSettings ? callerUser.contactSettings.get(withUid) : null;
      
      const query = { chatId: chat._id };
      if (settings && settings.clearedChatAt) {
        query.createdAt = { $gte: settings.clearedChatAt };
      }

      const messages = await Message.find(query)
        .sort({ createdAt: 1 })
        .limit(100)
        .populate({
          path: 'replyTo',
          populate: { path: 'senderId', select: 'name' }
        });
      
      const formattedHistory = messages.map(m => {
        let populatedReplyTo = null;
        if (m.replyTo) {
          populatedReplyTo = {
            id: m.replyTo._id.toString(),
            text: m.replyTo.text,
            senderName: m.replyTo.senderId ? m.replyTo.senderId.name : 'Unknown'
          };
        }

        return {
          id: m._id.toString(),
          from: m.senderId.toString() === mongoId.toString() ? fromUid : withUid,
          to: m.senderId.toString() === mongoId.toString() ? withUid : fromUid,
          message: m.text,
          timestamp: m.createdAt.getTime(),
          replyTo: populatedReplyTo,
          threadId: m.threadId ? m.threadId.toString() : null,
          replyCount: m.replyCount || 0
        };
      });

      socket.emit('chat:history', { with: withUid, messages: formattedHistory });
      
      // Send updated chat list to clear the unread badge
      const updatedChats = await getPopulatedChats(mongoId);
      socket.emit('chat:init', updatedChats);

    } catch (err) {
      console.error('Error fetching history:', err);
    }
  });

  // ── Chat: Get Thread History ──────────────────────────────
  socket.on('chat:thread:get', async ({ threadId, withUid }) => {
    const fromUid = socket.data.uid;
    const mongoId = socket.data.mongoId;
    if (!fromUid || !mongoId || !threadId) return;

    try {
      // Find the root message and all replies
      const rootMsg = await Message.findById(threadId).populate('senderId', 'firebaseUid name');
      if (!rootMsg) return;

      const replies = await Message.find({ threadId: threadId })
        .sort({ createdAt: 1 })
        .populate('senderId', 'firebaseUid name')
        .populate({
          path: 'replyTo',
          populate: { path: 'senderId', select: 'name' }
        });

      const allThreadMsgs = [rootMsg, ...replies].filter((v, i, a) => a.findIndex(t => (t._id.toString() === v._id.toString())) === i);

      const formattedThread = allThreadMsgs.map(m => {
        let populatedReplyTo = null;
        if (m.replyTo) {
          populatedReplyTo = {
            id: m.replyTo._id.toString(),
            text: m.replyTo.text,
            senderName: m.replyTo.senderId ? m.replyTo.senderId.name : 'Unknown'
          };
        }
        return {
          id: m._id.toString(),
          from: m.senderId.firebaseUid,
          to: m.senderId.firebaseUid === fromUid ? withUid : fromUid, // Assuming thread is 1-on-1 chat
          message: m.text,
          timestamp: m.createdAt.getTime(),
          replyTo: populatedReplyTo,
          threadId: m.threadId ? m.threadId.toString() : null,
          replyCount: m.replyCount || 0,
          senderName: m.senderId.name
        };
      });

      socket.emit('chat:thread:data', { threadId, messages: formattedThread });
    } catch (err) {
      console.error('Error fetching thread:', err);
    }
  });

  // ── Chat: Settings Update ─────────────────────────────────
  socket.on('chat:settings:update', async ({ targetUid, customName, nickname, customLabel }) => {
    const mongoId = socket.data.mongoId;
    if (!mongoId) return;
    try {
      const user = await User.findById(mongoId);
      if (!user) return;
      
      const currentSettings = user.contactSettings.get(targetUid) || {};
      user.contactSettings.set(targetUid, {
        ...currentSettings,
        customName: customName !== undefined ? customName : currentSettings.customName,
        nickname: nickname !== undefined ? nickname : currentSettings.nickname,
        customLabel: customLabel !== undefined ? customLabel : currentSettings.customLabel
      });
      await user.save();
      
      const updatedChats = await getPopulatedChats(mongoId);
      socket.emit('chat:init', updatedChats);
    } catch (err) {
      console.error('Error updating chat settings:', err);
    }
  });

  // ── Chat: Clear Chat ──────────────────────────────────────
  socket.on('chat:clear', async ({ targetUid }) => {
    const mongoId = socket.data.mongoId;
    if (!mongoId) return;
    try {
      const user = await User.findById(mongoId);
      if (!user) return;
      
      const currentSettings = user.contactSettings.get(targetUid) || {};
      user.contactSettings.set(targetUid, {
        ...currentSettings,
        clearedChatAt: new Date()
      });
      await user.save();
      
      const updatedChats = await getPopulatedChats(mongoId);
      socket.emit('chat:init', updatedChats);
      socket.emit('chat:history', { with: targetUid, messages: [] });
    } catch (err) {
      console.error('Error clearing chat:', err);
    }
  });

  // ── Chat: Block User ──────────────────────────────────────
  socket.on('chat:block', async ({ targetUid }) => {
    const mongoId = socket.data.mongoId;
    if (!mongoId) return;
    try {
      const user = await User.findById(mongoId);
      if (!user) return;
      
      if (!user.blockedUsers.includes(targetUid)) {
        user.blockedUsers.push(targetUid);
        await user.save();
      }
      
      const updatedChats = await getPopulatedChats(mongoId);
      socket.emit('chat:init', updatedChats);
    } catch (err) {
      console.error('Error blocking user:', err);
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
