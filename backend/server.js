const express = require('express');
const cors = require('cors');
const { admin } = require('./firebase');

const app = express();
app.use(cors());
app.use(express.json());

// Authentication Endpoint
app.post('/api/auth/google', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ error: 'ID token is required' });
  }

  try {
    // Verify the ID token using Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name, picture } = decodedToken;

    console.log(`✅ User authenticated: ${email} (UID: ${uid})`);

    // Here you would typically look up the user in your database (e.g., MongoDB, PostgreSQL)
    // If they don't exist, create a new user record.
    // For now, we simply return a success response with user details.

    res.status(200).json({
      message: 'Authentication successful',
      user: {
        uid,
        email,
        name,
        picture
      }
    });
  } catch (error) {
    console.error('❌ Error verifying ID token:', error);
    res.status(401).json({ error: 'Invalid or expired ID token' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
