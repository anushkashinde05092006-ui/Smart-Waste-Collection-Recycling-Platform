/* ==========================================================================
   EcoLoop Smart Waste Collection Platform - Application Controller (v3 Auth Edition)
   FIT-FEST 2026 Hackathon
   ========================================================================== */

let currentUser = null;
let currentCategories = [];
let currentRequests = [];
let currentReports = [];
let currentChallenges = [];
let selectedCategory = null;
let leafletMap = null;
let leafletMarker = null;
let categoryChart = null;
let trendChart = null;

let selectedLat = 18.559;
let selectedLng = 73.786;

document.addEventListener('DOMContentLoaded', () => {
    checkAuthSession();
    initTabs();
    loadCategories();
    loadRequests();
    loadStats();
    loadReports();
    loadChallenges();
    initMap();
    initEventListeners();
    handleURLRouting();
});

/* Simple Client URL Routing Handler */
function handleURLRouting() {
    const path = window.location.pathname;
    if (path === '/login') {
        if (!currentUser) showModal('auth-modal');
    } else if (path === '/register') {
        if (!currentUser) showModal('reg-modal');
    } else if (path === '/dashboard') {
        if (currentUser) {
            const tab = document.querySelector('[data-tab="dashboard-tab"]');
            if (tab) tab.click();
        } else {
            showModal('auth-modal');
        }
    } else if (path === '/profile') {
        if (currentUser) {
            const tab = document.querySelector('[data-tab="profile-tab"]');
            if (tab) tab.click();
        } else {
            showModal('auth-modal');
        }
    } else if (path === '/my-requests') {
        if (currentUser) {
            const tab = document.querySelector('[data-tab="my-requests-tab"]');
            if (tab) tab.click();
        } else {
            showModal('auth-modal');
        }
    }
}

/* Toast Notification Utility */
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'border-red-500/40 text-red-300' : 'border-emerald-500/40 text-emerald-300'}`;
    toast.innerHTML = `
        <i class="fa-solid ${type === 'error' ? 'fa-circle-exclamation text-red-400' : 'fa-circle-check text-emerald-400'}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

/* User Auth Session Check */
async function checkAuthSession() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (data.status === 'success' && data.authenticated) {
            currentUser = data.user;
            updateAuthUI();
        } else {
            currentUser = null;
            updateAuthUI();
        }
    } catch (err) {
        console.error('Auth check failed', err);
    }
}

/* Update Auth UI Elements */
function updateAuthUI() {
    const userDisplay = document.getElementById('user-profile-display');
    const loggedOutActions = document.getElementById('logged-out-actions');

    const authTabs = document.querySelectorAll('.auth-only');

    if (currentUser) {
        if (userDisplay) {
            userDisplay.style.display = 'flex';
            document.getElementById('user-name-label').innerText = currentUser.name;
            document.getElementById('user-role-badge').innerText = currentUser.role.toUpperCase();
            document.getElementById('user-pts-label').innerText = `${currentUser.eco_points || 0} pts`;
        }
        if (loggedOutActions) loggedOutActions.style.display = 'none';

        // Show authenticated user tabs
        authTabs.forEach(t => t.style.display = 'flex');

        // Show Collector or Admin tabs based on role
        const collectorTab = document.querySelector('[data-tab="collector-tab"]');
        const adminTab = document.querySelector('[data-tab="admin-tab"]');

        if (collectorTab) collectorTab.style.display = (currentUser.role === 'collector' || currentUser.role === 'admin') ? 'flex' : 'none';
        if (adminTab) adminTab.style.display = (currentUser.role === 'admin') ? 'flex' : 'none';

        // Populate User Profile Tab Values
        const pName = document.getElementById('profile-display-name');
        const pEmail = document.getElementById('profile-display-email');
        const pRole = document.getElementById('profile-display-role');
        const pPts = document.getElementById('profile-display-points');
        const pDate = document.getElementById('profile-display-date');
        const pInputName = document.getElementById('profile-input-name');
        const pInputPhone = document.getElementById('profile-input-phone');

        if (pName) pName.innerText = currentUser.name;
        if (pEmail) pEmail.innerText = currentUser.email;
        if (pRole) pRole.innerText = currentUser.role.toUpperCase();
        if (pPts) pPts.innerText = `${currentUser.eco_points || 0} pts`;
        if (pDate) pDate.innerText = (currentUser.created_at || '2026-09-01').split('T')[0];
        if (pInputName) pInputName.value = currentUser.name;
        if (pInputPhone) pInputPhone.value = currentUser.phone || '';

        // Pre-fill user details in form
        const nameInput = document.getElementById('form-name');
        const phoneInput = document.getElementById('form-phone');
        if (nameInput && !nameInput.value) nameInput.value = currentUser.name;
        if (phoneInput && !phoneInput.value) phoneInput.value = currentUser.phone || '';

        // Populate Dashboard User Welcome Name
        const dashWelcome = document.getElementById('dash-welcome-name');
        const dashBadge = document.getElementById('dash-user-level-badge');
        if (dashWelcome) dashWelcome.innerText = currentUser.name;
        if (dashBadge) dashBadge.innerText = `Level ${currentUser.level || 1} ${currentUser.badges ? currentUser.badges[0] : 'Eco Pioneer'}`;

        renderDashboard();

    } else {
        if (userDisplay) userDisplay.style.display = 'none';
        if (loggedOutActions) loggedOutActions.style.display = 'flex';

        authTabs.forEach(t => t.style.display = 'none');

        const collectorTab = document.querySelector('[data-tab="collector-tab"]');
        const adminTab = document.querySelector('[data-tab="admin-tab"]');
        if (collectorTab) collectorTab.style.display = 'none';
        if (adminTab) adminTab.style.display = 'none';
    }
}

