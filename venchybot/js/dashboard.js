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
let guildMetadata = { channels: [], roles: [] };


// ── Load Dashboard Data ────────────────────────────────────────
window.loadDashboardData = async function () {
    const db = window.firebaseDb;

    try {
        const guildSelect = document.getElementById("guild-select");
        let guilds = [];

        // Priority 1: Use guilds returned by the bot bridge (with MANAGE_SERVER perms)
        if (window.userManageableGuilds && window.userManageableGuilds.length > 0) {
            console.log("📂 Using manageable guilds from bot bridge");
            guilds = window.userManageableGuilds;
        } else {
            // Priority 2: Fallback to all guilds in Firestore (legacy/admin view)
            console.log("📂 Fetching all guilds from Firestore");
            const guildsSnap = await getDocs(collection(db, "guilds"));
            guildsSnap.forEach((doc) => {
                const data = doc.data();
                guilds.push({ id: doc.id, name: data.guild_name || `Server ${doc.id}` });
            });
        }

        // Clear existing options (keep the default)
        guildSelect.innerHTML = '<option value="">Select Server...</option>';

        guilds.forEach((guild) => {
            const option = document.createElement("option");
            option.value = guild.id;
            option.textContent = guild.name;
            guildSelect.appendChild(option);
        });

        document.getElementById("stat-server-count").textContent = guilds.length;

        // Auto-select if only one guild
        if (guilds.length === 1) {
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
async function loadGuildFeeds(guildId) {
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

    // Fetch Guild Metadata (Channels & Roles)
    try {
        const metaDoc = await getDoc(doc(db, "guilds", guildId, "info", "meta"));
        if (metaDoc.exists()) {
            guildMetadata = metaDoc.data();
            populateDropdowns(guildMetadata.channels || [], guildMetadata.roles || []);
        } else {
            console.warn("No metadata found for guild:", guildId);
            guildMetadata = { channels: [], roles: [] };
            populateDropdowns([], []);
        }
    } catch (error) {
        console.error("Error fetching guild metadata:", error);
    }
}


function populateDropdowns(channels, roles) {
    const channelSelects = [
        document.getElementById("yt-discord-channel"),
        document.getElementById("ig-discord-channel")
    ];
    const roleSelects = [
        document.getElementById("yt-ping-role"),
        document.getElementById("ig-ping-role")
    ];

    // Populate Channels
    channelSelects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">Select a channel...</option>';
        channels.forEach(ch => {
            const option = document.createElement("option");
            option.value = ch.id;
            option.textContent = `# ${ch.name}`;
            select.appendChild(option);
        });
    });

    // Populate Roles
    roleSelects.forEach(select => {
        if (!select) return;
        select.innerHTML = '<option value="">No ping</option>';
        roles.forEach(role => {
            const option = document.createElement("option");
            option.value = role.id;
            option.textContent = `@ ${role.name}`;
            select.appendChild(option);
        });
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

    container.innerHTML = feeds.map(feed => {
        const channelName = guildMetadata.channels?.find(c => c.id === feed.discord_channel_id)?.name || feed.discord_channel_id;
        const roleName = feed.ping_role_id ? (guildMetadata.roles?.find(r => r.id === feed.ping_role_id)?.name || feed.ping_role_id) : null;

        return `
            <div class="feed-card" data-id="${feed.channel_id}">
                <div class="feed-info">
                    <div class="feed-name">📺 ${escapeHtml(feed.channel_name || feed.channel_id)}</div>
                    <div class="feed-details">
                        <span><i class="fas fa-fingerprint"></i> ${feed.channel_id}</span>
                        <span><i class="fas fa-hashtag"></i> ${escapeHtml(channelName)}</span>
                        ${roleName ? `<span><i class="fas fa-bell"></i> @ ${escapeHtml(roleName)}</span>` : ''}
                    </div>
                </div>
                <div class="feed-actions">
                    <button class="btn btn-danger btn-sm" onclick="removeYouTubeFeed('${escapeHtml(feed.channel_id)}')">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
    }).join("");
}


function renderInstagramFeeds(feeds) {
    const container = document.getElementById("instagram-feeds-list");

    if (feeds.length === 0) {
        container.innerHTML = renderEmptyState("instagram");
        return;
    }

    container.innerHTML = feeds.map(feed => {
        const channelName = guildMetadata.channels?.find(c => c.id === feed.discord_channel_id)?.name || feed.discord_channel_id;
        const roleName = feed.ping_role_id ? (guildMetadata.roles?.find(r => r.id === feed.ping_role_id)?.name || feed.ping_role_id) : null;

        return `
            <div class="feed-card" data-id="${feed.label}">
                <div class="feed-info">
                    <div class="feed-name">📸 ${escapeHtml(feed.display_name || feed.label)}</div>
                    <div class="feed-details">
                        <span><i class="fas fa-rss"></i> ${escapeHtml((feed.rss_url || '').substring(0, 45))}...</span>
                        <span><i class="fas fa-hashtag"></i> ${escapeHtml(channelName)}</span>
                        ${roleName ? `<span><i class="fas fa-bell"></i> @ ${escapeHtml(roleName)}</span>` : ''}
                    </div>
                </div>
                <div class="feed-actions">
                    <button class="btn btn-danger btn-sm" onclick="removeInstagramFeed('${escapeHtml(feed.label)}')">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                </div>
            </div>
        `;
    }).join("");
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
window.resolveYouTubeChannel = async function () {
    const input = document.getElementById("yt-input-search").value.trim();
    if (!input) {
        showToast("Enter a Channel URL, Handle, or ID", "error");
        return;
    }

    const btn = document.querySelector('button[onclick="resolveYouTubeChannel()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Finding...';

    try {
        // Step 1: Detect UC... ID directly
        const ucMatch = input.match(/UC[a-zA-Z0-9_-]{22}/);
        if (ucMatch) {
            const channelId = ucMatch[0];
            await finalizeResolution(channelId, "YouTube Channel (" + channelId.substring(0, 8) + "...)");
            return;
        }

        // Step 2: Handle handles (@name) or URLs
        const proxyUrl = "https://api.allorigins.win/get?url=";
        let targetUrl = input;
        
        if (!input.startsWith("http")) {
            targetUrl = input.startsWith("@") ? `https://www.youtube.com/${input}` : `https://www.youtube.com/@${input}`;
        }

        const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
        if (!response.ok) throw new Error("Proxy connection failed");
        
        const data = await response.json();
        const html = data.contents;
        if (!html) throw new Error("Could not fetch page contents");

        // Look for channelId in various possible places in the HTML
        const idMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]{22})"/ ) || html.match(/UC[a-zA-Z0-9_-]{22}/);
        
        if (idMatch) {
            const channelId = idMatch[1] || idMatch[0];
            const nameMatch = html.match(/<meta property="og:title" content="([^"]+)">/) || html.match(/<title>([^<]+) - YouTube<\/title>/);
            const channelName = nameMatch ? nameMatch[1] : `Channel ${channelId.substring(0, 6)}`;
            const thumbMatch = html.match(/<meta property="og:image" content="([^"]+)">/);
            const thumbnail = thumbMatch ? thumbMatch[1] : "";

            await finalizeResolution(channelId, channelName, thumbnail);
        } else {
            throw new Error("Could not find Channel ID in the page. Please use the full Channel URL.");
        }

    } catch (error) {
        console.error("Resolution error:", error);
        showToast("Error: " + error.message, "error");
        // Fallback: manually enter if it fails
        document.getElementById("btn-add-yt").disabled = false;
        document.getElementById("yt-channel-id").value = input;
        document.getElementById("yt-channel-name").value = "Manual Entry";
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
};

