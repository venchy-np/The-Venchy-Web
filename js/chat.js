import { auth, db, GoogleAuthProvider, signInWithPopup, signInAnonymously, onAuthStateChanged, signOut, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, setDoc, doc, increment } from './firebase-config.js';

const ADMIN_EMAIL = "sajandahal794@gmail.com";

// DOM Elements
const authScreen = document.getElementById('auth-screen');
const chatScreen = document.getElementById('chat-screen');
const btnGoogle = document.getElementById('btn-google');
const btnGuest = document.getElementById('btn-guest');
const btnEmailLogin = document.getElementById('btn-email-login');
const btnEmailSignup = document.getElementById('btn-email-signup');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const displayNameInput = document.getElementById('display-name-input');
const btnLogout = document.getElementById('btn-logout');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const messagesContainer = document.getElementById('messages-container');

// Widget specific
const chatWidget = document.getElementById('chat-widget');
const chatFab = document.getElementById('chat-fab');
const closeChat = document.getElementById('close-chat');
const navChatTrigger = document.getElementById('nav-chat-trigger');
const btnAdminList = document.getElementById('btn-admin-list');
const adminSidebar = document.getElementById('admin-sidebar');
const closeSidebar = document.getElementById('close-sidebar');
const conversationList = document.getElementById('conversations-list');

let currentUser = null;
let currentChatId = null;
let unsubscribeMessages = null;

// Toggle Widget
function toggleChat(show) {
    if (show) {
        chatWidget.classList.remove('hidden');
        scrollToBottom();

        // Clear Unread Counts on Open
        if (currentUser) {
            const update = {};
            if (currentUser.email !== ADMIN_EMAIL) {
                // User opening: Clear their own unread count
                update.unreadCountUser = 0;
                chatFab.classList.remove('has-new');
                chatFab.removeAttribute('data-count');
            } else {
                // Admin opening: (Handled per chat in click? No, global FAB clear? 
                // Admin FAB shows TOTAL unread. 
                // Note: Admin reads specific chats, clearing that chat's count. 
                // The FAB will update automatically because it listens to the collection snapshot.)
            }
            if (Object.keys(update).length > 0) {
                setDoc(doc(db, "chats", currentUser.uid), update, { merge: true });
            }
        }
    } else {
        chatWidget.classList.add('hidden');
    }
}

if (chatFab) chatFab.addEventListener('click', () => toggleChat(!chatWidget.classList.contains('hidden') ? false : true));
if (closeChat) closeChat.addEventListener('click', () => toggleChat(false));
if (navChatTrigger) navChatTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    toggleChat(true);
});

// Admin Sidebar Toggle
if (btnAdminList) btnAdminList.addEventListener('click', () => {
    if (adminSidebar) adminSidebar.classList.remove('hidden');
    loadAllConversations();
});
if (closeSidebar) closeSidebar.addEventListener('click', () => adminSidebar.classList.add('hidden'));

// Auth Handlers (Google, Guest, Email)
if (btnGoogle) btnGoogle.addEventListener('click', async () => {
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { alert(e.message); }
});

if (btnGuest) btnGuest.addEventListener('click', async () => {
    try { await signInAnonymously(auth); }
    catch (e) { console.error(e); }
});

const loginForm = document.getElementById('login-form');

if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value;
        const password = passwordInput.value;

        // Basic validation handled by 'required' attribute but safety check here
        if (!email || !password) return alert("Enter email and password");

        try { await signInWithEmailAndPassword(auth, email, password); }
        catch (e) { alert(e.message); }
    });
}

// Remove old click listener for btnEmailLogin if it exists to avoid double firing (though type=submit handles it via form)
// btnEmailLogin.addEventListener('click', ... ) <- Removed

