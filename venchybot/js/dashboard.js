/**
 * Venchy Bot Dashboard — Dashboard Logic
 * CRUD operations for YouTube and Instagram feeds via Firestore
 */

import {
    collection, getDocs, doc, setDoc, deleteDoc, onSnapshot, getDoc
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


// ── State ──────────────────────────────────────────────────────
let currentGuildId = null;
let ytUnsubscribe = null;
let igUnsubscribe = null;


// ── Load Dashboard Data ────────────────────────────────────────
window.loadDashboardData = async function () {
    const db = window.firebaseDb;

    try {
        // Load all guilds into the selector
        const guildsSnap = await getDocs(collection(db, "guilds"));
        const guildSelect = document.getElementById("guild-select");

        // Clear existing options (keep the default)
        guildSelect.innerHTML = '<option value="">Select Server...</option>';

        let guildCount = 0;
        guildsSnap.forEach((doc) => {
            const data = doc.data();
            const option = document.createElement("option");
            option.value = doc.id;
            option.textContent = data.guild_name || `Server ${doc.id}`;
            guildSelect.appendChild(option);
            guildCount++;
        });

        document.getElementById("stat-server-count").textContent = guildCount;

        // Auto-select if only one guild
        if (guildCount === 1) {
            guildSelect.selectedIndex = 1;
            currentGuildId = guildSelect.value;
            loadGuildFeeds(currentGuildId);
        }

    } catch (error) {
        console.error("Error loading dashboard data:", error);
        showToast("Failed to load data: " + error.message, "error");
    }
};


// ── Guild Selection Handler ────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    const guildSelect = document.getElementById("guild-select");
    if (guildSelect) {
        guildSelect.addEventListener("change", (e) => {
            currentGuildId = e.target.value;
            if (currentGuildId) {
                loadGuildFeeds(currentGuildId);
            } else {
                clearFeeds();
            }
        });
    }
});


// ── Load Feeds for a Guild ─────────────────────────────────────
function loadGuildFeeds(guildId) {
    const db = window.firebaseDb;

    // Unsubscribe from previous listeners
    if (ytUnsubscribe) ytUnsubscribe();
    if (igUnsubscribe) igUnsubscribe();

    // YouTube feeds — real-time listener
    const ytRef = collection(db, "guilds", guildId, "youtube_feeds");
    ytUnsubscribe = onSnapshot(ytRef, (snapshot) => {
        const feeds = [];
        snapshot.forEach((doc) => feeds.push({ id: doc.id, ...doc.data() }));
        renderYouTubeFeeds(feeds);
        document.getElementById("stat-yt-count").textContent = feeds.length;
    }, (error) => {
        console.error("YouTube feeds listener error:", error);
    });

    // Instagram feeds — real-time listener
    const igRef = collection(db, "guilds", guildId, "instagram_feeds");
    igUnsubscribe = onSnapshot(igRef, (snapshot) => {
        const feeds = [];
        snapshot.forEach((doc) => feeds.push({ id: doc.id, ...doc.data() }));
        renderInstagramFeeds(feeds);
        document.getElementById("stat-ig-count").textContent = feeds.length;
    }, (error) => {
        console.error("Instagram feeds listener error:", error);
    });
}


function clearFeeds() {
    if (ytUnsubscribe) ytUnsubscribe();
    if (igUnsubscribe) igUnsubscribe();
    document.getElementById("youtube-feeds-list").innerHTML = renderEmptyState("youtube");
    document.getElementById("instagram-feeds-list").innerHTML = renderEmptyState("instagram");
    document.getElementById("stat-yt-count").textContent = "0";
    document.getElementById("stat-ig-count").textContent = "0";
}


// ══════════════════════════════════════════════════════════════
//  RENDER FUNCTIONS
// ══════════════════════════════════════════════════════════════