/* Tab Switcher */
function initTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const target = tab.getAttribute('data-tab');
            document.querySelectorAll('.tab-content').forEach(c => c.style.display = 'none');
            const targetEl = document.getElementById(target);
            if (targetEl) targetEl.style.display = 'block';

            if (target === 'dashboard-tab') {
                renderDashboard();
            } else if (target === 'my-requests-tab') {
                renderMyRequests();
            } else if (target === 'admin-tab') {
                renderAdminTable();
                renderCharts();
            } else if (target === 'collector-tab') {
                renderCollectorPickups();
            } else if (target === 'track-tab') {
                renderTrackerList();
            } else if (target === 'guide-tab') {
                renderGuideGrid();
            } else if (target === 'report-tab') {
                renderReportsList();
            } else if (target === 'impact-tab') {
                renderChallengesGrid();
            }
        });
    });
}

/* Auth Functions */
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.status === 'success') {
            currentUser = data.user;
            updateAuthUI();
            closeModal('auth-modal');
            showToast(data.message);
            loadRequests();
            loadStats();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Login failed. Check your connection.', 'error');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const password = document.getElementById('reg-password').value;
    const confirmPassword = document.getElementById('reg-confirm-password').value;

    if (password !== confirmPassword) {
        showToast('Password and Confirm Password do not match.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password, confirm_password: confirmPassword })
        });
        const data = await res.json();
        if (data.status === 'success') {
            currentUser = data.user;
            updateAuthUI();
            closeModal('reg-modal');
            showToast(data.message);
            loadRequests();
            loadStats();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Registration failed.', 'error');
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const name = document.getElementById('profile-input-name').value;
    const phone = document.getElementById('profile-input-phone').value;

    try {
        const res = await fetch('/api/auth/profile', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone })
        });
        const data = await res.json();
        if (data.status === 'success') {
            currentUser = data.user;
            updateAuthUI();
            showToast(data.message);
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Failed to update profile.', 'error');
    }
}

async function handleLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        currentUser = null;
        updateAuthUI();
        showToast('Logged out successfully');
        document.querySelector('[data-tab="pickup-tab"]').click();
    } catch (err) {
        console.error('Logout error', err);
    }
}

/* Quick Fill Demo Login Credentials */
function fillDemoLogin(role) {
    if (role === 'admin') {
        document.getElementById('login-email').value = 'admin@ecoloop.com';
        document.getElementById('login-password').value = 'admin123';
    } else if (role === 'collector') {
        document.getElementById('login-email').value = 'collector@ecoloop.com';
        document.getElementById('login-password').value = 'collector123';
    } else {
        document.getElementById('login-email').value = 'anushka@example.com';
        document.getElementById('login-password').value = 'user123';
    }
}

/* Fetch Categories */
async function loadCategories() {
    try {
        const res = await fetch('/api/categories');
        const data = await res.json();
        if (data.status === 'success') {
            currentCategories = data.categories;
            renderCategoriesGrid();
            renderGuideGrid();
        }
    } catch (err) {
        console.error('Failed to load categories', err);
    }
}

function renderCategoriesGrid() {
    const container = document.getElementById('category-grid');
    if (!container) return;
    
    container.innerHTML = currentCategories.map(cat => `
        <div class="glass-card category-card ${selectedCategory === cat.id ? 'selected' : ''}" 
             onclick="selectCategory('${cat.id}')">
            <div class="category-header">
                <div class="category-icon-box" style="background: ${cat.bg_color}; color: ${cat.color}">
                    <i class="fa-solid ${cat.icon}"></i>
                </div>
                <span class="pts-badge">+${cat.points_per_kg} pts/kg</span>
            </div>
            <h3>${cat.name}</h3>
            <p>${cat.description}</p>
            <div class="category-footer">
                <span><i class="fa-solid fa-leaf text-emerald-400"></i> ${cat.co2_saved_per_kg} kg CO₂ / kg</span>
                <span class="text-emerald-400 font-semibold">Select <i class="fa-solid fa-chevron-right"></i></span>
            </div>
        </div>
    `).join('');
}

function selectCategory(catId) {
    selectedCategory = catId;
    renderCategoriesGrid();
    updateEcoCalculation();
    
    const cat = currentCategories.find(c => c.id === catId);
    if (cat) showGuideTip(cat);
}

