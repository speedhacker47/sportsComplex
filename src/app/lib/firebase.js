// lib/firebaseConfig.js
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth'; // If you're using authentication
import { getStorage } from "firebase/storage";

const firebaseConfig = {
 apiKey: "AIzaSyCrA3eTSAHVKjsPxzUxEADV4olgQzw_pfc",
  authDomain: "sportscomplex-71c6d.firebaseapp.com",
  projectId: "sportscomplex-71c6d",
  storageBucket: "sportscomplex-71c6d.firebasestorage.app",
  messagingSenderId: "312920430788",
  appId: "1:312920430788:web:d5bc8a07d0fc86b2c81191",
  measurementId: "G-KWJCVW4PDL"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app); // Optional: if you need Firebase Authentication
const storage = getStorage(app);

export { app, db, auth , storage };