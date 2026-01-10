// Setup Firebase Config
// IMPORTANT: User must replace these values
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, setDoc, limit, increment } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyBycZ0OkRPLz4KYCNc1o-fTkP59EXT72Ko",
    authDomain: "venchy-web.firebaseapp.com",
    projectId: "venchy-web",
    storageBucket: "venchy-web.firebasestorage.app",
    messagingSenderId: "1055864281060",
    appId: "1:1055864281060:web:1b02f5d9a84a4e3a2059f1",
    measurementId: "G-MK9L5MKZZ4"
};

// Initialize Firebase
let app;
let auth;
let db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (e) {
    console.error("Firebase Initialization Error. Did you update firebase-config.js?", e);
    alert("Chat system not configured. Please add your Firebase API keys to js/firebase-config.js");
}

export { auth, db, GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, setDoc, limit, increment };