function showGuideTip(cat) {
    const tipEl = document.getElementById('category-tip');
    if (tipEl) {
        tipEl.innerHTML = `
            <div class="p-4 rounded-xl mb-4" style="background: ${cat.bg_color}; border: 1px solid ${cat.color}">
                <div class="flex items-center gap-3 font-bold mb-1" style="color: ${cat.color}">
                    <i class="fa-solid fa-lightbulb text-lg"></i> Recycling Tip for ${cat.name}
                </div>
                <p class="text-sm text-slate-300">${cat.tips}</p>
            </div>
        `;
    }
}

/* Fetch Requests */
async function loadRequests() {
    try {
        const res = await fetch('/api/requests');
        const data = await res.json();
        if (data.status === 'success') {
            currentRequests = data.requests;
            renderTrackerList();
            renderMyRequests();
            renderDashboard();
            renderAdminTable();
            renderCollectorPickups();
        }
    } catch (err) {
        console.error('Failed to load requests', err);
    }
}

/* Fetch Reports & Challenges */
async function loadReports() {
    try {
        const res = await fetch('/api/reports');
        const data = await res.json();
        if (data.status === 'success') {
            currentReports = data.reports;
            renderReportsList();
        }
    } catch (err) {}
}

async function loadChallenges() {
    try {
        const res = await fetch('/api/challenges');
        const data = await res.json();
        if (data.status === 'success') {
            currentChallenges = data.challenges;
            renderChallengesGrid();
        }
    } catch (err) {}
}

/* Fetch Stats */
async function loadStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        if (data.status === 'success') {
            const stats = data.stats;
            document.getElementById('stat-weight').innerText = `${stats.total_weight_kg} kg`;
            document.getElementById('stat-co2').innerText = `${stats.total_co2_saved_kg} kg`;
            document.getElementById('stat-points').innerText = `${stats.total_eco_points} pts`;
            document.getElementById('stat-active').innerText = `${(stats.status_counts.Submitted || 0) + (stats.status_counts.Scheduled || 0) + (stats.status_counts.CollectorAssigned || 0) + (stats.status_counts.OnTheWay || 0)}`;

            if (document.getElementById('impact-trees')) {
                document.getElementById('impact-trees').innerText = `${stats.trees_saved_estimate} Trees`;
                document.getElementById('impact-kwh').innerText = `${stats.kwh_energy_saved_estimate} kWh`;
                document.getElementById('impact-water').innerText = `${stats.water_liters_saved_estimate} L`;
            }
        }
    } catch (err) {
        console.error('Failed to load stats', err);
    }
}

/* Render Dashboard Card Metrics */
function renderDashboard() {
    if (!currentUser) return;

    const userReqs = currentRequests.filter(r => r.user_id === currentUser.id || r.user_email === currentUser.email);
    const pendingReqs = userReqs.filter(r => ['Submitted', 'Scheduled', 'Collector Assigned', 'On The Way'].includes(r.status));
    const completedReqs = userReqs.filter(r => ['Collected', 'Recycling Completed'].includes(r.status));

    if (document.getElementById('dash-total-reqs')) document.getElementById('dash-total-reqs').innerText = userReqs.length;
    if (document.getElementById('dash-pending-reqs')) document.getElementById('dash-pending-reqs').innerText = pendingReqs.length;
    if (document.getElementById('dash-completed-reqs')) document.getElementById('dash-completed-reqs').innerText = completedReqs.length;
    if (document.getElementById('dash-eco-points')) document.getElementById('dash-eco-points').innerText = currentUser.eco_points || 0;

    const listContainer = document.getElementById('dash-requests-list');
    if (listContainer) {
        if (userReqs.length === 0) {
            listContainer.innerHTML = `<p class="text-center text-slate-400 py-6">No recent pickup requests found. Click 'Request Pickup' to get started!</p>`;
        } else {
            listContainer.innerHTML = userReqs.slice(0, 5).map(r => `
                <div class="flex items-center justify-between p-3 mb-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                    <div>
                        <span class="font-mono text-emerald-400 font-bold">${r.id}</span>
                        <span class="text-white font-semibold ml-2">${r.category_name} (${r.estimated_weight_kg} kg)</span>
                        <div class="text-slate-400 text-[10px]"><i class="fa-solid fa-clock"></i> ${r.pickup_date} (${r.time_slot})</div>
                    </div>
                    <span class="badge-status status-${r.status.replace(/\s+/g, '')}">${r.status}</span>
                </div>
            `).join('');
        }
    }
}

