import { auth, db, onAuthStateChanged, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, deleteDoc, doc, limit, setDoc } from './firebase-config.js';

const ADMIN_EMAIL = "sajandahal794@gmail.com";
let isAdmin = false;

// ---------------------------
// Projects Feature (Dynamic)
// ---------------------------
const grid = document.getElementById('projects-grid');
const addProjectBtn = document.getElementById('add-project-btn');

// Modal Elements
const modal = document.getElementById('project-modal');
const modalSaveBtn = document.getElementById('modal-save');
const modalCancelBtn = document.getElementById('modal-cancel');
const modalFile = document.getElementById('modal-file');
const imagePreview = document.getElementById('image-preview');
const radioEmoji = document.querySelector('input[name="icon-type"][value="emoji"]');
const radioImage = document.querySelector('input[name="icon-type"][value="image"]');
const emojiGroup = document.getElementById('emoji-input-group');
const imageGroup = document.getElementById('image-input-group');

let currentBase64 = null;

// Check Auth & Render Admin UI
onAuthStateChanged(auth, (user) => {
    // Admin check logic reused
    const isUserAdmin = user && user.email === ADMIN_EMAIL;
    const adminControls = document.getElementById('admin-controls'); // Assuming this is for thoughts
    const addSectionBtn = document.getElementById('add-section-btn'); // Assuming this is for about sections

    if (addProjectBtn) {
        if (isUserAdmin) addProjectBtn.classList.remove('hidden');
        else addProjectBtn.classList.add('hidden');
    }

    if (adminControls) {
        if (isUserAdmin) adminControls.classList.remove('hidden');
        else adminControls.classList.add('hidden');
    }

    if (addSectionBtn) {
        if (isUserAdmin) addSectionBtn.classList.remove('hidden');
        else addSectionBtn.classList.add('hidden');
    }

    // Re-render components that might have admin-specific UI elements (like delete buttons)
    // We pass 'true' to indicate this is an update, not a fresh load, if needed.
    // But since onSnapshot is real-time, we just need to update the global isAdmin flag
    // and let the snapshot callbacks handle the rendering if they rely on isAdmin.

    // However, our render functions use the global 'isAdmin' variable which needs to be updated.
    isAdmin = isUserAdmin;

    // Force simple re-render of existing data if needed, but onSnapshot usually handles updates.
    // Ideally, we trigger a re-render or let the next snapshot update it.
    // For simplicity, we can just reload the fetches which will use the new isAdmin value.
    loadThoughts();
    renderProjects();
    // About section is loaded on view switch, but we can refresh it if valid
    if (typeof loadAboutSections !== 'undefined') {
        const aView = document.getElementById('about-view');
        if (aView && !aView.classList.contains('hidden')) {
            loadAboutSections();
        }
    }
});

// Render Projects (Fetch from Firestore)
function renderProjects() {
    if (!grid) return;

    // Real-time listener for projects
    const q = query(collection(db, "projects"), orderBy("createdAt", "desc"));

    onSnapshot(q, (snapshot) => {
        grid.innerHTML = '';
        if (snapshot.empty) {
            grid.innerHTML = '<p style="text-align:center; col-span:3; width:100%;">No projects yet.</p>';
        }

        snapshot.forEach((docSnap) => {
            renderProjectCard(docSnap.id, docSnap.data());
        });
    }, (error) => {
        console.error("Error loading projects:", error);
        if (error.code === 'permission-denied') {
            grid.innerHTML = '<p style="text-align:center; width:100%; color:#ff453a;">Content hidden. Please update Firebase Rules.</p>';
        }
    });
}

function renderProjectCard(id, data) {
    const card = document.createElement('div');
    card.className = 'card fade-in';
    card.id = `project-${id}`;

    let iconHtml = data.icon;
    // Check if icon is Base64 image
    if (data.icon && data.icon.startsWith('data:image')) {
        iconHtml = `<img src="${data.icon}" alt="icon">`;
    }

    let adminHtml = '';
    if (isAdmin) {
        // Store data in attribute for easy edit retrieval
        const jsonString = JSON.stringify(data).replace(/"/g, '&quot;');
        adminHtml = `
            <div class="project-admin-overlay">
                <button class="project-edit-btn" onclick="openEditModal('${id}', '${jsonString}')">✎</button>
                <button class="project-delete-btn" onclick="deleteProject('${id}')">🗑</button>
            </div>
        `;
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

    // Mouse Move Glow
    card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
    });
}

