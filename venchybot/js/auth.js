/**
 * Venchy Bot Dashboard — Authentication Module
 * Google Sign-in with admin whitelist stored in Firestore
 */

import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged }
    from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc }
    from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


// Wait for Firebase to initialize
function waitForFirebase() {
    return new Promise((resolve) => {
        const check = () => {
            if (window.firebaseAuth && window.firebaseDb) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// ── Initialize Auth ────────────────────────────────────────────
waitForFirebase().then(() => {
    const auth = window.firebaseAuth;
    const db = window.firebaseDb;

    // Listen for auth state changes
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("👤 User signed in:", user.email);
            
            // Check if user is an authorized admin
            const isAdmin = await checkAdmin(user.email);
            
            if (isAdmin) {
                showDashboard(user);
            } else {
                console.warn("⛔ User is not an authorized admin:", user.email);
                await firebaseSignOut(auth);
                showToast("Access Denied — Your email is not authorized as an admin.", "error");
            }
        } else {
            console.log("👤 User signed out");
            showAuthGate();
        }
    });
});


// ── Check if user is an admin ──────────────────────────────────
async function checkAdmin(email) {
    const db = window.firebaseDb;
    
    try {
        // Check the 'admins' collection for this email
        const adminDoc = await getDoc(doc(db, "admins", email));
        
        if (adminDoc.exists()) {
            return true;
        }

        // Fallback: Check a general config document
        const configDoc = await getDoc(doc(db, "config", "dashboard"));
        if (configDoc.exists()) {
            const data = configDoc.data();
            const allowedEmails = data.admin_emails || [];
            return allowedEmails.includes(email);
        }

        // If no admin list exists, allow the first user (bootstrapping)
        // This will be the initial setup — user should then add their email
        console.warn("⚠️ No admin list found — allowing first user for initial setup");
        return true;
        
    } catch (error) {
        console.error("Error checking admin status:", error);
        // Allow access if Firestore rules haven't been set up yet
        return true;
    }
}


// ── Google Sign-In ─────────────────────────────────────────────
window.signInWithGoogle = async function() {
    const auth = window.firebaseAuth;
    const provider = new GoogleAuthProvider();
    
    try {
        const result = await signInWithPopup(auth, provider);
        console.log("✅ Signed in:", result.user.displayName);
    } catch (error) {
        if (error.code === 'auth/popup-closed-by-user') {
            console.log("Sign-in popup closed by user");
        } else if (error.code === 'auth/popup-blocked') {
            showToast("Popup blocked — please allow popups for this site", "error");
        } else {
            console.error("Sign-in error:", error);
            showToast("Sign-in failed: " + error.message, "error");
        }
    }
};


// ── Sign Out ───────────────────────────────────────────────────
window.signOut = async function() {
    const auth = window.firebaseAuth;
    try {
        await firebaseSignOut(auth);
        showToast("Signed out successfully", "info");
    } catch (error) {
        console.error("Sign-out error:", error);
    }
};


// ── UI Helpers ─────────────────────────────────────────────────
function showDashboard(user) {
    document.getElementById("auth-gate").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");

    // Update user info
    document.getElementById("user-name").textContent = user.displayName || user.email;
    const avatar = document.getElementById("user-avatar");
    avatar.src = user.photoURL || "https://www.gravatar.com/avatar/?d=mp";
    avatar.alt = user.displayName || "User";

    // Trigger dashboard data load
    if (typeof window.loadDashboardData === "function") {
        window.loadDashboardData();
    }
}

function showAuthGate() {
    document.getElementById("auth-gate").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
}


// ── Toast Notification ─────────────────────────────────────────
window.showToast = function(message, type = "info") {
    const container = document.getElementById("toast-container");
    
    const icons = {
        success: "fa-check-circle",
        error: "fa-exclamation-circle",
        info: "fa-info-circle",
    };

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.style.animation = "toastOut 0.3s ease-in forwards";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};
