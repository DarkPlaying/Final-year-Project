// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyBKFjGmeykAc4Ck9zDrKz745yZQyqGC8y8",
    authDomain: "education-ai-af34e.firebaseapp.com",
    projectId: "education-ai-af34e",
    storageBucket: "education-ai-af34e.firebasestorage.app",
    messagingSenderId: "815335775209",
    appId: "1:815335775209:web:6c0bc09a99447a0f28c978"
};

const STUDENT_SESSION_DURATION = 5 * 60 * 60 * 1000; // 5 hours
const SESSION_VALIDATION_INTERVAL = 30 * 1000; // 30 seconds
let studentSessionInterval = null;
let studentValidationInterval = null;
let studentStorageListenerAttached = false;
let studentIsLoggingOut = false;

function generateSessionId() {
    if (window.crypto && window.crypto.getRandomValues) {
        const arr = new Uint32Array(2);
        window.crypto.getRandomValues(arr);
        return `sess-${Date.now()}-${arr[0].toString(16)}${arr[1].toString(16)}`;
    }
    return `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getStudentTabSessionId() {
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
        const stored = localStorage.getItem('sessionId');
        if (stored) {
            sessionStorage.setItem('sessionId', stored);
            sessionId = stored;
        }
    }
    return sessionId;
}

// Initialize Firebase
if (typeof firebase === 'undefined') {
    console.error('Firebase SDK not loaded');
} else {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    window.db = firebase.firestore();

    // Initialize secondary app for reading attendance (finalyear)
    try {
        const attendanceApp = firebase.initializeApp({
            apiKey: "AIzaSyB55WahdjeEhDS4l7P3rdKaygheBePVXPM",
            authDomain: "finalyear-b56e7.firebaseapp.com",
            projectId: "finalyear-b56e7",
            storageBucket: "finalyear-b56e7.firebasestorage.app",
            messagingSenderId: "966172443396",
            appId: "1:966172443396:web:f24adcd0b13e738267c651"
        }, 'attendance');
        window.dbAttendance = attendanceApp.firestore();
        console.log('✅ Dual Firebase initialized for student: Reading from education-ai, Reading attendance from finalyear');
    } catch (e) {
        console.warn('Attendance app may already exist', e);
        try {
            const attendanceApp = firebase.app('attendance');
            window.dbAttendance = attendanceApp.firestore();
        } catch (e2) {
            console.error('Failed to get attendance app', e2);
        }
    }

    checkAuth();
}

function ensureStudentSession() {
    let expiry = Number(localStorage.getItem('loginExpiresAt'));
    if (!expiry || Number.isNaN(expiry)) {
        expiry = Date.now() + STUDENT_SESSION_DURATION;
        localStorage.setItem('loginExpiresAt', String(expiry));
    }
    if (Date.now() > expiry) {
        alert('Session expired. Please log in again.');
        logout();
        return null;
    }
    return expiry;
}

function initStudentSessionCountdown(expiryTimestamp) {
    const countdownEl = document.getElementById('studentSessionCountdown');
    if (!countdownEl) return;
    if (studentSessionInterval) clearInterval(studentSessionInterval);

    const updateCountdown = () => {
        const remaining = expiryTimestamp - Date.now();
        if (remaining <= 0) {
            countdownEl.textContent = 'Session expired';
            logout();
            return;
        }
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
        const pad = (num) => String(num).padStart(2, '0');
        countdownEl.textContent = `Session expires in ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    };

    updateCountdown();
    studentSessionInterval = setInterval(updateCountdown, 1000);
}

async function validateStudentActiveSession(showAlert = true) {
    const userId = localStorage.getItem('userId');
    const localSessionId = getStudentTabSessionId();
    if (!userId || !localSessionId) {
        if (showAlert) alert('Session invalid. Please log in again.');
        await logout();
        return false;
    }
    try {
        const doc = await db.collection('users').doc(userId).get();
        if (!doc.exists) {
            if (showAlert) alert('User record missing. Please log in again.');
            await logout();
            return false;
        }
        const data = doc.data() || {};
        if ((data.activeSessionId || '') !== localSessionId) {
            if (showAlert) alert('You have been signed out because your account was accessed elsewhere.');
            await logout();
            return false;
        }
        return true;
    } catch (err) {
        console.error('Session validation failed:', err);
        if (showAlert) alert('Session validation failed. Please log in again.');
        await logout();
        return false;
    }
}

function startStudentSessionWatcher() {
    if (studentValidationInterval) clearInterval(studentValidationInterval);
    studentValidationInterval = setInterval(() => {
        validateStudentActiveSession(false);
    }, SESSION_VALIDATION_INTERVAL);

    if (!studentStorageListenerAttached) {
        studentStorageListenerAttached = true;
        window.addEventListener('storage', (event) => {
            if (event.key === 'sessionId') {
                const tabSessionId = getStudentTabSessionId();
                const globalSessionId = localStorage.getItem('sessionId');
                if (tabSessionId && globalSessionId && tabSessionId !== globalSessionId) {
                    alert('You have been signed out because your account was accessed elsewhere.');
                    logout();
                    return;
                }
                validateStudentActiveSession();
            }
            if (event.key === 'loginExpiresAt' && event.newValue) {
                ensureStudentSession();
            }
        });
    }
}

