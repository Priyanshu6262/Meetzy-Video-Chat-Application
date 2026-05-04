const admin = require('firebase-admin');
const { initializeApp } = require('firebase/app');
const dotenv = require('dotenv');
const fs = require('fs');

dotenv.config();

// 1. Initialize Firebase Admin SDK
try {
  if (fs.existsSync('./serviceAccountKey.json')) {
    const serviceAccount = require('./serviceAccountKey.json');
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