/* Render My Requests Tab */
function renderMyRequests() {
    const container = document.getElementById('my-requests-container');
    if (!container) return;

    if (!currentUser) {
        container.innerHTML = `<p class="text-center text-slate-400 py-8">Please log in to view your requests.</p>`;
        return;
    }

    const myReqs = currentRequests.filter(r => r.user_id === currentUser.id || r.user_email === currentUser.email);
    if (myReqs.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-400 py-8">You have no active pickup requests. Submit one today!</p>`;
        return;
    }

    container.innerHTML = myReqs.map(req => `
        <div class="glass-card p-5 mb-4">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                    <span class="text-xs font-mono text-emerald-400 font-bold">${req.id}</span>
                    <h3 class="text-lg font-bold text-white">${req.category_name}</h3>
                    <p class="text-xs text-slate-400"><i class="fa-solid fa-calendar"></i> Scheduled: ${req.pickup_date} | ${req.time_slot}</p>
                </div>
                <span class="badge-status status-${req.status.replace(/\s+/g, '')}">${req.status}</span>
            </div>
            <div class="text-xs text-slate-300 bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1 mb-3">
                <p><strong>Address:</strong> ${req.address}</p>
                <p><strong>Weight:</strong> ${req.estimated_weight_kg} kg | <strong>Points:</strong> +${req.eco_points} pts</p>
            </div>
            <div class="flex justify-end gap-2">
                <button onclick="printReceipt('${req.id}')" class="btn-primary text-xs py-1.5 px-3">
                    <i class="fa-solid fa-print"></i> Download Receipt
                </button>
            </div>
        </div>
    `).join('');
}

/* Map Initializer */
function initMap() {
    const mapEl = document.getElementById('map-container');
    if (!mapEl || typeof L === 'undefined') return;

    try {
        leafletMap = L.map('map-container').setView([selectedLat, selectedLng], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(leafletMap);
        leafletMarker = L.marker([selectedLat, selectedLng], { draggable: true }).addTo(leafletMap);

        leafletMarker.on('dragend', (e) => {
            const coord = e.target.getLatLng();
            selectedLat = coord.lat;
            selectedLng = coord.lng;
            updateAddressFromCoords(coord.lat, coord.lng);
        });

        leafletMap.on('click', (e) => {
            selectedLat = e.latlng.lat;
            selectedLng = e.latlng.lng;
            leafletMarker.setLatLng(e.latlng);
            updateAddressFromCoords(e.latlng.lat, e.latlng.lng);
        });
    } catch (e) {}
}

function updateAddressFromCoords(lat, lng) {
    const addrInput = document.getElementById('form-address');
    if (addrInput && !addrInput.value) {
        addrInput.value = `Pin Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), Baner Road, Pune`;
    }
}

function locateUser() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            selectedLat = pos.coords.latitude;
            selectedLng = pos.coords.longitude;
            if (leafletMap && leafletMarker) {
                leafletMap.setView([selectedLat, selectedLng], 15);
                leafletMarker.setLatLng([selectedLat, selectedLng]);
                updateAddressFromCoords(selectedLat, selectedLng);
            }
        });
    }
}

/* Live Eco Calculation */
function updateEcoCalculation() {
    const weightInput = document.getElementById('form-weight');
    const weightVal = weightInput ? parseFloat(weightInput.value) || 1 : 1;
    
    document.getElementById('weight-display').innerText = `${weightVal} kg`;
    
    const cat = currentCategories.find(c => c.id === selectedCategory) || currentCategories[0];
    if (cat) {
        const pts = Math.round(weightVal * cat.points_per_kg);
        const co2 = (weightVal * cat.co2_saved_per_kg).toFixed(1);
        
        document.getElementById('calc-points').innerText = `+${pts} pts`;
        document.getElementById('calc-co2').innerText = `${co2} kg CO₂`;
    }
}

/* Form Event Listeners */
function initEventListeners() {
    const weightSlider = document.getElementById('form-weight');
    if (weightSlider) weightSlider.addEventListener('input', updateEcoCalculation);

    const form = document.getElementById('pickup-form');
    if (form) form.addEventListener('submit', handleFormSubmit);

    const loginForm = document.getElementById('auth-login-form');
    if (loginForm) loginForm.addEventListener('submit', handleLogin);

    const regForm = document.getElementById('auth-reg-form');
    if (regForm) regForm.addEventListener('submit', handleRegister);

    const profileForm = document.getElementById('profile-update-form');
    if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);

    const reportForm = document.getElementById('report-problem-form');
    if (reportForm) reportForm.addEventListener('submit', handleReportSubmit);

    document.querySelectorAll('.slot-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        });
    });
}

