/**
 * Venchy Bot Dashboard — Authentication Module
 * Discord OAuth2 Implicit Grant Flow
 */

import { signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const DISCORD_CLIENT_ID = "1489277267249987685"; 

// ── Initialize Auth ────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Check if returning from Discord OAuth
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const [accessToken, tokenType] = [fragment.get('access_token'), fragment.get('token_type')];

    if (accessToken) {
        // Store the token and clean the URL
        localStorage.setItem('discord_token', accessToken);
        localStorage.setItem('discord_token_type', tokenType);
        
        // Remove hash from URL to keep it clean
        window.history.replaceState(null, null, window.location.pathname + window.location.search);
        await initSession();
        return;
    }

    // 2. Check if already have a session
    if (localStorage.getItem('discord_token')) {
        await initSession();
    } else {
        showAuthGate();
    }
});


// ── Authenticate User Session ──────────────────────────────────
async function initSession() {
    const token = localStorage.getItem('discord_token');
    const tokenType = localStorage.getItem('discord_token_type');

    try {
        // Fetch User Profile from Discord
        const response = await fetch('https://discord.com/api/users/@me', {
            headers: {
                authorization: `${tokenType} ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Discord API error: ${response.status}`);
        }

        const user = await response.json();
        console.log("👤 User signed in via Discord:", user.username);
        
        // Ensure Firebase has an anonymous session so the Firestore SDK works
        // (if there are loose security rules or custom rules)
        await ensureFirebaseAnonymous();

        // Save user to window so dashboard.js can use it
        window.discordUser = user;
        showDashboard(user);

    } catch (error) {
        console.error("Session initialization failed:", error);
        localStorage.removeItem('discord_token');
        localStorage.removeItem('discord_token_type');
        showAuthGate();
        if (error.message.includes('401')) {
            showToast("Session expired. Please log in again.", "error");
        }
    }
}


// ── Firebase Anonymous Auth (Fallback) ─────────────────────────
async function ensureFirebaseAnonymous() {
    return new Promise((resolve) => {
        const check = async () => {
            if (window.firebaseAuth) {
                try {
                    await signInAnonymously(window.firebaseAuth);
                    console.log("🔥 Firebase Anonymous Session initialized.");
                } catch (e) {
                    console.warn("Could not sign in to Firebase Anonymously.", e);
                }
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}


// ── Discord Sign-In ────────────────────────────────────────────
window.signInWithDiscord = function() {
    // Current URI without hashes
    const redirectUri = window.location.href.split('#')[0];
    
    // Scopes needed: user identity + user's guilds
    const scopes = "identify guilds";

    const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${DISCORD_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token&scope=${encodeURIComponent(scopes)}`;
    
    window.location.href = oauthUrl;
};


// ── Sign Out ───────────────────────────────────────────────────
window.signOut = async function() {
    localStorage.removeItem('discord_token');
    localStorage.removeItem('discord_token_type');
    window.discordUser = null;
    
    if (window.firebaseAuth) {
        try {
            await window.firebaseAuth.signOut();
        } catch (e) {}
    }
    
    showToast("Signed out successfully", "info");
    showAuthGate();
};


// ── UI Helpers ─────────────────────────────────────────────────
function showDashboard(user) {
    document.getElementById("auth-gate").classList.add("hidden");
    document.getElementById("dashboard").classList.remove("hidden");

    // Update user info
    document.getElementById("user-name").textContent = user.global_name || user.username;
    
    // Discord Avatars
    const avatar = document.getElementById("user-avatar");
    if (user.avatar) {
        const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
        avatar.src = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
    } else {
        // Default avatar
        const index = parseInt(user.discriminator, 10) % 5;
        avatar.src = `https://cdn.discordapp.com/embed/avatars/${isNaN(index) ? 0 : index}.png`;
    }
    avatar.alt = user.username;

    // Trigger dashboard data load
    if (typeof window.loadDashboardData === "function") {
        window.loadDashboardData();
    }
}

function showAuthGate() {
    document.getElementById("auth-gate").classList.remove("hidden");
    document.getElementById("dashboard").classList.add("hidden");
}


// ── Toast Notification (from original) ─────────────────────────
window.showToast = function(message, type = "info") {
    const container = document.getElementById("toast-container");
    const icons = {
        success: "fa-check-circle",
        error: "fa-exclamation-circle",
        info: "fa-info-circle",
    };
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "toastOut 0.3s ease-in forwards";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};