async function checkAuth() {
    const userEmail = localStorage.getItem('userEmail');
    const userRole = localStorage.getItem('userRole');

    if (!userEmail || userRole !== 'student') {
        window.location.href = window.location.origin + '/login.html';
        return;
    }

    // Check maintenance mode (from maintenance-check.js)
    if (typeof checkMaintenanceMode === 'function') {
        const maintenanceActive = await checkMaintenanceMode(window.db, userRole);
        if (maintenanceActive) {
            // Maintenance mode is on - user will see countdown modal and be force logged out
            return;
        }
    }

    const expiryTimestamp = ensureStudentSession();
    if (!expiryTimestamp) return;
    const userId = localStorage.getItem('userId');
    if (!sessionStorage.getItem('sessionId')) {
        const newSessionId = generateSessionId();
        sessionStorage.setItem('sessionId', newSessionId);
        localStorage.setItem('sessionId', newSessionId);
        if (userId && window.db) {
            try {
                await db.collection('users').doc(userId).update({
                    activeSessionId: newSessionId,
                    activeSessionTimestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            } catch (err) {
                console.error('Failed to claim student session', err);
            }
        }
    }
    const valid = await validateStudentActiveSession();
    if (!valid) return;
    initStudentSessionCountdown(expiryTimestamp);
    startStudentSessionWatcher();

    // Start maintenance mode listener (from maintenance-check.js)
    if (typeof startMaintenanceListener === 'function') {
        startMaintenanceListener(window.db, userRole);
    }

    const nameEl = document.getElementById('studentName');
    if (nameEl) {
        nameEl.textContent = userEmail.split('@')[0];
    }
    loadDashboardData();
    // Load marks, attendance, and announcements when dashboard is ready
    if (typeof loadStudentMarks === 'function') loadStudentMarks();
    if (typeof loadStudentAnnouncements === 'function') loadStudentAnnouncements();
}

async function clearStudentBackendSession() {
    try {
        if (!window.db) return;
        const userId = localStorage.getItem('userId');
        const localSessionId = getStudentTabSessionId();
        if (!userId || !localSessionId) return;
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();
        if (doc.exists) {
            const data = doc.data() || {};
            if ((data.activeSessionId || '') === localSessionId) {
                await userRef.update({
                    activeSessionId: firebase.firestore.FieldValue.delete()
                });
            }
        }
    } catch (err) {
        console.warn('Failed to clear student backend session', err);
    }
}

async function logout(skipRedirect = false) {
    if (studentIsLoggingOut) return;
    studentIsLoggingOut = true;
    try {
        if (studentSessionInterval) {
            clearInterval(studentSessionInterval);
            studentSessionInterval = null;
        }
        if (studentValidationInterval) {
            clearInterval(studentValidationInterval);
            studentValidationInterval = null;
        }
        await clearStudentBackendSession();
    } finally {
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userId');
        localStorage.removeItem('loginExpiresAt');
        localStorage.removeItem('sessionId');
        sessionStorage.removeItem('sessionId');
        if (!skipRedirect) {
            window.location.href = window.location.origin + '/login.html';
        } else {
            studentIsLoggingOut = false;
        }
    }
}

window.addEventListener('beforeunload', (e) => {
    if (!studentIsLoggingOut) {
        e.preventDefault();
        e.returnValue = '';
        return '';
    }
});

window.addEventListener('unload', () => {
    if (!studentIsLoggingOut) {
        clearStudentBackendSession();
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userId');
        localStorage.removeItem('loginExpiresAt');
        localStorage.removeItem('sessionId');
    }
});

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, function (s) {
        return ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": "&#39;"
        })[s];
    });
}

async function loadDashboardData() {
    console.log('Loading dashboard data...');
    try {
        await Promise.all([
            fetchStudentExams(),
            fetchStudentSyllabus(),
            fetchStudentAssignments(),
            fetchTeachersForDropdown()
        ]);
    } catch (error) {
        console.error("Error loading dashboard data:", error);
    }
}

// Refresh function for student dashboard
async function refreshStudentDashboard() {
    const btn = document.getElementById('studentRefreshBtn');
    if (btn) {
        btn.disabled = true;
        btn.textContent = 'Refreshing...';
    }

    try {
        await loadDashboardData();
        if (typeof loadStudentMarks === 'function') await loadStudentMarks();
        if (typeof loadStudentAnnouncements === 'function') await loadStudentAnnouncements();

        if (btn) {
            btn.textContent = '✓ Refreshed!';
            setTimeout(() => {
                btn.textContent = 'Refresh';
                btn.disabled = false;
            }, 2000);
        }
    } catch (error) {
        console.error('Refresh failed:', error);
        if (btn) {
            btn.textContent = 'Refresh Failed';
            setTimeout(() => {
                btn.textContent = 'Refresh';
                btn.disabled = false;
            }, 2000);
        }
    }
}