if (btnEmailSignup) btnEmailSignup.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    const name = displayNameInput.value.trim();

    if (!email || !password) return alert("Enter email and password");
    if (!name) {
        alert("Please enter a Display Name! It helps me know who you are.");
        displayNameInput.focus();
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Set display name immediately on the Auth object
        await updateProfile(userCredential.user, {
            displayName: name
        });

        // Force manual UI update because onAuthStateChanged might have fired already with null name
        if (navLoginBtn) navLoginBtn.textContent = name;

        // Also save to Firestore immediately to be safe
        await saveUserToFirestore(userCredential.user);
    }
    catch (e) { alert(e.message); }
});

if (btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

const navLoginBtn = document.getElementById('nav-login-btn');
const navDropdown = document.getElementById('nav-user-dropdown');
const navLogoutBtn = document.getElementById('nav-logout-btn');

// Toggle Dropdown
if (navLoginBtn) {
    // Only toggle if logged in (logic inside click handler below relies on state)
}

if (navLogoutBtn) {
    navLogoutBtn.addEventListener('click', async () => {
        await signOut(auth);
        alert("Logged out!");
        navDropdown.classList.add('hidden');
    });
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    if (navDropdown && !navDropdown.classList.contains('hidden')) {
        if (navLoginBtn && !navLoginBtn.contains(e.target) && !navDropdown.contains(e.target)) {
            navDropdown.classList.add('hidden');
        }
    }
});

// Helper to save user info to Firestore
async function saveUserToFirestore(user) {
    const customName = displayNameInput.value.trim();
    // If signing up/logging in, ensure we capture the name if provided

    // For Google/Social provider, displayName usually exists
    let finalName = customName || user.displayName || user.email || "Guest";

    if (!customName && !user.displayName && user.email) {
        finalName = user.email.split('@')[0];
    }

    await setDoc(doc(db, "chats", user.uid), {
        email: user.email || "Anonymous",
        lastSeen: serverTimestamp(),
        displayName: finalName
    }, { merge: true });

    return finalName;
}

// Helper to setup chat listener for a specific chatId
function setupChatListener(chatId) {
    currentChatId = chatId;
    loadMessages(chatId);
    // Update Chat title for user himself
    document.querySelector('.chat-widget-header h3').innerText = "Chatting as " + (currentUser.displayName || currentUser.email || "Guest").split('@')[0];
}

// Helper to setup admin listener
function setupAdminListener() {
    adminSidebar.classList.remove('hidden');
    loadAllConversations();
}

// Auth State
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // --- User is Signed In ---
        currentUser = user;
        console.log("User logged in:", user.uid);

        // 1. Immediate UI Updates
        if (authScreen) authScreen.classList.add('hidden');
        if (chatScreen) chatScreen.classList.remove('hidden');

        // Calculate name for UI immediately
        let uiName = user.displayName;
        if (!uiName && user.email) uiName = user.email.split('@')[0];
        if (!uiName) uiName = "User";

        // Update Nav Button (Show Name + Dropdown Toggle)
        if (navLoginBtn) {
            navLoginBtn.innerHTML = `${getAvatar(uiName)} ${uiName}`;
            navLoginBtn.onclick = (e) => {
                e.stopPropagation();
                if (navDropdown) navDropdown.classList.toggle('hidden');
                else window.location.href = "../index.html"; // Fallback if dropdown missing
            };
        }

        // 2. Setup Listeners
        const chatId = user.uid;
        if (messagesContainer) setupChatListener(chatId);

        // If Admin, setup admin listener
        if (user.email === ADMIN_EMAIL) {
            if (navChatTrigger) navChatTrigger.textContent = "Admin Chat";
            if (btnAdminList) {
                btnAdminList.classList.remove('hidden');
                setupAdminListener();
            }
        } else {
            if (navChatTrigger) navChatTrigger.textContent = "Chat with me";
            if (btnAdminList) btnAdminList.classList.add('hidden');
        }

        // 3. Background: Save user to Firestore (Non-blocking)
        try {
            await saveUserToFirestore(user);
        } catch (err) {
            console.error("Error saving user profile:", err);
        }

    } else {
        // --- User is Signed Out ---
        currentUser = null;
        console.log("No user logged in");

        if (authScreen) authScreen.classList.remove('hidden');
        if (chatScreen) chatScreen.classList.add('hidden');

        // Update Nav Button (Reset to Login)
        if (navLoginBtn) {
            navLoginBtn.textContent = "Login";
            navLoginBtn.onclick = () => {
                if (chatWidget) toggleChat(true); // Open widget to show auth screen
                else window.location.href = "../index.html"; // Redirect to home for login
            };
        }
        if (navDropdown) navDropdown.classList.add('hidden');

        // Hide admin specific elements
        if (btnAdminList) btnAdminList.classList.add('hidden');
        if (navChatTrigger) navChatTrigger.textContent = "Chat with me";

        // Clear chat state
        if (unsubscribeMessages) unsubscribeMessages();
        if (messagesContainer) {
            messagesContainer.innerHTML = '';
            currentChatId = null;
        }
        const headerH3 = document.querySelector('.chat-widget-header h3');
        if (headerH3) headerH3.innerText = "Chat with me";
    }
});

