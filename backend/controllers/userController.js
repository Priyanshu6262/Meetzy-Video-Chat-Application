const User = require('../models/User');
const Chat = require('../models/Chat');

const checkUserExists = async (req, res) => {
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
};

const getUserSettings = async (req, res) => {
  const { uid } = req.params;
  try {
    const user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const geminiConnected = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY';

    res.status(200).json({
      aiReplySuggestions: user.aiReplySuggestions !== undefined ? user.aiReplySuggestions : true,
      autoReplyEnabled: user.autoReplyEnabled !== undefined ? user.autoReplyEnabled : false,
      autoReplyLanguage: user.autoReplyLanguage || 'auto',
      autoReplyStyle: user.autoReplyStyle || 'friendly',
      geminiConnected
    });
  } catch (error) {
    console.error('❌ Error fetching user settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateUserSettings = async (req, res) => {
  const { uid } = req.params;
  const { aiReplySuggestions, autoReplyEnabled, autoReplyLanguage, autoReplyStyle } = req.body;

  const updateFields = {};
  if (aiReplySuggestions !== undefined) updateFields.aiReplySuggestions = aiReplySuggestions;
  if (autoReplyEnabled !== undefined) updateFields.autoReplyEnabled = autoReplyEnabled;
  if (autoReplyLanguage !== undefined) updateFields.autoReplyLanguage = autoReplyLanguage;
  if (autoReplyStyle !== undefined) updateFields.autoReplyStyle = autoReplyStyle;

  try {
    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      { $set: updateFields },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const geminiConnected = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY';

    res.status(200).json({
      success: true,
      aiReplySuggestions: user.aiReplySuggestions,
      autoReplyEnabled: user.autoReplyEnabled,
      autoReplyLanguage: user.autoReplyLanguage,
      autoReplyStyle: user.autoReplyStyle,
      geminiConnected
    });
  } catch (error) {
    console.error('❌ Error updating user settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  checkUserExists,
  getUserSettings,
  updateUserSettings
};