async function fetchStudentExams() {
    const userEmail = localStorage.getItem('userEmail');
    const listEl = document.getElementById('examList');
    if (!userEmail || !listEl) return;

    try {
        const snapshot = await db.collection('exams')
            .where('students', 'array-contains', userEmail)
            .get();

        const countEl = document.getElementById('testSheetsCount');
        if (countEl) countEl.textContent = snapshot.size;

        listEl.innerHTML = '';

        if (snapshot.empty) {
            listEl.innerHTML = '<div class="muted">No exams assigned to you yet.</div>';
            return;
        }

        // Client-side sort
        const docs = snapshot.docs.map(doc => doc.data());
        docs.sort((a, b) => {
            const tA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(0);
            const tB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(0);
            return tB - tA;
        });

        docs.forEach(data => {
            const title = data.title || 'Untitled Exam';
            const description = data.description || '';
            const duration = data.duration || data.time || '';
            const driveLink = data.driveLink || data.url || '';
            const createdAt = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString() : '';

            const item = document.createElement('div');
            item.className = 'syllabus-row-card'; // Reusing the card style

            const titleEsc = escapeHtml(title);
            const descEsc = escapeHtml(description);
            const durationEsc = escapeHtml(duration);
            const createdEsc = escapeHtml(createdAt);
            const driveEsc = escapeHtml(driveLink);

            item.innerHTML = `
                <div class="syllabus-left">
                    <span class="syllabus-icon">📝</span>
                    <div>
                        <div class="syllabus-title">${titleEsc}</div>
                        <div class="syllabus-desc" style="color:#9fb3d6;font-size:0.9em;margin:2px 0 6px 0;">${descEsc}</div>
                        <div class="syllabus-meta">${durationEsc ? 'Duration: ' + durationEsc + ' • ' : ''}Posted: ${createdEsc}</div>
                    </div>
                </div>
                <div class="syllabus-actions">
                    ${driveLink ? `<button class="syllabus-btn open-btn" onclick="window.open('${driveEsc}','_blank')">Take Exam</button>` : ''}
                </div>
            `;
            listEl.appendChild(item);
        });

    } catch (error) {
        console.error("Error fetching exams:", error);
        listEl.innerHTML = `<div class="muted" style="color: #ef4444;">Failed to load exams: ${escapeHtml(error.message)}</div>`;
    }
}

async function fetchStudentSyllabus() {
    const userEmail = localStorage.getItem('userEmail');
    const listEl = document.getElementById('syllabusList');
    if (!userEmail || !listEl) return;

    try {
        const snapshot = await db.collection('syllabi')
            .where('students', 'array-contains', userEmail)
            .get();

        const countEl = document.getElementById('syllabusCount');
        if (countEl) countEl.textContent = snapshot.size;

        listEl.innerHTML = '';

        if (snapshot.empty) {
            listEl.innerHTML = '<div class="muted">No syllabus assigned to you yet.</div>';
            return;
        }

        // Client-side sort
        const docs = snapshot.docs.map(doc => doc.data());
        docs.sort((a, b) => {
            const tA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(0);
            const tB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(0);
            return tB - tA;
        });

        docs.forEach(data => {
            const name = data.name || data.title || 'Untitled';
            const units = Array.isArray(data.units) ? data.units.join(', ') : (data.units || '');
            const driveLink = data.driveLink || data.url || '';
            const createdAt = data.createdAt && data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString() : '';

            const item = document.createElement('div');
            item.className = 'syllabus-row-card';

            const nameEsc = escapeHtml(name);
            const unitsEsc = escapeHtml(units);
            const createdEsc = escapeHtml(createdAt);
            const driveEsc = escapeHtml(driveLink);

            item.innerHTML = `
                <div class="syllabus-left">
                    <span class="syllabus-icon">📄</span>
                    <div>
                        <div class="syllabus-title">${nameEsc}</div>
                        ${unitsEsc ? `<div class="syllabus-units">${unitsEsc}</div>` : ''}
                        <div class="syllabus-meta">Posted: ${createdEsc}</div>
                    </div>
                </div>
                <div class="syllabus-actions">
                    ${driveLink ? `<button class="syllabus-btn open-btn" onclick="window.open('${driveEsc}','_blank')">View</button>` : ''}
                </div>
            `;
            listEl.appendChild(item);
        });

    } catch (error) {
        console.error("Error fetching syllabus:", error);
        listEl.innerHTML = `<div class="muted" style="color: #ef4444;">Failed to load syllabus: ${escapeHtml(error.message)}</div>`;
    }
}