/* Submit Pickup Request */
async function handleFormSubmit(e) {
    e.preventDefault();

    if (!currentUser) {
        showToast('Please log in to submit a pickup request.', 'error');
        showModal('auth-modal');
        return;
    }

    if (!selectedCategory) {
        showToast('Please select a waste category.', 'error');
        return;
    }

    const userName = document.getElementById('form-name').value || currentUser.name;
    const userPhone = document.getElementById('form-phone').value || currentUser.phone;
    const weight = parseFloat(document.getElementById('form-weight').value) || 2.5;
    const desc = document.getElementById('form-desc').value || `${weight} kg items`;
    const address = document.getElementById('form-address').value;
    const landmark = document.getElementById('form-landmark').value;
    const pickupDate = document.getElementById('form-date').value || new Date().toISOString().split('T')[0];
    
    const selectedSlotEl = document.querySelector('.slot-btn.selected');
    const timeSlot = selectedSlotEl ? selectedSlotEl.getAttribute('data-slot') : '09:00 AM - 12:00 PM';

    if (!address) {
        showToast('Please provide your pickup address.', 'error');
        return;
    }

    const payload = {
        user_name: userName,
        user_phone: userPhone,
        category_id: selectedCategory,
        estimated_weight_kg: weight,
        quantity_description: desc,
        address: address,
        landmark: landmark,
        lat: selectedLat,
        lng: selectedLng,
        pickup_date: pickupDate,
        time_slot: timeSlot,
        notes: document.getElementById('form-notes').value || ''
    };

    try {
        const res = await fetch('/api/requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.status === 'success') {
            if (typeof confetti === 'function') {
                confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            }
            showReceiptModal(data.request);
            showToast(data.message);
            loadRequests();
            loadStats();
            checkAuthSession();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Failed to submit pickup request.', 'error');
    }
}

function showReceiptModal(req) {
    const modal = document.getElementById('receipt-modal');
    if (!modal) return;

    document.getElementById('receipt-id').innerText = req.id;
    document.getElementById('receipt-category').innerText = req.category_name;
    document.getElementById('receipt-weight').innerText = `${req.estimated_weight_kg} kg`;
    document.getElementById('receipt-date').innerText = `${req.pickup_date} (${req.time_slot})`;
    document.getElementById('receipt-address').innerText = req.address;
    document.getElementById('receipt-points').innerText = `+${req.eco_points} Eco Points`;
    document.getElementById('receipt-co2').innerText = `${req.co2_saved_kg} kg CO₂ offset`;

    modal.classList.add('active');
}

function closeModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.remove('active');
}

function showModal(modalId) {
    const m = document.getElementById(modalId);
    if (m) m.classList.add('active');
}

