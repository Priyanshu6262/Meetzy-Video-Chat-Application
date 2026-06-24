const User = require('../models/User');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const Call = require('../models/Call');
const geminiService = require('../services/geminiService');
const AutoReplyLog = require('../models/AutoReplyLog');

const onlineSockets = new Map();
const suggestionCache = new Map(); // key: chatId, value: { lastMessageId, suggestions }

const setSuggestionCache = (chatId, lastMessageId, suggestions) => {
  if (suggestionCache.size > 1000) {
    const firstKey = suggestionCache.keys().next().value;
    suggestionCache.delete(firstKey);
  }
  suggestionCache.set(chatId.toString(), {
    lastMessageId: lastMessageId.toString(),
    suggestions
  });
};

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

const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log('🔗 Socket connected:', socket.id);

    // ── WebRTC Signaling (Room-based Video Calls) ────────────────
    socket.on('join-room', (roomId, userId) => {
      socket.join(roomId);
      socket.to(roomId).emit('user-connected', userId, socket.id);
    });

    socket.on('offer', (payload) => {
      io.to(payload.target).emit('offer', payload);
    });

    socket.on('answer', (payload) => {
      io.to(payload.target).emit('answer', payload);
    });

    socket.on('ice-candidate', (payload) => {
      io.to(payload.target).emit('ice-candidate', payload);
    });

    // ── WebRTC Signaling (Direct Video Calls) ───────────────────────
    socket.on('call:initiate', async ({ receiverUid }) => {
      const callerUid = socket.data.uid;
      const callerMongoId = socket.data.mongoId;
      if (!callerUid || !callerMongoId) return;

      try {
        const receiverSocketId = onlineSockets.get(receiverUid);
        if (receiverSocketId) {
          const caller = await User.findById(callerMongoId);
          // Alert receiver
          io.to(receiverSocketId).emit('call:incoming', {
            callerUid,
            callerName: caller.name,
            callerPhoto: caller.photo
          });
        } else {
          // Receiver offline
          socket.emit('call:rejected', { reason: 'User is offline' });
        }
      } catch (err) {
        console.error('Error initiating call:', err);
      }
    });

    socket.on('call:accept', async ({ callerUid }) => {
      const receiverUid = socket.data.uid;
      const callerSocketId = onlineSockets.get(callerUid);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call:accepted', { receiverUid });
      }
    });

    socket.on('call:reject', async ({ callerUid }) => {
      const receiverUid = socket.data.uid;
      const callerSocketId = onlineSockets.get(callerUid);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call:rejected', { reason: 'Busy' });
      }
    });

    socket.on('call:end', async ({ targetUid }) => {
      const targetSocketId = onlineSockets.get(targetUid);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:ended');
      }
    });

    socket.on('call:signal', ({ targetUid, signalData }) => {
      const targetSocketId = onlineSockets.get(targetUid);
      if (targetSocketId) {
        io.to(targetSocketId).emit('call:signal', {
          senderUid: socket.data.uid,
          signalData
        });
      }
    });

    socket.on('call:timeout', async ({ targetUid }) => {
      const callerUid = socket.data.uid;
      const callerMongoId = socket.data.mongoId;
      
      // Create system message for missed call
      try {
        const receiver = await User.findOne({ firebaseUid: targetUid });
        if (!receiver) return;

        let chat = await Chat.findOne({
          participants: { $all: [callerMongoId, receiver._id] }
        });

        if (chat) {
          // create call log
          const newCall = new Call({
            callerId: callerMongoId,
            receiverId: receiver._id,
            chatId: chat._id,
            status: 'missed'
          });
          await newCall.save();

          const newMsg = new Message({
            chatId: chat._id,
            senderId: callerMongoId,
            text: "You missed a video call",
            type: "system_call"
          });
          await newMsg.save();

          chat.lastMessage = newMsg._id;
          chat.unreadCounts.set(targetUid, (chat.unreadCounts.get(targetUid) || 0) + 1);
          await chat.save();

          const msgObj = {
            id: newMsg._id.toString(),
            from: callerUid,
            to: targetUid,
            message: newMsg.text,
            type: newMsg.type,
            timestamp: newMsg.createdAt.getTime(),
            replyTo: null,
            threadId: null,
            replyCount: 0
          };

          const targetSocketId = onlineSockets.get(targetUid);
          if (targetSocketId) {
            io.to(targetSocketId).emit('chat:receive', msgObj);
            io.to(targetSocketId).emit('call:missed', { callerUid });
            const recipientChats = await getPopulatedChats(receiver._id);
            io.to(targetSocketId).emit('chat:init', recipientChats);
          }

          socket.emit('chat:receive', msgObj);
          const senderChats = await getPopulatedChats(callerMongoId);
          socket.emit('chat:init', senderChats);
        }
      } catch (err) {
        console.error('Error handling missed call:', err);
      }
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
            const updatedRoot = await Message.findByIdAndUpdate(threadId, { $inc: { replyCount: 1 } }, { new: true });
            
            if (updatedRoot) {
              // Broadcast the update to both users so they see the counter increase live
              const updatePayload = { threadId: threadId.toString(), replyCount: updatedRoot.replyCount };
              const recipientSocketId = onlineSockets.get(to);
              if (recipientSocketId) {
                io.to(recipientSocketId).emit('chat:message:update', updatePayload);
              }
              socket.emit('chat:message:update', updatePayload);
            }
            
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
          type: newMsg.type,
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

        // ── Auto Reply Automation Trigger ──────────────────────────
        // Only trigger if recipient exists and has auto-reply enabled, and this incoming message is NOT already an auto-reply
        if (recipient.autoReplyEnabled && !newMsg.isAutoReply) {
          console.log(`🤖 Auto-reply triggered for recipient user: ${recipient.name} (${to})`);

          (async () => {
            try {
              // 1. Fetch recent chat history
              const dbMessages = await Message.find({ chatId: chat._id })
                .sort({ createdAt: -1 })
                .limit(15)
                .populate('senderId', 'name');

              dbMessages.reverse();

              const messagesForAI = dbMessages.map(m => ({
                senderName: m.senderId ? m.senderId.name : 'Unknown',
                text: m.text
              }));

              // 2. Call Gemini Auto Reply
              const result = await geminiService.generateAutoReply(
                messagesForAI,
                recipient.autoReplyStyle || 'friendly',
                recipient.autoReplyLanguage || 'auto'
              );

              if (result && result.shouldReply && result.replyText) {
                // 3. Timing Delay (2.5 seconds to feel human-like)
                await new Promise(resolve => setTimeout(resolve, 2500));

                // 4. Save auto reply to DB
                const autoMsg = new Message({
                  chatId: chat._id,
                  senderId: recipient._id, // sent by Bob
                  text: result.replyText,
                  isAutoReply: true
                });
                await autoMsg.save();

                // 5. Update Chat last message and recipient unread count
                chat.lastMessage = autoMsg._id;
                chat.unreadCounts.set(fromUid, (chat.unreadCounts.get(fromUid) || 0) + 1); // Alice gets 1 unread
                await chat.save();

                const autoMsgObj = {
                  id: autoMsg._id.toString(),
                  from: to, // Bob's firebaseUid
                  to: fromUid, // Alice's firebaseUid
                  message: autoMsg.text,
                  type: autoMsg.type,
                  timestamp: autoMsg.createdAt.getTime(),
                  replyTo: null,
                  threadId: null,
                  replyCount: 0
                };

                // 6. Emit to sockets
                // Send to Alice (sender of the original message)
                const senderSocketId = onlineSockets.get(fromUid);
                if (senderSocketId) {
                  io.to(senderSocketId).emit('chat:receive', autoMsgObj);
                  const senderChats = await getPopulatedChats(mongoId);
                  io.to(senderSocketId).emit('chat:init', senderChats);
                }

                // Send to Bob (recipient of the original message who is auto-replying)
                const recipientSocketId = onlineSockets.get(to);
                if (recipientSocketId) {
                  io.to(recipientSocketId).emit('chat:receive', autoMsgObj);
                  const recipientChats = await getPopulatedChats(recipient._id);
                  io.to(recipientSocketId).emit('chat:init', recipientChats);
                }

                // 7. Save sent log
                await new AutoReplyLog({
                  userId: recipient._id,
                  chatId: chat._id,
                  incomingMessage: message,
                  outgoingReply: result.replyText,
                  status: 'sent',
                  reason: 'Auto-reply generated and sent successfully'
                }).save();
                console.log(`🤖 Auto-reply successfully sent from ${recipient.name} to ${sender.name}`);

              } else {
                // Save skipped log
                await new AutoReplyLog({
                  userId: recipient._id,
                  chatId: chat._id,
                  incomingMessage: message,
                  status: 'skipped',
                  reason: result ? 'AI decided to skip reply' : 'No reply text returned'
                }).save();
                console.log(`🤖 Auto-reply skipped for recipient: ${recipient.name}`);
              }
            } catch (err) {
              console.error('❌ Error executing auto-reply:', err);
              // Save error log
              await new AutoReplyLog({
                userId: recipient._id,
                chatId: chat._id,
                incomingMessage: message,
                status: 'error',
                reason: err.message
              }).save();
            }
          })();
        }

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
            type: m.type,
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

    // ── Chat: Get AI Reply Suggestions ────────────────────────
    socket.on('chat:suggestions:get', async ({ withUid }) => {
      const fromUid = socket.data.uid;
      const mongoId = socket.data.mongoId;
      console.log('📥 Received chat:suggestions:get from:', fromUid, 'for:', withUid);
      if (!fromUid || !mongoId || !withUid) {
        console.warn('❌ Missing credentials/UIDs in suggestions request');
        return;
      }

      try {
        // 1. Check user settings
        const user = await User.findById(mongoId);
        if (!user) {
          console.warn('❌ User not found in DB:', mongoId);
          socket.emit('chat:suggestions', { withUid, suggestions: null });
          return;
        }
        if (user.aiReplySuggestions === false) {
          console.log('ℹ️ AI suggestions are disabled for user:', fromUid);
          socket.emit('chat:suggestions', { withUid, suggestions: null });
          return;
        }

        // 2. Find recipient and chat
        const recipient = await User.findOne({ firebaseUid: withUid });
        if (!recipient) {
          console.warn('❌ Recipient not found:', withUid);
          return;
        }

        const chat = await Chat.findOne({
          participants: { $all: [mongoId, recipient._id] }
        });

        if (!chat) {
          console.warn('❌ Chat not found between:', fromUid, 'and', withUid);
          socket.emit('chat:suggestions', { withUid, suggestions: null });
          return;
        }

        // 3. Find the last message
        const lastMessage = await Message.findOne({ chatId: chat._id }).sort({ createdAt: -1 });
        if (!lastMessage) {
          console.log('ℹ️ No messages in chat yet');
          socket.emit('chat:suggestions', { withUid, suggestions: null });
          return;
        }

        // 4. Check cache
        const cached = suggestionCache.get(chat._id.toString());
        if (cached && cached.lastMessageId === lastMessage._id.toString()) {
          console.log('⚡ Returning cached suggestions for chat:', chat._id);
          socket.emit('chat:suggestions', { withUid, suggestions: cached.suggestions });
          return;
        }

        // 5. Query last 15 messages for context
        const dbMessages = await Message.find({ chatId: chat._id })
          .sort({ createdAt: -1 })
          .limit(15)
          .populate('senderId', 'name');

        // Reverse to chronological order
        dbMessages.reverse();

        const messagesForAI = dbMessages.map(m => ({
          senderName: m.senderId ? m.senderId.name : 'Unknown',
          text: m.text
        }));

        console.log(`🤖 Requesting Gemini suggestions for ${messagesForAI.length} messages...`);
        // 6. Generate using Gemini
        const suggestions = await geminiService.generateSuggestions(messagesForAI);
        console.log('✅ Generated suggestions:', suggestions);

        // 7. Save to cache
        setSuggestionCache(chat._id, lastMessage._id, suggestions);

        // 8. Emit to socket
        socket.emit('chat:suggestions', { withUid, suggestions });

      } catch (error) {
        console.error('❌ Error in chat:suggestions:get:', error);
        socket.emit('chat:suggestions', { withUid, error: error.message });
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
            type: m.type,
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
};

module.exports = socketHandler;