async function fetchStudentAssignments() {
    const userEmail = localStorage.getItem('userEmail');
    const listEl = document.getElementById('submittedAssignmentsList');
    if (!userEmail || !listEl) return;

    try {
        const snapshot = await db.collection('submissions')
            .where('studentEmail', '==', userEmail)
            .get();

        const countEl = document.getElementById('assignmentsCount');
        if (countEl) countEl.textContent = snapshot.size;

        listEl.innerHTML = '';

        if (snapshot.empty) {
            listEl.innerHTML = '<div class="students-empty" id="noSubmissionsPlaceholder">No submissions yet.</div>';
            return;
        }

        // Client-side sort
        const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        docs.sort((a, b) => {
            const getTime = (d) => {
                if (!d) return new Date(); // Pending write = now
                if (typeof d.toDate === 'function') return d.toDate();
                if (d.seconds) return new Date(d.seconds * 1000);
                return new Date(d);
            };
            return getTime(b.createdAt) - getTime(a.createdAt);
        });

        docs.forEach(data => {
            const title = data.assignmentTitle || data.title || 'Untitled Assignment';
            const comments = data.comments || '';
            const driveLink = data.driveLink || data.url || '';
            const status = data.status || 'pending';

            let createdAt = 'Just now';
            if (data.createdAt) {
                if (typeof data.createdAt.toDate === 'function') {
                    createdAt = data.createdAt.toDate().toLocaleString();
                } else if (data.createdAt.seconds) {
                    createdAt = new Date(data.createdAt.seconds * 1000).toLocaleString();
                } else {
                    createdAt = new Date(data.createdAt).toLocaleString();
                }
            }

            const id = data.id;

            const item = document.createElement('div');
            item.className = 'syllabus-row-card';

            const titleEsc = escapeHtml(title);
            const commentsEsc = escapeHtml(comments);
            const statusEsc = escapeHtml(status);
            const createdEsc = escapeHtml(createdAt);
            const driveEsc = escapeHtml(driveLink);

            // Status badge color
            let statusColor = '#f59e0b'; // pending - orange
            if (status === 'Mark Given') statusColor = '#10b981'; // green
            if (status === 'retracted') statusColor = '#ef4444'; // red

            item.innerHTML = `
                <div class="syllabus-left">
                    <span class="syllabus-icon">📤</span>
                    <div>
                        <div class="syllabus-title">${titleEsc} <span style="font-size:0.8em; background:${statusColor}20; color:${statusColor}; padding:2px 6px; border-radius:4px; margin-left:8px;">${statusEsc}</span></div>
                        <div class="syllabus-desc" style="color:#9fb3d6;font-size:0.9em;margin:2px 0 6px 0;">${commentsEsc}</div>
                        <div class="syllabus-meta">Submitted: ${createdEsc}</div>
                    </div>
                </div>
                <div class="syllabus-actions">
                    ${driveLink ? `<button class="syllabus-btn open-btn" onclick="window.open('${driveEsc}','_blank')">View</button>` : ''}
                    <button class="syllabus-btn" style="background-color:#f97316;color:#fff;margin-left:5px;" ${status === 'retracted' ? 'disabled title="Already retracted"' : `onclick="undoSubmission('${id}')"`}>
                        ${status === 'retracted' ? 'Retracted' : 'Undo'}
                    </button>
                </div>
            `;
            listEl.appendChild(item);
        });

    } catch (error) {
        console.error("Error fetching assignments:", error);
        listEl.innerHTML = `<div class="muted" style="color: #ef4444;">Failed to load assignments: ${escapeHtml(error.message)}</div>`;
    }
}

async function undoSubmission(id) {
    if (!window.db) return;
    try {
        const docRef = db.collection('submissions').doc(id);
        const snap = await docRef.get();
        if (!snap.exists) {
            alert('Submission not found.');
            return;
        }
        const data = snap.data() || {};
        if (data.status === 'retracted') {
            alert('Submission has already been retracted.');
            return;
        }
        const confirmMsg = data.status === 'graded'
            ? 'This submission already has marks. Retracting it will remove it from review workflows. Continue?'
            : 'Retract this submission?';
        if (!confirm(confirmMsg)) return;
        await docRef.update({
            status: 'retracted',
            retractedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('Submission retracted successfully.');
        fetchStudentAssignments();
    } catch (error) {
        console.error('Error retracting submission:', error);
        alert('Failed to retract submission: ' + error.message);
    }
}

// Section switching
function showSection(sectionName) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const el = document.getElementById(sectionName);
    if (el) el.classList.add('active');

    // Update nav active state
    const navLinks = document.querySelectorAll('.nav-item');
    navLinks.forEach(link => {
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(sectionName)) {
            link.classList.add('active');
        }
    });

    // Load data when switching to specific sections
    if (sectionName === 'viewMarks' && typeof loadStudentMarks === 'function') {
        loadStudentMarks();
    } else if (sectionName === 'announcements' && typeof loadStudentAnnouncements === 'function') {
        loadStudentAnnouncements();
    }
}

