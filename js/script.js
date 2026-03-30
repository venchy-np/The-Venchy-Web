import { auth, db, onAuthStateChanged, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, limit, setDoc } from './firebase-config.js';

const ADMIN_EMAIL = "sajandahal794@gmail.com";
let isAdmin = false;

// ---------------------------
// Unified Auth & State Management
// ---------------------------
onAuthStateChanged(auth, (user) => {
    isAdmin = user && user.email === ADMIN_EMAIL;
    console.log("Auth State Changed. Is Admin:", isAdmin);

    // Global UI Admin Updates
    const adminControls = document.getElementById('admin-controls');
    const addSectionBtn = document.getElementById('add-section-btn');
    const addProjectBtn = document.getElementById('add-project-btn');
    const editTypewriterBtn = document.getElementById('edit-typewriter-btn');

    if (adminControls) adminControls.classList.toggle('hidden', !isAdmin);
    if (addSectionBtn) addSectionBtn.classList.toggle('hidden', !isAdmin);
    if (addProjectBtn) addProjectBtn.classList.toggle('hidden', !isAdmin);
    if (editTypewriterBtn) editTypewriterBtn.classList.toggle('hidden', !isAdmin);

    // Refresh Data
    renderProjects();
    loadThoughts();
});

// ---------------------------
// Projects Feature
// ---------------------------
const grid = document.getElementById('projects-grid');
function renderProjects() {
    if (!grid) return;
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));

    console.log("Fetching projects...");
    onSnapshot(q, (snapshot) => {
        grid.innerHTML = '';
        if (snapshot.empty) {
            grid.innerHTML = '<p style="text-align:center; width:100%; opacity:0.6;">No projects yet.</p>';
            return;
        }
        snapshot.forEach((docSnap) => renderProjectCard(docSnap.id, docSnap.data()));
    }, (error) => {
        console.error("Projects Load Error:", error);
        grid.innerHTML = `<p style="text-align:center; width:100%; color:#ff453a;">Failed to load projects. (Database Error)</p>`;
    });
}

function renderProjectCard(id, data) {
    const card = document.createElement('div');
    card.className = 'card fade-in';
    card.id = `project-${id}`;

    let iconHtml = data.icon;
    if (data.icon && data.icon.startsWith('data:image')) {
        iconHtml = `<img src="${data.icon}" alt="icon">`;
    }

    let adminHtml = '';
    if (isAdmin) {
        const jsonString = JSON.stringify(data).replace(/"/g, '&quot;');
        adminHtml = `
            <div class="project-admin-overlay">
                <button class="project-edit-btn" onclick="openEditModal('${id}', '${jsonString}')">✎</button>
                <button class="project-delete-btn" onclick="deleteProject('${id}')">🗑</button>
            </div>`;
    }

    card.innerHTML = `
        ${adminHtml}
        <div class="card-icon">${iconHtml || '🚀'}</div>
        <div class="card-content">
            <h3>${data.title}</h3>
            <p>${data.description}</p>
        </div>
        <a href="${data.link}" class="card-link" target="_blank">View Project</a>
    `;
    grid.appendChild(card);

    if (window.VanillaTilt) {
        VanillaTilt.init(card, { max: 10, speed: 400, glare: true, "max-glare": 0.1, scale: 1.02 });
    }

    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
        card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
}

// ---------------------------
// Typewriter Effect (Improved Robustness)
// ---------------------------
let defaultPhrases = ["Learning around...", "I just love listening to music🎶", "I will code greatness someday ✨"];
let phrases = [...defaultPhrases];
let phraseIndex = 0;
let charIndex = 0;
let isDeleting = false;
let typewriterStarted = false;

// Start Typewriter IMMEDIATELY
function startTypewriterOnce() {
    if (typewriterStarted) return;
    typewriterStarted = true;
    setTimeout(typeWriter, 1000);
}

// Initialize on Load
startTypewriterOnce();

// Sync from DB in background
onSnapshot(doc(db, "settings", "typewriter"), (docSnap) => {
    if (docSnap.exists() && docSnap.data().phrases && docSnap.data().phrases.length > 0) {
        phrases = docSnap.data().phrases;
        console.log("✅ Typewriter Phrases Synced from DB");
    }
}, (err) => {
    console.warn("⚠️ Firestore phrases blocked. Using defaults.", err);
});

function typeWriter() {
    const textDisplay = document.querySelector('.typewriter-text');
    if (!textDisplay) return;

    const currentPhrase = phrases[phraseIndex] || defaultPhrases[0];
    
    if (isDeleting) {
        textDisplay.innerHTML = currentPhrase.substring(0, charIndex - 1);
        charIndex--;
    } else {
        textDisplay.innerHTML = currentPhrase.substring(0, charIndex + 1);
        charIndex++;
    }

    let typeSpeed = isDeleting ? 40 : 100;
    if (!isDeleting && charIndex === currentPhrase.length) {
        typeSpeed = 2000;
        isDeleting = true;
    } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        typeSpeed = 500;
    }
    setTimeout(typeWriter, typeSpeed);
}