// Helper to Generate Avatar HTML
function getAvatar(name) {
    const initial = (name || "?").charAt(0).toUpperCase();
    const colors = ['#FF00FF', '#00FFFF', '#FF453A', '#FFD60A', '#30D158', '#0A84FF'];
    // Simple hash for consistent color
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const color = colors[Math.abs(hash) % colors.length];

    return `<div class="user-avatar" style="background:${color}">${initial}</div>`;
}

// Sending
if (messageForm) messageForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;
    if (!currentChatId) {
        console.error("No currentChatId, cannot send.");
        return;
    }

    try {
        // Clear input immediately for better UX
        messageInput.value = '';
        messageInput.focus();

        await addDoc(collection(db, "chats", currentChatId, "messages"), {
            text: text,
            senderId: currentUser.uid,
            createdAt: serverTimestamp(),
            status: 'sent' // Initial status
        });

        // Update last message & Increment Unread Count (if User sending)
        const updateData = {
            lastMessage: text,
            lastMessageTime: serverTimestamp()
        };

        // Unread Logic
        if (currentUser.email !== ADMIN_EMAIL) {
            // User sending to Admin
            updateData.hasUnread = true;
        } else {
            // Admin sending to User
            updateData.unreadByUser = true;
        }

        await setDoc(doc(db, "chats", currentChatId), updateData, { merge: true });

        scrollToBottom();
    } catch (err) {
        console.error("Error sending message:", err);
        alert("Failed to send: " + err.message);
    }
});

// Load Messages
let currentChatDocUnsubscribe = null; // Listener for the Chat Document itself (for Seen status)

function loadMessages(chatId) {
    if (unsubscribeMessages) unsubscribeMessages();
    if (currentChatDocUnsubscribe) currentChatDocUnsubscribe();
    messagesContainer.innerHTML = '';

    // 1. Listen to Messages
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt", "asc"));
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        messagesContainer.innerHTML = '';
        snapshot.forEach((doc) => {
            renderMessage(doc.data(), chatId);
        });
        setTimeout(scrollToBottom, 50);
    });

    // 2. Listen to Chat Document (For "Seen" status updates AND Unread Badge)
    // Only needed if I am the User
    if (currentUser.email !== ADMIN_EMAIL) {
        currentChatDocUnsubscribe = onSnapshot(doc(db, "chats", chatId), (docSnap) => {
            const data = docSnap.data();
            if (data) {
                // Check Seen Status
                if (data.adminLastSeen) {
                    window.currentAdminLastSeen = data.adminLastSeen;
                    updateMessageStatuses();
                }

                // Numeric Badge for User
                const count = data.unreadCountUser || 0;
                if (count > 0 && chatWidget.classList.contains('hidden')) {
                    chatFab.classList.add('has-new');
                    chatFab.setAttribute('data-count', count > 9 ? '9+' : count);
                } else {
                    chatFab.classList.remove('has-new');
                    chatFab.removeAttribute('data-count');

                    // If open, reset immediately
                    if (!chatWidget.classList.contains('hidden') && count > 0) {
                        setDoc(doc(db, "chats", chatId), { unreadCountUser: 0 }, { merge: true });
                    }
                }
            }
        });
    } else {
        // I Am Admin: When I open this logic, I should mark as Read
        setDoc(doc(db, "chats", chatId), {
            hasUnread: false,
            adminLastSeen: serverTimestamp()
        }, { merge: true });
    }
}