async function fetchTeachersForDropdown() {
    const userEmail = localStorage.getItem('userEmail');
    const selectEl = document.getElementById('teacherSelectDropdown');
    if (!userEmail || !selectEl) return;

    try {
        // Find workspaces where this student is a member
        const snapshot = await db.collection('workspaces')
            .where('students', 'array-contains', userEmail)
            .get();

        const teachersSet = new Set();

        snapshot.docs.forEach(doc => {
            const data = doc.data();
            if (Array.isArray(data.teachers)) {
                data.teachers.forEach(t => teachersSet.add(t));
            }
            //Also add admin if they are a teacher
            if (data.adminEmail) {
                teachersSet.add(data.adminEmail);
            }
        });

        selectEl.innerHTML = '<option value="">Select Teacher</option>';

        if (teachersSet.size === 0) {
            const opt = document.createElement('option');
            opt.text = "No teachers found in your workspaces";
            selectEl.appendChild(opt);
            return;
        }

        teachersSet.forEach(email => {
            const opt = document.createElement('option');
            opt.value = email;
            opt.textContent = email;
            selectEl.appendChild(opt);
        });

    } catch (error) {
        console.error("Error fetching teachers:", error);
        selectEl.innerHTML = '<option value="">Error loading teachers</option>';
    }
}

// Google Drive Configuration
const CLIENT_ID = '815335775209-mkgtp7o17o48e5ul7lmgn4uljko3e8ag.apps.googleusercontent.com';
const DRIVE_FOLDER_ID = '1l7eC3pUZIdlzfp5wp1hfgWZjj_p-m2gc';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
let accessToken = null;
let tokenClient = null;
let currentFileUrl = null;

// Assignment Submission Logic with Google Drive
document.addEventListener('DOMContentLoaded', () => {
    const authBtn = document.getElementById('authBtn');
    const submitBtn = document.getElementById('submitAssignmentBtn');
    const sendBtn = document.getElementById('sendToTeacherBtn');
    const fileInput = document.getElementById('assignmentFile');
    const msgEl = document.getElementById('submitAssignmentMessage');

    // Google Auth Button Handler
    if (authBtn) {
        authBtn.addEventListener('click', () => {
            if (!tokenClient) {
                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (tokenResponse) => {
                        accessToken = tokenResponse.access_token;
                        authBtn.style.display = 'none';
                        if (fileInput.files.length > 0) {
                            submitBtn.disabled = false;
                        }
                        msgEl.textContent = 'Authenticated! You may now upload.';
                        msgEl.style.color = '#10b981';
                        console.log('Google Drive authenticated successfully');
                    },
                });
            }
            tokenClient.requestAccessToken();
        });
    }

    // File Input Change Handler
    if (fileInput) {
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length > 0) {
                if (accessToken) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Submit Assignment";
                } else {
                    msgEl.textContent = "Please sign in with Google first";
                    msgEl.style.color = "#f59e0b";
                }
            } else {
                submitBtn.disabled = true;
                submitBtn.textContent = "Submit Assignment";
            }
        });
    }

    // Combined Upload and Submit Handler
    if (submitBtn) {
        submitBtn.addEventListener('click', async () => {
            // Check teacher's assignment portal status before any heavy work
            try {
                const teacherEmail = document.getElementById('teacherSelectDropdown').value;
                const userEmailForPortal = localStorage.getItem('userEmail');
                if (teacherEmail && window.db) {
                    const docRef = db.collection('settings').doc(`assignment_portal_${teacherEmail}`);
                    const docSnap = await docRef.get();
                    const data = docSnap.exists ? (docSnap.data() || {}) : {};
                    const status = (data.status || 'closed').toLowerCase();
                    if (status !== 'open') {
                        msgEl.textContent = "Assignment portal is currently closed. Please contact your teacher.";
                        msgEl.style.color = "#ef4444";
                        return;
                    }
                }
            } catch (e) {
                console.warn("Failed to verify portal status", e);
                // If status cannot be checked, treat as closed for safety
                msgEl.textContent = "Assignment portal is currently unavailable. Please try again later.";
                msgEl.style.color = "#ef4444";
                return;
            }

            // Validation checks
            if (!accessToken) {
                msgEl.textContent = "Please sign in with Google first";
                msgEl.style.color = "#ef4444";
                authBtn.style.display = 'inline-block';
                return;
            }

            const file = fileInput.files[0];
            const title = document.getElementById('assignmentTitle').value.trim();
            const comments = document.getElementById('assignmentComments').value.trim();
            const teacherEmail = document.getElementById('teacherSelectDropdown').value;
            const userEmail = localStorage.getItem('userEmail');

            if (!title) {
                msgEl.textContent = "Please enter an assignment title";
                msgEl.style.color = "#ef4444";
                return;
            }

            if (!teacherEmail) {
                msgEl.textContent = "Please select a teacher";
                msgEl.style.color = "#ef4444";
                return;
            }

            if (!file) {
                msgEl.textContent = "Please select a file";
                msgEl.style.color = "#ef4444";
                return;
            }

            if (!file.type.match(/pdf/)) {
                msgEl.textContent = "File must be a PDF";
                msgEl.style.color = "#ef4444";
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = "Uploading to Drive...";
            msgEl.textContent = "Uploading to Google Drive...";
            msgEl.style.color = "#667eea";

            try {
                // Step 1: Upload to Google Drive
                // Prefer target folder, but gracefully fall back to root if that folder is missing
                const buildFormData = (withFolder) => {
                    const metadata = {
                        name: title + ' - ' + file.name,
                        mimeType: file.type
                    };
                    if (withFolder && DRIVE_FOLDER_ID) {
                        metadata.parents = [DRIVE_FOLDER_ID];
                    }
                    const fd = new FormData();
                    fd.append('metadata', new Blob([JSON.stringify(metadata)], {
                        type: 'application/json'
                    }));
                    fd.append('file', file);
                    return fd;
                };

                async function uploadToDrive(withFolder) {
                    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
                        method: 'POST',
                        headers: {
                            'Authorization': 'Bearer ' + accessToken
                        },
                        body: buildFormData(withFolder)
                    });
                    const json = await response.json();
                    return { ok: response.ok, json };
                }

                // First try uploading into the configured folder
                let { ok, json: uploadJson } = await uploadToDrive(true);

                // If folder is missing (404 notFound), retry without parents so it goes to root
                if ((!ok || !uploadJson.id) && uploadJson && uploadJson.error && uploadJson.error.errors) {
                    const firstErr = uploadJson.error.errors[0] || {};
                    if (firstErr.reason === 'notFound') {
                        console.warn('Drive folder not found, retrying upload without folder:', uploadJson);
                        ({ ok, json: uploadJson } = await uploadToDrive(false));
                    }
                }

                if (!ok || !uploadJson.id) {
                    const message = (uploadJson && uploadJson.error && uploadJson.error.message) ? uploadJson.error.message : JSON.stringify(uploadJson);
                    throw new Error('Upload failed: ' + message);
                }

                // Grant public read permission so teachers can view the file
                await fetch(`https://www.googleapis.com/drive/v3/files/${uploadJson.id}/permissions`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + accessToken,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        role: 'reader',
                        type: 'anyone'
                    })
                });

                // Get the Drive link
                const metaResponse = await fetch(`https://www.googleapis.com/drive/v3/files/${uploadJson.id}?fields=webViewLink`, {
                    headers: {
                        'Authorization': 'Bearer ' + accessToken
                    }
                });
                const metaJson = await metaResponse.json();
                currentFileUrl = metaJson.webViewLink;

                // Step 2: Send to Teacher (save to Firestore)
                submitBtn.textContent = "Sending to teacher...";
                msgEl.textContent = "Sending to teacher...";

                await db.collection('submissions').add({
                    assignmentTitle: title,
                    comments: comments,
                    driveLink: currentFileUrl,
                    teacherEmail: teacherEmail,
                    studentEmail: userEmail,
                    status: 'pending',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Success!
                alert("Sent successfully!");
                msgEl.textContent = "";

                // Reset form
                document.getElementById('submitAssignmentForm').reset();
                submitBtn.disabled = true;
                submitBtn.textContent = "Submit Assignment";
                currentFileUrl = null;

                // Refresh list
                fetchStudentAssignments();

            } catch (error) {
                console.error("Submission error:", error);
                msgEl.textContent = "Submission failed: " + error.message;
                msgEl.style.color = "#ef4444";
                submitBtn.disabled = false;
                submitBtn.textContent = "Retry Submission";
            }
        });
    }

    // Remove old sendBtn handler - no longer needed
});