/* Render Tracker List */
function renderTrackerList() {
    const container = document.getElementById('tracker-list');
    if (!container) return;

    let reqs = currentRequests;
    if (reqs.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-400 py-8">No active pickup requests found. Submit a request above!</p>`;
        return;
    }

    container.innerHTML = reqs.map(req => {
        const steps = ['Submitted', 'Scheduled', 'Collector Assigned', 'On The Way', 'Collected', 'Recycling Completed'];
        const currentIdx = steps.indexOf(req.status);
        const safeIdx = currentIdx >= 0 ? currentIdx : 0;

        return `
            <div class="glass-panel p-6 mb-6">
                <div class="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-700/50">
                    <div>
                        <span class="text-xs font-mono text-emerald-400 font-bold">${req.id}</span>
                        <h3 class="text-xl font-bold text-white">${req.category_name}</h3>
                        <p class="text-xs text-slate-400"><i class="fa-solid fa-calendar"></i> Scheduled: ${req.pickup_date} | ${req.time_slot}</p>
                    </div>
                    <div class="text-right">
                        <span class="badge-status status-${req.status.replace(/\s+/g, '')}">
                            <i class="fa-solid fa-circle text-[8px]"></i> ${req.status}
                        </span>
                        <p class="text-xs text-emerald-400 font-semibold mt-1">+${req.eco_points} pts • ${req.co2_saved_kg} kg CO₂</p>
                    </div>
                </div>

                <div class="timeline">
                    <div class="timeline-step ${safeIdx >= 0 ? 'completed' : ''} ${safeIdx === 0 ? 'active' : ''}">
                        <div class="timeline-icon"><i class="fa-solid fa-paper-plane"></i></div>
                        <span class="timeline-label">Submitted</span>
                    </div>
                    <div class="timeline-step ${safeIdx >= 1 ? 'completed' : ''} ${safeIdx === 1 ? 'active' : ''}">
                        <div class="timeline-icon"><i class="fa-solid fa-calendar-check"></i></div>
                        <span class="timeline-label">Scheduled</span>
                    </div>
                    <div class="timeline-step ${safeIdx >= 2 ? 'completed' : ''} ${safeIdx === 2 ? 'active' : ''}">
                        <div class="timeline-icon"><i class="fa-solid fa-user-check"></i></div>
                        <span class="timeline-label">Assigned</span>
                    </div>
                    <div class="timeline-step ${safeIdx >= 3 ? 'completed' : ''} ${safeIdx === 3 ? 'active' : ''}">
                        <div class="timeline-icon"><i class="fa-solid fa-truck-fast"></i></div>
                        <span class="timeline-label">On The Way</span>
                    </div>
                    <div class="timeline-step ${safeIdx >= 4 ? 'completed' : ''} ${safeIdx === 4 ? 'active' : ''}">
                        <div class="timeline-icon"><i class="fa-solid fa-box-archive"></i></div>
                        <span class="timeline-label">Collected</span>
                    </div>
                    <div class="timeline-step ${safeIdx >= 5 ? 'completed' : ''} ${safeIdx === 5 ? 'active' : ''}">
                        <div class="timeline-icon"><i class="fa-solid fa-recycle"></i></div>
                        <span class="timeline-label">Recycled</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs text-slate-300 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
                    <div>
                        <p class="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Pickup Address</p>
                        <p class="text-sm font-medium text-white">${req.address}</p>
                        ${req.landmark ? `<p class="text-slate-400">Landmark: ${req.landmark}</p>` : ''}
                    </div>
                    <div>
                        <p class="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Assigned Collector</p>
                        <p class="text-sm font-medium text-emerald-400">${req.collector_assigned || 'Awaiting Collector'}</p>
                        <p class="text-slate-400">Est. Weight: ${req.estimated_weight_kg} kg</p>
                    </div>
                </div>

                <div class="flex justify-end gap-3 mt-4">
                    ${req.status === 'Submitted' || req.status === 'Scheduled' ? `
                        <button onclick="cancelReq('${req.id}')" class="btn-outline text-xs py-2 px-4 text-red-400 border-red-500/30 hover:bg-red-500/10">
                            <i class="fa-solid fa-xmark"></i> Cancel Request
                        </button>
                    ` : ''}
                    <button onclick="printReceipt('${req.id}')" class="btn-primary text-xs py-2 px-4">
                        <i class="fa-solid fa-print"></i> Download Receipt
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/* Collector Portal Dashboard */
function renderCollectorPickups() {
    const container = document.getElementById('collector-pickups-list');
    if (!container) return;

    if (currentRequests.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-400 py-8">No assigned pickup requests.</p>`;
        return;
    }

    container.innerHTML = currentRequests.map(req => `
        <div class="glass-card p-5 mb-4 border-l-4 border-emerald-500">
            <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
                <div>
                    <span class="text-xs font-mono text-emerald-400 font-bold">${req.id}</span>
                    <h4 class="text-lg font-bold text-white">${req.category_name} (${req.estimated_weight_kg} kg)</h4>
                    <p class="text-xs text-slate-300"><i class="fa-solid fa-user text-slate-400"></i> ${req.user_name} | ${req.user_phone}</p>
                </div>
                <span class="badge-status status-${req.status.replace(/\s+/g, '')}">${req.status}</span>
            </div>

            <div class="bg-slate-900/60 p-3 rounded-lg text-xs text-slate-300 mb-3 space-y-1">
                <p><strong><i class="fa-solid fa-location-dot text-red-400"></i> Pickup Address:</strong> ${req.address}</p>
                <p><strong><i class="fa-solid fa-clock text-amber-400"></i> Scheduled Time:</strong> ${req.pickup_date} (${req.time_slot})</p>
                ${req.notes ? `<p><strong><i class="fa-solid fa-sticky-note text-cyan-400"></i> Notes:</strong> ${req.notes}</p>` : ''}
            </div>

            <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                <span class="text-xs text-slate-400 font-semibold mr-2">Collector Action:</span>
                
                <button onclick="updateCollectorStatus('${req.id}', 'Collector Assigned')" class="btn-action-collector bg-purple-600/30 text-purple-300 border border-purple-500/40 hover:bg-purple-600/50">
                    <i class="fa-solid fa-check-double"></i> Accept & Assign
                </button>

                <button onclick="updateCollectorStatus('${req.id}', 'On The Way')" class="btn-action-collector bg-pink-600/30 text-pink-300 border border-pink-500/40 hover:bg-pink-600/50">
                    <i class="fa-solid fa-truck-fast"></i> On The Way
                </button>

                <button onclick="updateCollectorStatus('${req.id}', 'Collected')" class="btn-action-collector bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-600/50">
                    <i class="fa-solid fa-box-archive"></i> Mark Collected
                </button>

                <button onclick="updateCollectorStatus('${req.id}', 'Recycling Completed')" class="btn-action-collector bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/50">
                    <i class="fa-solid fa-recycle"></i> Recycling Completed
                </button>
            </div>
        </div>
    `).join('');
}

async function updateCollectorStatus(reqId, newStatus) {
    const collectorName = currentUser ? currentUser.name : 'Ramesh V. (Collector Alpha)';
    const collectorId = currentUser ? currentUser.id : 'USR-1002';

    try {
        const res = await fetch(`/api/requests/${reqId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: newStatus,
                collector_assigned: collectorName,
                collector_id: collectorId
            })
        });

        const data = await res.json();
        if (data.status === 'success') {
            showToast(`Status updated to '${newStatus}' for ${reqId}`);
            loadRequests();
            loadStats();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Failed to update status.', 'error');
    }
}

async function cancelReq(reqId) {
    if (!confirm(`Are you sure you want to cancel request ${reqId}?`)) return;

    try {
        const res = await fetch(`/api/requests/${reqId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`Request ${reqId} cancelled`);
            loadRequests();
            loadStats();
        }
    } catch (err) {
        showToast('Failed to cancel request.', 'error');
    }
}

function printReceipt(reqId) {
    const req = currentRequests.find(r => r.id === reqId);
    if (!req) return;
    
    const printWin = window.open('', '_blank');
    printWin.document.write(`
        <html>
            <head>
                <title>Eco Receipt - ${req.id}</title>
                <style>
                    body { font-family: sans-serif; padding: 40px; color: #1e293b; }
                    .header { text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; }
                    .details { margin-top: 30px; line-height: 1.8; }
                    .badge { background: #d1fae5; color: #047857; padding: 6px 12px; border-radius: 20px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>EcoLoop Smart Waste Collection Receipt</h2>
                    <p>FIT-FEST 2026 Hackathon Official Submission</p>
                    <span class="badge">Status: ${req.status}</span>
                </div>
                <div class="details">
                    <p><strong>Receipt ID:</strong> ${req.id}</p>
                    <p><strong>User Name:</strong> ${req.user_name}</p>
                    <p><strong>Waste Category:</strong> ${req.category_name}</p>
                    <p><strong>Weight:</strong> ${req.estimated_weight_kg} kg</p>
                    <p><strong>Pickup Address:</strong> ${req.address}</p>
                    <p><strong>Pickup Schedule:</strong> ${req.pickup_date} (${req.time_slot})</p>
                    <p><strong>Assigned Collector:</strong> ${req.collector_assigned || 'Unassigned'}</p>
                    <p><strong>Eco Points Awarded:</strong> +${req.eco_points} pts</p>
                    <p><strong>Carbon Offset:</strong> ${req.co2_saved_kg} kg CO₂</p>
                </div>
                <script>window.print();</script>
            </body>
        </html>
    `);
    printWin.document.close();
}

function renderAdminTable() {
    const tbody = document.getElementById('admin-table-body');
    if (!tbody) return;

    const statusFilter = document.getElementById('admin-filter-status')?.value || 'all';
    const searchQuery = document.getElementById('admin-search')?.value.toLowerCase() || '';

    let filtered = currentRequests;
    if (statusFilter !== 'all') {
        filtered = filtered.filter(r => r.status.toLowerCase().replace(/\s+/g, '') === statusFilter.toLowerCase().replace(/\s+/g, ''));
    }
    if (searchQuery) {
        filtered = filtered.filter(r => 
            r.id.toLowerCase().includes(searchQuery) ||
            r.user_name.toLowerCase().includes(searchQuery) ||
            r.address.toLowerCase().includes(searchQuery) ||
            r.category_name.toLowerCase().includes(searchQuery)
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">No requests matching filter criteria.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(r => `
        <tr>
            <td class="font-mono text-emerald-400 font-bold">${r.id}</td>
            <td>
                <div class="font-semibold text-white">${r.user_name}</div>
                <div class="text-xs text-slate-400">${r.user_phone}</div>
            </td>
            <td>
                <span class="font-medium text-slate-200">${r.category_name}</span>
                <div class="text-xs text-emerald-400 font-bold">${r.estimated_weight_kg} kg</div>
            </td>
            <td class="max-w-[180px] truncate text-slate-300" title="${r.address}">${r.address}</td>
            <td>
                <span class="badge-status status-${r.status.replace(/\s+/g, '')}">
                    ${r.status}
                </span>
            </td>
            <td class="text-xs text-slate-300">${r.collector_assigned || 'Unassigned'}</td>
            <td>
                <select onchange="updateAdminStatus('${r.id}', this.value)" class="bg-slate-900 text-xs border border-slate-700 rounded px-2 py-1 text-slate-200">
                    <option value="">Change Status...</option>
                    <option value="Submitted" ${r.status === 'Submitted' ? 'selected' : ''}>Submitted</option>
                    <option value="Scheduled" ${r.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
                    <option value="Collector Assigned" ${r.status === 'Collector Assigned' ? 'selected' : ''}>Collector Assigned</option>
                    <option value="On The Way" ${r.status === 'On The Way' ? 'selected' : ''}>On The Way</option>
                    <option value="Collected" ${r.status === 'Collected' ? 'selected' : ''}>Collected</option>
                    <option value="Recycling Completed" ${r.status === 'Recycling Completed' ? 'selected' : ''}>Recycling Completed</option>
                    <option value="Cancelled" ${r.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
        </tr>
    `).join('');
}

async function updateAdminStatus(reqId, newStatus) {
    if (!newStatus) return;

    try {
        const res = await fetch(`/api/requests/${reqId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                status: newStatus,
                collector_assigned: newStatus !== 'Submitted' ? 'Ramesh V. (Collector Alpha)' : 'Unassigned'
            })
        });

        const data = await res.json();
        if (data.status === 'success') {
            showToast(`Status updated to ${newStatus}`);
            loadRequests();
            loadStats();
        }
    } catch (err) {
        showToast('Failed to update status.', 'error');
    }
}

function renderCharts() {
    if (typeof Chart === 'undefined') return;

    const ctxCat = document.getElementById('chart-categories');
    if (ctxCat) {
        const catLabels = currentCategories.map(c => c.name);
        const catWeights = currentCategories.map(c => {
            return currentRequests
                .filter(r => r.category_id === c.id)
                .reduce((acc, curr) => acc + curr.estimated_weight_kg, 0);
        });

        if (categoryChart) categoryChart.destroy();

        categoryChart = new Chart(ctxCat, {
            type: 'doughnut',
            data: {
                labels: catLabels,
                datasets: [{
                    data: catWeights.map(w => w || 5.0),
                    backgroundColor: ['#10B981', '#8B5CF6', '#84CC16', '#F59E0B', '#06B6D4', '#64748B', '#EF4444', '#EC4899'],
                    borderWidth: 2,
                    borderColor: '#131e32'
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'right', labels: { color: '#94a3b8' } } }
            }
        });
    }

    const ctxTrend = document.getElementById('chart-trends');
    if (ctxTrend) {
        if (trendChart) trendChart.destroy();

        trendChart = new Chart(ctxTrend, {
            type: 'bar',
            data: {
                labels: ['May', 'Jun', 'Jul', 'Aug', 'Sep (Current)'],
                datasets: [{
                    label: 'Waste Recycled (kg)',
                    data: [120, 240, 310, 450, 680],
                    backgroundColor: '#10b981',
                    borderRadius: 8
                }, {
                    label: 'CO₂ Saved (kg)',
                    data: [180, 350, 480, 710, 920],
                    backgroundColor: '#06b6d4',
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                },
                plugins: { legend: { labels: { color: '#94a3b8' } } }
            }
        });
    }
}

function renderGuideGrid() {
    const container = document.getElementById('guide-container');
    if (!container) return;

    container.innerHTML = currentCategories.map(cat => `
        <div class="glass-card p-5">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold" style="background: ${cat.bg_color}; color: ${cat.color}">
                    <i class="fa-solid ${cat.icon}"></i>
                </div>
                <div>
                    <h3 class="text-base font-bold text-white">${cat.name}</h3>
                    <span class="text-xs font-semibold text-emerald-400">+${cat.points_per_kg} Eco Points / kg</span>
                </div>
            </div>
            <p class="text-xs text-slate-300 mb-3">${cat.description}</p>
            <div class="p-3 rounded-lg text-xs border border-emerald-500/20 bg-emerald-500/10 text-emerald-300">
                <i class="fa-solid fa-lightbulb"></i> <strong>Guideline:</strong> ${cat.tips}
            </div>
        </div>
    `).join('');
}

async function runSmartAssistant() {
    const itemType = document.getElementById('assist-item').value;
    const condition = document.getElementById('assist-condition').value;

    if (!itemType) {
        showToast('Please type your waste item.', 'error');
        return;
    }

    try {
        const res = await fetch('/api/assistant/recommend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_type: itemType, condition: condition })
        });
        const data = await res.json();
        if (data.status === 'success') {
            const rec = data.recommendation;
            document.getElementById('assist-res-category').innerText = rec.category_name;
            document.getElementById('assist-res-method').innerText = rec.disposal_method;
            document.getElementById('assist-res-collection').innerText = rec.collection_type;
            document.getElementById('assist-res-safety').innerText = rec.safety_instructions;

            document.getElementById('assist-results-box').style.display = 'block';

            selectCategory(rec.category_id);
        }
    } catch (err) {
        showToast('Assistant calculation failed.', 'error');
    }
}

async function handleReportSubmit(e) {
    e.preventDefault();
    const type = document.getElementById('report-type').value;
    const location = document.getElementById('report-location').value;
    const desc = document.getElementById('report-desc').value;

    try {
        const res = await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ problem_type: type, location: location, description: desc })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast('Waste problem report submitted!');
            document.getElementById('report-problem-form').reset();
            loadReports();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        showToast('Failed to submit report.', 'error');
    }
}

