/**
 * Venchy Bot Dashboard — Authentication Module
 * Google Sign-in with admin whitelist stored in Firestore
 */

import { OAuthProvider, signInWithPopup, signInWithCustomToken, signOut as firebaseSignOut, onAuthStateChanged }
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
async function checkAdmin(user) {
    const db = window.firebaseDb;
    
    // We treat either the email or the Discord UID as a valid identifier
    const identifier = user.email || user.providerData?.[0]?.uid || user.uid;
    
    if (!identifier) return false;

    try {
        // Check the 'admins' collection for this identifier (either email or UID)
        const adminDoc = await getDoc(doc(db, "admins", identifier));
        
        if (adminDoc.exists()) {
            return true;
        }

        // Fallback: Check a general config document
        const configDoc = await getDoc(doc(db, "config", "dashboard"));
        if (configDoc.exists()) {
            const data = configDoc.data();
            const allowedIds = data.admin_emails || [];
            return allowedIds.includes(identifier);
        }

        // If no admin list exists, allow the first user (bootstrapping)
        // This will be the initial setup — user should then add their email or ID
        console.warn("⚠️ No admin list found — allowing first user for initial setup");
        return true;
        
    } catch (error) {
        console.error("Error checking admin status:", error);
        // Allow access if Firestore rules haven't been set up yet
        return true;
    }
}


// ── Discord Auth Core ─────────────────────────────────────────
const DISCORD_CLIENT_ID = "1489277267249987685";
const REDIRECT_URI = encodeURIComponent(window.location.origin + window.location.pathname);
const DISCORD_AUTH_URL = `https://discord.com/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=token&scope=identify%20guilds`;

// Placeholder for your Railway bot URL (update this after deployment)
const BOT_API_URL = window.location.origin.includes('localhost') 
    ? 'http://localhost:8080' 
    : 'https://venchy-bot.up.railway.app'; 

// ── Discord Sign-In (Redirect) ────────────────────────────────
window.signInWithDiscord = function() {
    window.location.href = DISCORD_AUTH_URL;
};

// ── Check for Discord Redirect Callback ───────────────────────
async function checkDiscordCallback() {
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token=")) return;

    // Clear hash from URL immediately for clean history
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get("access_token");
    window.history.replaceState(null, null, window.location.pathname);

    if (!accessToken) return;

    showToast("Authenticating with Venchy Bot...", "info");

    try {
        const response = await fetch(`${BOT_API_URL}/auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token: accessToken })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error || "Failed to bridge authentication");
        }

        const data = await response.json();
        
        // Save manageable guilds to global state for dashboard.js
        window.userManageableGuilds = data.guilds;

        // Sign in to Firebase with the Custom Token from the bot
        await signInWithCustomToken(window.firebaseAuth, data.firebase_token);
        console.log("✅ Successfully bridged Discord auth to Firebase");

    } catch (error) {
        console.error("Auth bridge error:", error);
        showToast("Bot authentication failed: " + error.message, "error");
    }
}

// Ensure callback check runs on module load
waitForFirebase().then(checkDiscordCallback);


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