async function finalizeResolution(id, name, thumbnail = "") {
    document.getElementById("yt-channel-id").value = id;
    document.getElementById("yt-channel-name").value = name;
    
    // Show preview
    const infoDiv = document.getElementById("yt-resolved-info");
    const avatar = document.getElementById("yt-preview-avatar");
    const nameSpan = document.getElementById("yt-preview-name");
    const idSpan = document.getElementById("yt-preview-id");

    infoDiv.classList.remove("hidden");
    avatar.src = thumbnail || "https://www.gstatic.com/youtube/img/branding/youtubelogo/2x/youtube_logo_light_64.png";
    nameSpan.textContent = name;
    idSpan.textContent = id;

    // Enable add button
    document.getElementById("btn-add-yt").disabled = false;
    showToast(`Found channel: ${name}`, "success");
}

window.addYouTubeFeed = async function () {
    if (!currentGuildId) {
        showToast("Please select a server first", "error");
        return;
    }

    const channelId = document.getElementById("yt-channel-id").value.trim();
    const channelName = document.getElementById("yt-channel-name").value.trim();
    const discordChannel = document.getElementById("yt-discord-channel").value;
    const pingRole = document.getElementById("yt-ping-role").value;

    if (!channelId || !channelName) {
        showToast("Please resolve a channel first", "error");
        return;
    }

    if (!discordChannel) {
        showToast("Please select a Discord channel", "error");
        return;
    }

    const db = window.firebaseDb;

    try {
        await setDoc(doc(db, "guilds", currentGuildId, "youtube_feeds", channelId), {
            channel_id: channelId,
            channel_name: channelName,
            discord_channel_id: discordChannel,
            ping_role_id: pingRole || null,
            last_video_ids: [],
            added_at: new Date().toISOString(),
            added_by: "dashboard",
        }, { merge: true });

        showToast(`Added YouTube channel: ${channelName}`, "success");
        closeModal("youtube");
        clearForm("youtube");
        
        // Reset preview
        document.getElementById("yt-resolved-info").classList.add("hidden");
        document.getElementById("btn-add-yt").disabled = true;

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
    const discordChannel = document.getElementById("ig-discord-channel").value;
    const pingRole = document.getElementById("ig-ping-role").value;

    if (!rssUrl || !label) {
        showToast("RSS URL and Label are required", "error");
        return;
    }

    if (!discordChannel) {
        showToast("Please select a Discord channel", "error");
        return;
    }

    const safeLabel = label.toLowerCase().replace(/\s+/g, "_").replace(/\//g, "_").substring(0, 50);
    const db = window.firebaseDb;

    try {
        await setDoc(doc(db, "guilds", currentGuildId, "instagram_feeds", safeLabel), {
            rss_url: rssUrl,
            label: safeLabel,
            display_name: label,
            discord_channel_id: discordChannel,
            ping_role_id: pingRole || null,
            last_post_ids: [],
            added_at: new Date().toISOString(),
            added_by: "dashboard",
        }, { merge: true });

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
        document.getElementById("yt-input-search").value = "";
        document.getElementById("yt-channel-id").value = "";
        document.getElementById("yt-channel-name").value = "";
        document.getElementById("yt-discord-channel").value = "";
        document.getElementById("yt-ping-role").value = "";
        document.getElementById("yt-resolved-info").classList.add("hidden");
        document.getElementById("btn-add-yt").disabled = true;
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