// Ensure opening chat clears user unread
const originalToggleChat = toggleChat;
// We need to modify toggleChat or specific listener
// Let's just modify the click handler or function earlier in file.
// Ideally, search for toggleChat definition.


function updateMessageStatuses() {
    const statusEls = document.querySelectorAll('.message-status');
    statusEls.forEach(el => {
        if (el.dataset.timestamp) {
            const msgTime = new Date(el.dataset.timestamp);
            const seenTime = window.currentAdminLastSeen ? window.currentAdminLastSeen.toDate() : null;
            if (seenTime && seenTime > msgTime) {
                el.textContent = "Seen";
            }
        }
    });
}

function renderMessage(msg, chatId) {
    const div = document.createElement('div');
    const isMe = msg.senderId === currentUser.uid;
    const type = isMe ? 'sent' : 'received';

    div.className = `message-bubble ${type}`;

    // Message Text
    div.textContent = msg.text;

    // Status (Only for my sent messages)
    if (isMe) {
        const statusDiv = document.createElement('div');
        statusDiv.className = 'message-status';
        let statusText = "Sent";

        // Check "Seen" logic
        if (msg.createdAt) {
            statusDiv.dataset.timestamp = msg.createdAt.toDate().toISOString();
            // Check against window.currentAdminLastSeen (if user)
            if (currentUser.email !== ADMIN_EMAIL && window.currentAdminLastSeen) {
                if (window.currentAdminLastSeen.toDate() > msg.createdAt.toDate()) {
                    statusText = "Seen";
                }
            }
        }
        statusDiv.textContent = statusText;
        div.appendChild(statusDiv);
    }

    messagesContainer.appendChild(div);
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Load Conversations (Admin)
function loadAllConversations() {
    const q = query(collection(db, "chats"), orderBy("lastMessageTime", "desc"));

    onSnapshot(q, (snapshot) => {
        conversationList.innerHTML = '';
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const chatId = docSnap.id;

            // Format Time
            let timeStr = "";
            if (data.lastMessageTime) {
                const date = data.lastMessageTime.toDate();
                const now = new Date();
                const diff = (now - date) / 1000; // seconds
                if (diff < 60) timeStr = "Just now";
                else if (diff < 3600) timeStr = `${Math.floor(diff / 60)}m ago`;
                else if (diff < 86400) timeStr = `${Math.floor(diff / 3600)}h ago`;
                else timeStr = `${Math.floor(diff / 86400)}d ago`;
            } else {
                timeStr = "New";
            }

            const item = document.createElement('div');
            item.className = 'convo-item';
            if (data.hasUnread) item.classList.add('unread'); // Highlight unread
            if (currentChatId === chatId) item.classList.add('active');

            const name = data.displayName || 'Anonymous';
            const avatarHtml = getAvatar(name);

            item.innerHTML = `
                <div class="convo-avatar">${avatarHtml}</div>
                <div class="convo-info">
                    <div class="convo-header" style="display:flex; justify-content:space-between; align-items:center;">
                        <div class="convo-name">${name}</div>
                        <div class="convo-time" style="font-size:0.75rem; color:#666;">${timeStr}</div>
                    </div>
                    <div class="convo-last-msg">${data.lastMessage || 'No messages'}</div>
                </div>
            `;

            item.addEventListener('click', () => {
                currentChatId = chatId;
                adminSidebar.classList.add('hidden');
                // Admin Read Logic happens in loadMessages
                document.querySelector('.chat-widget-header h3').innerText = name;
                loadMessages(chatId);
            });

            conversationList.appendChild(item);
        });
    });
}