// ============================================
// VIEW MARKS - Show student marks table
// ============================================
async function loadStudentMarks() {
    const container = document.getElementById('studentMarksTable');
    if (!container || !window.db) return;

    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        container.innerHTML = '<div class="muted">Please log in to view marks.</div>';
        return;
    }

    container.innerHTML = '<div class="muted">Loading marks...</div>';

    try {
        // Get all submissions for this student
        const submissionsSnap = await db.collection('submissions')
            .where('studentEmail', '==', userEmail)
            .get();

        const marksData = [];

        submissionsSnap.forEach(doc => {
            const data = doc.data();
            if (data.marks !== undefined && data.marks !== null) {
                // Properly handle Firestore timestamp
                let dateObj = null;
                if (data.createdAt) {
                    if (typeof data.createdAt.toDate === 'function') {
                        dateObj = data.createdAt.toDate();
                    } else if (data.createdAt.seconds !== undefined) {
                        dateObj = new Date(data.createdAt.seconds * 1000);
                    } else if (data.createdAt.toMillis) {
                        dateObj = new Date(data.createdAt.toMillis());
                    } else if (typeof data.createdAt === 'number') {
                        dateObj = new Date(data.createdAt);
                    } else if (typeof data.createdAt === 'string') {
                        dateObj = new Date(data.createdAt);
                    }
                }

                marksData.push({
                    title: data.assignmentTitle || data.title || 'Untitled Assignment',
                    marks: data.marks,
                    date: dateObj,
                    type: 'Assignment'
                });
            }
        });

        // Sort by date (newest first)
        marksData.sort((a, b) => {
            const dateA = a.date ? a.date.getTime() : 0;
            const dateB = b.date ? b.date.getTime() : 0;
            return dateB - dateA;
        });

        if (marksData.length === 0) {
            container.innerHTML = '<div class="muted">No marks recorded yet.</div>';
            return;
        }

        // Render table
        let html = `
            <table style="width:100%;border-collapse:collapse;font-size:0.9rem;">
                <thead>
                    <tr style="background:#020617;color:#9fb3d6;">
                        <th style="text-align:left;padding:12px 10px;border-bottom:1px solid #1f2937;">Assignment / Exam Title</th>
                        <th style="text-align:right;padding:12px 10px;border-bottom:1px solid #1f2937;">Marks</th>
                        <th style="text-align:right;padding:12px 10px;border-bottom:1px solid #1f2937;">Date</th>
                    </tr>
                </thead>
                <tbody>
        `;

        marksData.forEach(item => {
            let dateStr = 'N/A';
            if (item.date && item.date instanceof Date && !isNaN(item.date.getTime())) {
                dateStr = item.date.toLocaleString();
            }
            html += `
                <tr style="border-bottom:1px solid #1f2937;">
                    <td style="padding:10px;color:#e2e8f0;">${escapeHtml(item.title)}</td>
                    <td style="padding:10px;text-align:right;color:#e2e8f0;font-weight:600;">${item.marks}</td>
                    <td style="padding:10px;text-align:right;color:#9fb3d6;">${escapeHtml(dateStr)}</td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        container.innerHTML = html;
    } catch (err) {
        console.error('Error loading student marks:', err);
        container.innerHTML = `<div class="muted" style="color:#ef4444;">Failed to load marks: ${escapeHtml(err.message)}</div>`;
    }
}

// ============================================
// VIEW ATTENDANCE - Student selects date, shows their attendance
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('studentAttendanceDate');
    if (dateInput) {
        dateInput.addEventListener('change', loadStudentAttendance);
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const sidebar = document.querySelector('.sidebar');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sidebarClose = document.getElementById('sidebarClose');
    const backdrop = (document.getElementById('backdrop'));

    const openSidebarMenu = () => {
        if (!sidebar) return;
        sidebar.classList.add('open');
        document.body.classList.add('sidebar-open');
        if (backdrop) {
            backdrop.classList.add('show');
        }
    };

    const closeSidebarMenu = () => {
        if (sidebar) {
            sidebar.classList.remove('open');
        }
        document.body.classList.remove('sidebar-open');
        if (backdrop) {
            backdrop.classList.remove('show');
        }
    };

    if (hamburgerBtn && sidebar) {
        hamburgerBtn.addEventListener('click', () => {
            if (sidebar.classList.contains('open')) {
                closeSidebarMenu();
            } else {
                openSidebarMenu();
            }
        });
    }

    if (sidebarClose) {
        sidebarClose.addEventListener('click', (event) => {
            event.preventDefault();
            closeSidebarMenu();
        });
    }

    if (backdrop) {
        backdrop.addEventListener('click', closeSidebarMenu);
    }

    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 1024) {
                closeSidebarMenu();
            }
        });
    });
});

async function loadStudentAttendance() {
    const dateInput = document.getElementById('studentAttendanceDate');
    const statusEl = document.getElementById('studentAttendanceStatus');
    const msgEl = document.getElementById('studentAttendanceMessage');

    if (!dateInput || !statusEl) return;

    const dateVal = dateInput.value;
    if (!dateVal) {
        statusEl.innerHTML = '<div class="muted">Select a date to see your attendance.</div>';
        if (msgEl) msgEl.textContent = '';
        return;
    }

    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        statusEl.innerHTML = '<div class="muted">Please log in to view attendance.</div>';
        return;
    }

    if (!window.dbAttendance || !window.db) {
        statusEl.innerHTML = '<div class="muted" style="color:#ef4444;">Attendance database not initialized.</div>';
        return;
    }

    statusEl.innerHTML = '<div class="muted">Loading attendance...</div>';
    if (msgEl) msgEl.textContent = '';

    try {
        // Get all attendance records for this date
        const attendanceSnap = await window.dbAttendance.collection('attendance')
            .where('date', '==', dateVal)
            .get();

        let attendanceStatus = 'No record';
        let found = false;

        attendanceSnap.forEach(doc => {
            const data = doc.data();
            const present = Array.isArray(data.presentStudents) ? data.presentStudents : [];
            const absent = Array.isArray(data.absentStudents) ? data.absentStudents : [];

            if (present.includes(userEmail)) {
                attendanceStatus = 'Present';
                found = true;
            } else if (absent.includes(userEmail)) {
                attendanceStatus = 'Absent';
                found = true;
            }
        });

        // Calculate overall attendance percentage
        // Get all attendance records for this student
        const allAttendanceSnap = await window.dbAttendance.collection('attendance')
            .get();

        let totalDays = 0;
        let presentDays = 0;

        allAttendanceSnap.forEach(doc => {
            const data = doc.data();
            const present = Array.isArray(data.presentStudents) ? data.presentStudents : [];
            const absent = Array.isArray(data.absentStudents) ? data.absentStudents : [];

            // Only count if student is in present or absent (not if they're not in the record at all)
            if (present.includes(userEmail) || absent.includes(userEmail)) {
                totalDays += 1;
                if (present.includes(userEmail)) {
                    presentDays += 1;
                }
            }
        });

        const overallPercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

        // Render status
        const statusColor = attendanceStatus === 'Present' ? '#22c55e' :
            attendanceStatus === 'Absent' ? '#ef4444' : '#9ca3af';

        statusEl.innerHTML = `
            <div style="padding:20px;text-align:center;">
                <div style="font-size:1.2rem;color:#e2e8f0;margin-bottom:8px;">Date: ${escapeHtml(dateVal)}</div>
                <div style="font-size:1.5rem;font-weight:600;color:${statusColor};margin-bottom:16px;">
                    ${escapeHtml(attendanceStatus)}
                </div>
                <div style="font-size:1rem;color:#9fb3d6;padding-top:12px;border-top:1px solid #334155;">
                    Overall Attendance: ${overallPercentage}% (${presentDays}/${totalDays} days)
                </div>
            </div>
        `;

    } catch (err) {
        console.error('Error loading student attendance:', err);
        statusEl.innerHTML = `<div class="muted" style="color:#ef4444;">Failed to load attendance: ${escapeHtml(err.message)}</div>`;
        if (msgEl) {
            msgEl.textContent = 'Failed to load attendance: ' + err.message;
            msgEl.style.color = '#ef4444';
        }
    }
}

// ============================================
// ANNOUNCEMENTS - Get teacher sent announcements
// ============================================
async function loadStudentAnnouncements() {
    const container = document.getElementById('announcementsList');
    if (!container || !window.db) return;

    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        container.innerHTML = '<div class="muted">Please log in to view announcements.</div>';
        return;
    }

    container.innerHTML = '<div class="muted">Loading announcements...</div>';

    try {
        // Get announcements where student is in the students array (only from announcements collection)
        const announcementsSnap = await db.collection('announcements')
            .where('students', 'array-contains', userEmail)
            .get();

        const announcements = [];

        // Process announcements collection only
        announcementsSnap.forEach(doc => {
            const data = doc.data();
            if (Array.isArray(data.students) && data.students.includes(userEmail)) {
                // Properly handle Firestore timestamp
                let dateObj = new Date();
                if (data.createdAt) {
                    if (typeof data.createdAt.toDate === 'function') {
                        dateObj = data.createdAt.toDate();
                    } else if (data.createdAt.seconds !== undefined) {
                        dateObj = new Date(data.createdAt.seconds * 1000);
                    } else if (data.createdAt.toMillis) {
                        dateObj = new Date(data.createdAt.toMillis());
                    } else if (typeof data.createdAt === 'number') {
                        dateObj = new Date(data.createdAt);
                    } else if (typeof data.createdAt === 'string') {
                        dateObj = new Date(data.createdAt);
                    }
                }

                announcements.push({
                    title: data.title || 'Untitled Announcement',
                    description: data.description || '',
                    driveLink: data.driveLink || '',
                    createdAt: dateObj,
                    teacherEmail: data.teacherEmail || ''
                });
            }
        });

        // Sort by date (newest first)
        announcements.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

        if (announcements.length === 0) {
            container.innerHTML = '<div class="muted">No announcements available.</div>';
            return;
        }

        // Render announcements
        container.innerHTML = '';
        announcements.forEach(ann => {
            const item = document.createElement('div');
            item.className = 'syllabus-row-card';

            const titleEsc = escapeHtml(ann.title);
            const descEsc = escapeHtml(ann.description);
            const createdEsc = escapeHtml(ann.createdAt.toLocaleDateString());
            const driveEsc = escapeHtml(ann.driveLink);

            item.innerHTML = `
                <div class="syllabus-left">
                    <span class="syllabus-icon">📢</span>
                    <div>
                        <div class="syllabus-title">${titleEsc}</div>
                        ${descEsc ? `<div class="syllabus-desc" style="color:#9fb3d6;font-size:0.9em;margin:2px 0 6px 0;">${descEsc}</div>` : ''}
                        <div class="syllabus-meta">Posted: ${createdEsc}</div>
                    </div>
                </div>
                <div class="syllabus-actions">
                    ${ann.driveLink ? `<button class="syllabus-btn open-btn" onclick="window.open('${driveEsc}','_blank')">View Link</button>` : ''}
                </div>
            `;
            container.appendChild(item);
        });

    } catch (err) {
        console.error('Error loading announcements:', err);
        container.innerHTML = `<div class="muted" style="color:#ef4444;">Failed to load announcements: ${escapeHtml(err.message)}</div>`;
    }
}