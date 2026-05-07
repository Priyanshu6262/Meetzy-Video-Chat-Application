const { admin } = require('../config/firebase');
const User = require('../models/User');

const authenticateGoogleUser = async (req, res) => {
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
};

module.exports = {
  authenticateGoogleUser
};
