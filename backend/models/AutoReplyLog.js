const mongoose = require('mongoose');

const autoReplyLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  incomingMessage: {
    type: String,
    required: true
  },
  outgoingReply: {
    type: String
  },
  status: {
    type: String,
    enum: ['sent', 'skipped', 'error'],
    required: true
  },
  reason: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('AutoReplyLog', autoReplyLogSchema);
