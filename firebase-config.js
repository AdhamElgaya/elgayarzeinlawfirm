/**
 * Frontend-only: replace with values from Firebase Console → Project settings → Your apps → Web app.
 * No server — the SDK talks to Firebase’s hosted APIs from the browser.
 *
 * Firebase Console: https://console.firebase.google.com/
 * 1. Create project (or use existing) → enable Firestore Database.
 * 2. Register a Web app → copy the firebaseConfig object below.
 * 3. Firestore → Rules → allow controlled creates (see comment at bottom of booking-firebase.js).
 */
window.__GZ_FIREBASE_CONFIG__ = {
  apiKey: "AIzaSyBu63NrBhLCOCnkqP2XE81ubqNs8PBwEWQ",
  authDomain: "elgayarandzein.firebaseapp.com",
  projectId: "elgayarandzein",
  storageBucket: "elgayarandzein.firebasestorage.app",
  messagingSenderId: "203763788945",
  appId: "1:203763788945:web:49791e430c5f72d1902330",
};