function renderYouTubeFeeds(feeds) {
    const container = document.getElementById("youtube-feeds-list");

    if (feeds.length === 0) {
        container.innerHTML = renderEmptyState("youtube");
        return;
    }

    container.innerHTML = feeds.map(feed => `
        <div class="feed-card" data-id="${feed.channel_id}">
            <div class="feed-info">
                <div class="feed-name">📺 ${escapeHtml(feed.channel_name || feed.channel_id)}</div>
                <div class="feed-details">
                    <span><i class="fas fa-fingerprint"></i> ${feed.channel_id}</span>
                    <span><i class="fas fa-hashtag"></i> ${feed.discord_channel_id || 'Not set'}</span>
                    ${feed.ping_role_id ? `<span><i class="fas fa-bell"></i> Role: ${feed.ping_role_id}</span>` : ''}
                </div>
            </div>
            <div class="feed-actions">
                <button class="btn btn-danger btn-sm" onclick="removeYouTubeFeed('${escapeHtml(feed.channel_id)}')">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        </div>
    `).join("");
}


function renderInstagramFeeds(feeds) {
    const container = document.getElementById("instagram-feeds-list");

    if (feeds.length === 0) {
        container.innerHTML = renderEmptyState("instagram");
        return;
    }

    container.innerHTML = feeds.map(feed => `
        <div class="feed-card" data-id="${feed.label}">
            <div class="feed-info">
                <div class="feed-name">📸 ${escapeHtml(feed.display_name || feed.label)}</div>
                <div class="feed-details">
                    <span><i class="fas fa-rss"></i> ${escapeHtml((feed.rss_url || '').substring(0, 45))}...</span>
                    <span><i class="fas fa-hashtag"></i> ${feed.discord_channel_id || 'Not set'}</span>
                    ${feed.ping_role_id ? `<span><i class="fas fa-bell"></i> Role: ${feed.ping_role_id}</span>` : ''}
                </div>
            </div>
            <div class="feed-actions">
                <button class="btn btn-danger btn-sm" onclick="removeInstagramFeed('${escapeHtml(feed.label)}')">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        </div>
    `).join("");
}


function renderEmptyState(type) {
    const icons = { youtube: "fab fa-youtube", instagram: "fab fa-instagram" };
    const labels = { youtube: "YouTube", instagram: "Instagram" };
    return `
        <div class="empty-state">
            <i class="${icons[type]}"></i>
            <p>No ${labels[type]} feeds configured</p>
            <span>Click "Add ${type === 'youtube' ? 'Channel' : 'Feed'}" to get started</span>
        </div>
    `;
}


// ══════════════════════════════════════════════════════════════
//  CRUD OPERATIONS
// ══════════════════════════════════════════════════════════════

// ── Add YouTube Feed ───────────────────────────────────────────
window.addYouTubeFeed = async function () {
    if (!currentGuildId) {
        showToast("Please select a server first", "error");
        return;
    }

    const channelId = document.getElementById("yt-channel-id").value.trim();
    const channelName = document.getElementById("yt-channel-name").value.trim();
    const discordChannel = document.getElementById("yt-discord-channel").value.trim();
    const pingRole = document.getElementById("yt-ping-role").value.trim();

    if (!channelId || !channelName) {
        showToast("Channel ID and Name are required", "error");
        return;
    }

    if (!channelId.startsWith("UC") || channelId.length < 20) {
        showToast("Invalid Channel ID — must start with 'UC'", "error");
        return;
    }

    const db = window.firebaseDb;

    try {
        // Ensure guild doc exists
        await setDoc(doc(db, "guilds", currentGuildId), { guild_id: currentGuildId }, { merge: true });

        // Add the feed
        await setDoc(doc(db, "guilds", currentGuildId, "youtube_feeds", channelId), {
            channel_id: channelId,
            channel_name: channelName,
            discord_channel_id: discordChannel || "",
            ping_role_id: pingRole || null,
            last_video_ids: [],
            added_at: new Date().toISOString(),
            added_by: "dashboard",
        });

        showToast(`Added YouTube channel: ${channelName}`, "success");
        closeModal("youtube");
        clearForm("youtube");

    } catch (error) {
        console.error("Error adding YouTube feed:", error);
        showToast("Failed to add feed: " + error.message, "error");
    }
};


