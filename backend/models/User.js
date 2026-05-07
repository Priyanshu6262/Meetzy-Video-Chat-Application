const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  photo: {
    type: String,
    default: ''
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  addedContacts: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  contactSettings: {
    type: Map,
    of: new mongoose.Schema({
      customName: String,
      nickname: String,
      customLabel: String,
      clearedChatAt: Date
    }, { _id: false }),
    default: {}
  },
  blockedUsers: [{
    type: String // store firebaseUid of blocked users
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