// Modal Logic
function openModal(isEdit = false, id = null, data = null) {
    modal.classList.remove('hidden');
    document.getElementById('modal-project-id').value = id || '';

    if (isEdit && data) {
        document.getElementById('modal-title').value = data.title;
        document.getElementById('modal-desc').value = data.description;
        document.getElementById('modal-link').value = data.link;

        if (data.icon && data.icon.startsWith('data:image')) {
            radioImage.checked = true;
            toggleIconInput('image');
            currentBase64 = data.icon;
            imagePreview.style.backgroundImage = `url(${data.icon})`;
            imagePreview.classList.remove('hidden');
        } else {
            radioEmoji.checked = true;
            toggleIconInput('emoji');
            document.getElementById('modal-emoji').value = data.icon;
            currentBase64 = null;
        }
    } else {
        // Clear Form
        document.getElementById('modal-title').value = '';
        document.getElementById('modal-desc').value = '';
        document.getElementById('modal-link').value = '';
        document.getElementById('modal-emoji').value = '';
        modalFile.value = '';
        imagePreview.classList.add('hidden');
        currentBase64 = null;
        radioEmoji.checked = true;
        toggleIconInput('emoji');
    }
}

function toggleIconInput(type) {
    if (type === 'emoji') {
        emojiGroup.classList.remove('hidden');
        imageGroup.classList.add('hidden');
    } else {
        emojiGroup.classList.add('hidden');
        imageGroup.classList.remove('hidden');
    }
}

if (addProjectBtn) {
    addProjectBtn.addEventListener('click', () => openModal(false));
}

if (modalCancelBtn) {
    modalCancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
}

if (radioEmoji) radioEmoji.addEventListener('change', () => toggleIconInput('emoji'));
if (radioImage) radioImage.addEventListener('change', () => toggleIconInput('image'));

// File Handling
if (modalFile) modalFile.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 100 * 1024) { // 100KB limit
        alert("Image too large! Please use an image under 100KB.");
        this.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        currentBase64 = e.target.result;
        imagePreview.style.backgroundImage = `url(${currentBase64})`;
        imagePreview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
});


// Save Logic
if (modalSaveBtn) modalSaveBtn.addEventListener('click', async () => {
    const id = document.getElementById('modal-project-id').value;
    const title = document.getElementById('modal-title').value.trim();
    const desc = document.getElementById('modal-desc').value.trim();
    const link = document.getElementById('modal-link').value.trim();
    const isImage = radioImage.checked;

    let icon = '🚀';
    if (isImage) {
        if (currentBase64) icon = currentBase64;
    } else {
        icon = document.getElementById('modal-emoji').value.trim() || '🚀';
    }

    if (!title) return alert("Title required");

    const projectData = {
        title, description: desc, link, icon
    };

    try {
        if (id) {
            // Update
            await setDoc(doc(db, "projects", id), projectData, { merge: true });
        } else {
            // Create
            projectData.createdAt = serverTimestamp();
            await addDoc(collection(db, "projects"), projectData);
        }
        modal.classList.add('hidden');
    } catch (e) {
        alert("Error saving: " + e.message);
        console.error(e);
    }
});


// Window Functions
window.deleteProject = async (id) => {
    if (!confirm("Delete this project?")) return;
    try {
        await deleteDoc(doc(db, "projects", id));
    } catch (e) { console.error(e); }
};

window.openEditModal = (id, jsonString) => {
    const data = JSON.parse(jsonString);
    openModal(true, id, data);
};

// Remove old editProject/saveProject functions that used inline inputs
window.editProject = undefined;
window.saveProject = undefined;

// Initialize is removed here as it's called in Auth Listener or View Switch logic
// But we can call it once for initial Guest view
renderProjects();

// ---------------------------
// Thoughts Feature (Bubble)
// ---------------------------

// Check Auth & Render Admin UI
onAuthStateChanged(auth, (user) => {
    const adminControls = document.getElementById('admin-controls');
    if (user && user.email === ADMIN_EMAIL) {
        isAdmin = true;
        if (adminControls) adminControls.classList.remove('hidden');
    } else {
        isAdmin = false;
        if (adminControls) adminControls.classList.add('hidden');
    }
    loadThoughts(); // Reload to show/hide delete buttons
});