// ── Remove YouTube Feed ────────────────────────────────────────
window.removeYouTubeFeed = async function (channelId) {
    if (!currentGuildId) return;
    if (!confirm(`Remove YouTube channel "${channelId}"?`)) return;

    const db = window.firebaseDb;

    try {
        await deleteDoc(doc(db, "guilds", currentGuildId, "youtube_feeds", channelId));
        showToast("YouTube channel removed", "success");
    } catch (error) {
        console.error("Error removing YouTube feed:", error);
        showToast("Failed to remove: " + error.message, "error");
    }
};


// ── Add Instagram Feed ─────────────────────────────────────────
window.addInstagramFeed = async function () {
    if (!currentGuildId) {
        showToast("Please select a server first", "error");
        return;
    }

    const rssUrl = document.getElementById("ig-rss-url").value.trim();
    const label = document.getElementById("ig-label").value.trim();
    const discordChannel = document.getElementById("ig-discord-channel").value.trim();
    const pingRole = document.getElementById("ig-ping-role").value.trim();

    if (!rssUrl || !label) {
        showToast("RSS URL and Label are required", "error");
        return;
    }

    if (!rssUrl.startsWith("http")) {
        showToast("Invalid URL — must start with http:// or https://", "error");
        return;
    }

    const safeLabel = label.toLowerCase().replace(/\s+/g, "_").replace(/\//g, "_").substring(0, 50);
    const db = window.firebaseDb;

    try {
        // Ensure guild doc exists
        await setDoc(doc(db, "guilds", currentGuildId), { guild_id: currentGuildId }, { merge: true });

        // Add the feed
        await setDoc(doc(db, "guilds", currentGuildId, "instagram_feeds", safeLabel), {
            rss_url: rssUrl,
            label: safeLabel,
            display_name: label,
            discord_channel_id: discordChannel || "",
            ping_role_id: pingRole || null,
            last_post_ids: [],
            added_at: new Date().toISOString(),
            added_by: "dashboard",
        });

        showToast(`Added Instagram feed: ${label}`, "success");
        closeModal("instagram");
        clearForm("instagram");

    } catch (error) {
        console.error("Error adding Instagram feed:", error);
        showToast("Failed to add feed: " + error.message, "error");
    }
};


// ── Remove Instagram Feed ──────────────────────────────────────
window.removeInstagramFeed = async function (label) {
    if (!currentGuildId) return;
    if (!confirm(`Remove Instagram feed "${label}"?`)) return;

    const db = window.firebaseDb;

    try {
        await deleteDoc(doc(db, "guilds", currentGuildId, "instagram_feeds", label));
        showToast("Instagram feed removed", "success");
    } catch (error) {
        console.error("Error removing Instagram feed:", error);
        showToast("Failed to remove: " + error.message, "error");
    }
};


// ══════════════════════════════════════════════════════════════
//  UI HELPERS
// ══════════════════════════════════════════════════════════════

// ── Tab Switching ──────────────────────────────────────────────
window.switchTab = function (tabName) {
    // Update tab buttons
    document.querySelectorAll(".tab").forEach(tab => {
        tab.classList.toggle("active", tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll(".tab-content").forEach(content => {
        content.classList.toggle("active", content.id === `tab-${tabName}`);
    });
};


// ── Modal Controls ─────────────────────────────────────────────
window.openModal = function (type) {
    if (!currentGuildId) {
        showToast("Please select a server first", "error");
        return;
    }
    document.getElementById(`modal-${type}`).classList.remove("hidden");
};

window.closeModal = function (type) {
    document.getElementById(`modal-${type}`).classList.add("hidden");
};

// Close modal on overlay click
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("modal-overlay")) {
        e.target.classList.add("hidden");
    }
});

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay").forEach(modal => {
            modal.classList.add("hidden");
        });
    }
});


// ── Form Helpers ───────────────────────────────────────────────
function clearForm(type) {
    if (type === "youtube") {
        document.getElementById("yt-channel-id").value = "";
        document.getElementById("yt-channel-name").value = "";
        document.getElementById("yt-discord-channel").value = "";
        document.getElementById("yt-ping-role").value = "";
    } else if (type === "instagram") {
        document.getElementById("ig-rss-url").value = "";
        document.getElementById("ig-label").value = "";
        document.getElementById("ig-discord-channel").value = "";
        document.getElementById("ig-ping-role").value = "";
    }
}


// ── Security Helper ────────────────────────────────────────────
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
}