function renderReportsList() {
    const container = document.getElementById('reports-list');
    if (!container) return;

    if (currentReports.length === 0) {
        container.innerHTML = `<p class="text-center text-slate-400 py-6">No reported problems.</p>`;
        return;
    }

    container.innerHTML = currentReports.map(rep => `
        <div class="glass-card p-4 mb-3 border-l-4 ${rep.status === 'Resolved' ? 'border-emerald-500' : 'border-amber-500'}">
            <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-mono text-slate-400 font-bold">${rep.id}</span>
                <span class="text-xs font-bold px-2 py-0.5 rounded-full ${rep.status === 'Resolved' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}">${rep.status}</span>
            </div>
            <h4 class="text-base font-bold text-white">${rep.problem_type}</h4>
            <p class="text-xs text-slate-300"><i class="fa-solid fa-location-dot text-red-400"></i> ${rep.location}</p>
            <p class="text-xs text-slate-400 mt-1">${rep.description}</p>
        </div>
    `).join('');
}

function renderChallengesGrid() {
    const container = document.getElementById('challenges-grid');
    if (!container) return;

    container.innerHTML = currentChallenges.map(ch => {
        const pct = Math.round((ch.current_kg / ch.target_kg) * 100);
        return `
            <div class="glass-panel p-5">
                <div class="flex items-center justify-between mb-2">
                    <span class="text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full"><i class="fa-solid fa-flag"></i> Neighborhood Drive</span>
                    <span class="text-xs text-slate-400 font-semibold">${ch.days_left} Days Left</span>
                </div>
                <h3 class="text-lg font-bold text-white mb-1">${ch.title}</h3>
                <p class="text-xs text-slate-400 mb-3">Reward Badge: <span class="text-amber-400 font-bold">${ch.reward_badge}</span></p>

                <div class="w-full bg-slate-900 rounded-full h-3 mb-2 border border-slate-800 overflow-hidden">
                    <div class="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full rounded-full" style="width: ${pct}%"></div>
                </div>

                <div class="flex justify-between text-xs font-bold text-slate-300">
                    <span>${ch.current_kg} kg collected</span>
                    <span>Goal: ${ch.target_kg} kg (${pct}%)</span>
                </div>
            </div>
        `;
    }).join('');
}
