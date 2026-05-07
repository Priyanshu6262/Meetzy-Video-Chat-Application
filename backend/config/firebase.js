const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

// 1. Initialize Firebase Admin SDK
try {
  const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    // 🚀 Production: Decode Base64 from environment variable
    const decodedKey = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(decodedKey);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized with Base64 environment variable');
  } else if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized with serviceAccountKey.json');
  } else {
    console.warn('⚠️  serviceAccountKey.json not found!');
    console.warn('⚠️  Please generate it from Firebase Console and place it in the backend folder.');
    admin.initializeApp();
  }
} catch (error) {
  console.error('Firebase Admin Initialization Error:', error);
}

// 2. Initialize Firebase Client SDK (if needed in backend)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);

module.exports = { admin, firebaseApp };