// Load Thoughts
function loadThoughts() {
    const thoughtsFeed = document.getElementById('thoughts-feed');
    if (!thoughtsFeed) return;

    // Only get the latest thought for the bubble
    const q = query(collection(db, "thoughts"), orderBy("createdAt", "desc"), limit(1));

    onSnapshot(q, (snapshot) => {
        thoughtsFeed.innerHTML = '';
        if (snapshot.empty) {
            thoughtsFeed.innerHTML = '<span class="note-placeholder">No notes yet.</span>';
            return;
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;

            const note = document.createElement('div');
            note.className = 'note-content';

            let deleteHtml = '';
            // Use global isAdmin
            if (isAdmin) {
                deleteHtml = `<span class="note-delete" data-id="${id}">×</span>`;
            }

            note.innerHTML = `
                "${data.text}"
                ${deleteHtml}
            `;

            // Delete Listener
            const delBtn = note.querySelector('.note-delete');
            if (delBtn) {
                delBtn.addEventListener('click', () => deleteThought(id));
            }

            thoughtsFeed.appendChild(note);
        });
    }, (error) => {
        console.error("Error loading thoughts:", error);
    });
}

// Post Thought
const postThoughtBtn = document.getElementById('post-thought');
const thoughtInput = document.getElementById('thought-input');

if (postThoughtBtn) {
    postThoughtBtn.addEventListener('click', async () => {
        const text = thoughtInput.value.trim();
        if (!text) return;

        try {
            await addDoc(collection(db, "thoughts"), {
                text: text,
                createdAt: serverTimestamp(),
                author: ADMIN_EMAIL
            });
            thoughtInput.value = '';
            // Hide controls after posting to keep UI clean
            const adminControls = document.getElementById('admin-controls');
            if (adminControls) adminControls.classList.add('hidden');

        } catch (e) {
            console.error(e);
            alert("Error posting: " + e.message);
        }
    });

    // Toggle Admin Input visibility on click (optional interaction to keep it clean)
    // For now we'll leave it simple
}

// Delete Thought
async function deleteThought(id) {
    if (!confirm("Delete this note?")) return;
    try {
        await deleteDoc(doc(db, "thoughts", id));
    } catch (e) {
        alert("Delete failed");
    }
}

// Initialize
// Since this is a module (deferred), DOM is likely ready.
// Initialize
// Since this is a module (deferred), DOM is likely ready.
renderProjects();

// ---------------------------
// View Navigation
// ---------------------------
const navHome = document.getElementById('nav-home');
const navAbout = document.getElementById('nav-about');
const navProjects = document.getElementById('nav-projects'); // Special case
const homeView = document.getElementById('home-view');
const aboutView = document.getElementById('about-view');

function switchView(viewName) {
    if (viewName === 'home') {
        homeView.classList.remove('hidden');
        aboutView.classList.add('hidden');
        navHome.classList.add('active');
        navAbout.classList.remove('active');
    } else if (viewName === 'about') {
        homeView.classList.add('hidden');
        aboutView.classList.remove('hidden');
        navHome.classList.remove('active');
        navAbout.classList.add('active');
        loadAboutSections();
    }
}

if (navHome) navHome.addEventListener('click', (e) => {
    if (homeView && aboutView) {
        e.preventDefault();
        switchView('home');
    }
});
if (navAbout) navAbout.addEventListener('click', (e) => {
    if (homeView && aboutView) {
        e.preventDefault();
        switchView('about');
    }
});
// Ensure clicking "Projects" also shows home
if (navProjects) navProjects.addEventListener('click', () => {
    if (homeView && aboutView) {
        switchView('home');
    }
});


// ---------------------------
// Mobile Menu Toggle
// ---------------------------
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const notesContainer = document.getElementById('notes-container');

if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('open');
        navLinks.classList.toggle('active');

        // Toggle notes visibility
        if (notesContainer) {
            if (navLinks.classList.contains('active')) {
                notesContainer.classList.add('hidden');
            } else {
                notesContainer.classList.remove('hidden');
            }
        }
    });

    // Close menu when a link is clicked
    const links = navLinks.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('click', () => {
            menuToggle.classList.remove('open');
            navLinks.classList.remove('active');

            // Show notes again
            if (notesContainer) notesContainer.classList.remove('hidden');
        });
    });
}


// ---------------------------
// About Section (Dynamic + Admin)
// ---------------------------
const aboutContent = document.getElementById('about-content');
const addSectionBtn = document.getElementById('add-section-btn');

// Show Add Button if Admin
onAuthStateChanged(auth, (user) => {
    // Other admin checks (thoughts) are handled above
    if (user && user.email === ADMIN_EMAIL && addSectionBtn) {
        addSectionBtn.classList.remove('hidden');
    } else if (addSectionBtn) {
        addSectionBtn.classList.add('hidden');
    }
    // Refresh about if visible to update buttons
    if (aboutView && !aboutView.classList.contains('hidden')) loadAboutSections();
});

