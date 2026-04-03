/**
 * Venchy Bot Dashboard — Firebase Initialization
 * Uses Firebase v10 modular SDK via CDN
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";


// ══════════════════════════════════════════════════════════════
//  🔥 Firebase Configuration
// ══════════════════════════════════════════════════════════════
const firebaseConfig = {
    apiKey: "AIzaSyCjrjpBt2FRfEGMKsn2LaLR00NEBPZH6Dw",
    authDomain: "watchful-bonus-406713.firebaseapp.com",
    projectId: "watchful-bonus-406713",
    storageBucket: "watchful-bonus-406713.firebasestorage.app",
    messagingSenderId: "472641537744",
    appId: "1:472641537744:web:62c53c3691e5fedcde40d5",
    measurementId: "G-1R0XSY2X3R"
};
// ══════════════════════════════════════════════════════════════


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Export for use in other modules
window.firebaseApp = app;
window.firebaseDb = db;
window.firebaseAuth = auth;

console.log("🔥 Firebase initialized");