// ---------------------------
// Discord Presence
// ---------------------------
const DISCORD_USER_ID = "1042813122697756795";
async function fetchDiscordStatus() {
    try {
        const response = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`);
        if (!response.ok) return;
        const { data } = await response.json();
        const dot = document.getElementById('discord-status-dot');
        const text = document.getElementById('discord-status-text');
        if (!dot || !text) return;
        dot.className = 'status-dot ' + data.discord_status;
        let statusMsg = data.discord_status.charAt(0).toUpperCase() + data.discord_status.slice(1);
        if (data.discord_status === 'dnd') statusMsg = 'Do Not Disturb';
        let isHTML = false;
        if (data.activities && data.activities.length > 0) {
            const playing = data.activities.find(a => a.type === 0);
            const vscode = data.activities.find(a => a.name.includes('Visual Studio'));
            if (playing) {
                const name = playing.name;
                statusMsg = name.length > 14 ? `Playing: <marquee scrollamount="2" style="max-width: 70px; display: inline-block; vertical-align: bottom;">${name}</marquee>` : `Playing: ${name}`;
                isHTML = name.length > 14;
            } else if (vscode) {
                statusMsg = `Coding in VS Code`;
            } else if (data.listening_to_spotify) {
                const song = data.spotify.song;
                statusMsg = song.length > 14 ? `Listening: <marquee scrollamount="2" style="max-width: 70px; display: inline-block; vertical-align: bottom;">${song}</marquee>` : `Listening: ${song}`;
                isHTML = song.length > 14;
            }
        }
        if (isHTML) text.innerHTML = statusMsg;
        else text.innerText = statusMsg;
        text.classList.remove('hidden');
    } catch (e) { console.error("Discord Load Error:", e); }
}
fetchDiscordStatus();
setInterval(fetchDiscordStatus, 15000);

// ---------------------------
// Thoughts Feature
// ---------------------------
function loadThoughts() {
    const thoughtsFeed = document.getElementById('thoughts-feed');
    if (!thoughtsFeed) return;
    const q = query(collection(db, "thoughts"), orderBy("createdAt", "desc"), limit(1));
    onSnapshot(q, (snapshot) => {
        thoughtsFeed.innerHTML = '';
        if (snapshot.empty) return;
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const note = document.createElement('div');
            note.className = 'note-content';
            let del = isAdmin ? `<span class="note-delete" onclick="deleteThought('${id}')">×</span>` : '';
            note.innerHTML = `"${data.text}" ${del}`;
            thoughtsFeed.appendChild(note);
        });
    });
}
window.deleteThought = async (id) => {
    if (confirm("Delete this note?")) await deleteDoc(doc(db, "thoughts", id));
};

// ---------------------------
// Admin Modals
// ---------------------------
const modal = document.getElementById('project-modal');
const typewriterModal = document.getElementById('typewriter-modal');
const phrasesList = document.getElementById('typewriter-phrases-list');

window.openEditModal = (id, jsonString) => openModal(true, id, JSON.parse(jsonString));
function openModal(isEdit = false, id = null, data = null) {
    modal.classList.remove('hidden');
    document.getElementById('modal-project-id').value = id || '';
    const modalFile = document.getElementById('modal-file');
    const imagePreview = document.getElementById('image-preview');
    const radioEmoji = document.querySelector('input[name="icon-type"][value="emoji"]');
    const radioImage = document.querySelector('input[name="icon-type"][value="image"]');
    const emojiGroup = document.getElementById('emoji-input-group');
    const imageGroup = document.getElementById('image-input-group');

    if (isEdit && data) {
        document.getElementById('modal-title').value = data.title;
        document.getElementById('modal-desc').value = data.description;
        document.getElementById('modal-link').value = data.link;
        if (data.icon && data.icon.startsWith('data:image')) {
            radioImage.checked = true; emojiGroup.classList.add('hidden'); imageGroup.classList.remove('hidden');
            imagePreview.style.backgroundImage = `url(${data.icon})`; imagePreview.classList.remove('hidden');
        } else {
            radioEmoji.checked = true; emojiGroup.classList.remove('hidden'); imageGroup.classList.add('hidden');
            document.getElementById('modal-emoji').value = data.icon;
        }
    } else {
        document.getElementById('modal-title').value = '';
        document.getElementById('modal-desc').value = '';
        document.getElementById('modal-link').value = '';
        document.getElementById('modal-emoji').value = '';
        modalFile.value = ''; imagePreview.classList.add('hidden');
        radioEmoji.checked = true; emojiGroup.classList.remove('hidden'); imageGroup.classList.add('hidden');
    }
}

document.getElementById('modal-save')?.addEventListener('click', async () => {
    const id = document.getElementById('modal-project-id').value;
    const title = document.getElementById('modal-title').value.trim();
    if (!title) return alert("Title required");
    let icon = document.getElementById('modal-emoji').value.trim() || '🚀';
    
    // Check for image preview (currentBase64 would be here)
    const data = {
        title, description: document.getElementById('modal-desc').value.trim(),
        link: document.getElementById('modal-link').value.trim(),
        icon: icon
    };
    if (id) await setDoc(doc(db, "projects", id), data, { merge: true });
    else await addDoc(collection(db, "projects"), { ...data, createdAt: serverTimestamp() });
    modal.classList.add('hidden');
});
document.getElementById('modal-cancel')?.addEventListener('click', () => modal.classList.add('hidden'));

// Typewriter Admin
document.getElementById('edit-typewriter-btn')?.addEventListener('click', () => {
    phrasesList.innerHTML = '';
    phrases.forEach(p => addPhraseInputRow(p));
    typewriterModal.classList.remove('hidden');
});
document.getElementById('typewriter-cancel')?.addEventListener('click', () => typewriterModal.classList.add('hidden'));
document.getElementById('add-phrase-btn')?.addEventListener('click', () => addPhraseInputRow(""));
function addPhraseInputRow(val) {
    const row = document.createElement('div'); row.className = 'info-item';
    row.innerHTML = `<input type="text" class="phrase-input" style="flex:1; background:transparent; color:#fff; border:1px solid #444; padding:5px; border-radius:5px;" value="${val}"> <button onclick="this.parentElement.remove()" style="background:none; border:none; color:#ff453a; cursor:pointer;">×</button>`;
    phrasesList.appendChild(row);
}
document.getElementById('typewriter-save')?.addEventListener('click', async () => {
    try {
        const newPhrases = Array.from(phrasesList.querySelectorAll('.phrase-input'))
            .map(i => i.value.trim())
            .filter(v => v);
        
        if (newPhrases.length > 0) {
            const btn = document.getElementById('typewriter-save');
            const originalText = btn.innerText;
            btn.innerText = "Saving...";
            
            await setDoc(doc(db, "settings", "typewriter"), { phrases: newPhrases }, { merge: true });
            
            btn.innerText = originalText;
            typewriterModal.classList.add('hidden');
        } else {
            alert("Please add at least one phrase!");
        }
    } catch (e) {
        console.error("Error saving phrases:", e);
        alert("Error saving phrases: " + e.message);
    }
});

// ---------------------------
// Views & Cursor
// ---------------------------
const curDot = document.getElementById("cursor-dot");
const curOutline = document.getElementById("cursor-outline");
if (curDot && window.matchMedia("(pointer: fine)").matches) {
    let curX = 0, curY = 0, outX = 0, outY = 0;
    window.addEventListener("mousemove", (e) => {
        curX = e.clientX; curY = e.clientY;
        curDot.style.left = curX + "px"; curDot.style.top = curY + "px";
    });
    function animate() {
        outX += (curX - outX) * 0.15; outY += (curY - outY) * 0.15;
        curOutline.style.left = outX + "px"; curOutline.style.top = outY + "px";
        requestAnimationFrame(animate);
    }
    animate();
    document.addEventListener("mouseover", (e) => { if (e.target.closest('a, button, .card')) curOutline.classList.add("hover-state"); });
    document.addEventListener("mouseout", (e) => { if (e.target.closest('a, button, .card')) curOutline.classList.remove("hover-state"); });
    document.addEventListener("mouseleave", () => { curDot.style.opacity = '0'; curOutline.style.opacity = '0'; });
    document.addEventListener("mouseenter", () => { curDot.style.opacity = '1'; curOutline.style.opacity = '1'; });
}

const hView = document.getElementById('home-view');
const aView = document.getElementById('about-view');
function switchView(v) {
    hView.classList.toggle('hidden', v !== 'home'); aView.classList.toggle('hidden', v !== 'about');
    document.getElementById('nav-home').classList.toggle('active', v === 'home');
    document.getElementById('nav-about').classList.toggle('active', v === 'about');
}
document.getElementById('nav-home').addEventListener('click', (e) => { e.preventDefault(); switchView('home'); });
document.getElementById('nav-about').addEventListener('click', (e) => { e.preventDefault(); switchView('about'); });
document.getElementById('nav-projects').addEventListener('click', () => switchView('home'));

// Mobile menu toggle
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');

if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        menuToggle.classList.toggle('open');
    });

    // Close menu when clicking a link
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            menuToggle.classList.remove('open');
        });
    });
}