// Load Sections
function loadAboutSections() {
    if (!aboutContent) return;

    const q = query(collection(db, "about_sections"), orderBy("createdAt", "asc"));

    onSnapshot(q, (snapshot) => {
        aboutContent.innerHTML = '';
        snapshot.forEach((docSnap) => {
            renderAboutSection(docSnap.id, docSnap.data());
        });
    });
}

function renderAboutSection(id, data) {
    const section = document.createElement('div');
    section.className = 'about-section-card';
    section.id = `section-${id}`;

    // Admin Controls
    let adminHtml = '';
    if (isAdmin) {
        adminHtml = `
            <div class="admin-actions">
                <button class="edit-btn" onclick="toggleEdit('${id}')">Edit</button>
                <button class="delete-section-btn" onclick="deleteAboutSection('${id}')">Delete</button>
            </div>
        `;
    }

    // Items Loop
    let itemsHtml = data.items.map(item => `
        <div class="info-item">
            <span class="info-label">${item.label}</span>
            <span class="info-value">${item.value}</span>
        </div>
    `).join('');

    section.innerHTML = `
        <div class="section-title">
            <span>${data.title}</span>
            ${adminHtml}
        </div>
        <div class="info-grid" id="grid-${id}">
            ${itemsHtml}
        </div>
    `;

    aboutContent.appendChild(section);
}

// Add New Section
if (addSectionBtn) {
    addSectionBtn.addEventListener('click', async () => {
        const title = prompt("Enter Section Title (e.g. Education):");
        if (!title) return;

        try {
            await addDoc(collection(db, "about_sections"), {
                title: title,
                createdAt: serverTimestamp(),
                items: [
                    { label: "Label", value: "Value" } // Placeholder
                ]
            });
        } catch (e) { alert(e.message); }
    });
}

// Delete Section
window.deleteAboutSection = async (id) => {
    if (!confirm("Delete entire section?")) return;
    try { await deleteDoc(doc(db, "about_sections", id)); }
    catch (e) { console.error(e); }
};

// Edit Logic
window.toggleEdit = (id) => {
    const grid = document.getElementById(`grid-${id}`);
    const section = document.getElementById(`section-${id}`);

    // Check if already editing
    if (section.classList.contains('edit-mode')) return;
    section.classList.add('edit-mode');

    // Convert items to inputs
    const items = Array.from(grid.children);
    grid.innerHTML = ''; // Clear

    items.forEach(item => {
        const label = item.querySelector('.info-label').innerText;
        const value = item.querySelector('.info-value').innerText;
        addEditRow(grid, label, value);
    });

    // Add Row Button
    const addRowBtn = document.createElement('button');
    addRowBtn.className = 'add-row-btn';
    addRowBtn.innerText = "+ Add Row";
    addRowBtn.onclick = () => addEditRow(grid, "", "");
    section.appendChild(addRowBtn);

    // Save/Cancel Controls
    const controls = document.createElement('div');
    controls.className = 'section-controls';
    controls.innerHTML = `
        <button class="action-btn" style="background:#444;" onclick="loadAboutSections()">Cancel</button>
        <button class="action-btn" onclick="saveSection('${id}')">Save</button>
    `;
    section.appendChild(controls);
};

function addEditRow(container, labelVal, valueVal) {
    const row = document.createElement('div');
    row.className = 'info-item';
    row.innerHTML = `
        <input type="text" class="edit-label" style="width:100px;" value="${labelVal}" placeholder="Label">
        <input type="text" class="edit-value" style="flex:1;" value="${valueVal}" placeholder="Value">
        <button class="delete-btn" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(row);
}

window.saveSection = async (id) => {
    const section = document.getElementById(`section-${id}`);
    const rows = section.querySelectorAll('.info-item');

    const newItems = [];
    rows.forEach(row => {
        const label = row.querySelector('.edit-label').value.trim();
        const value = row.querySelector('.edit-value').value.trim();
        if (label || value) newItems.push({ label, value });
    });

    try {
        await setDoc(doc(db, "about_sections", id), {
            items: newItems
        }, { merge: true });

        // Refresh handled by snapshot
    } catch (e) {
        alert("Error saving: " + e.message);
        console.error(e);
    }
};

// Make functions global for inline onclicks
window.renderAboutSection = renderAboutSection;
