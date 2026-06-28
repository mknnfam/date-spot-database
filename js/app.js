/* ============================================
   App — Main orchestration (Liquid Glass UI)
   ============================================ */

const App = {
    currentTab: 'map',

    async init() {
        console.log('❤ Date Spot Database initializing...');

        /* PIN gate — block app until PIN is entered */
        if (CONFIG.ACCESS_PIN && CONFIG.ACCESS_PIN.length > 0) {
            await this._lockScreen();
        }

        /* Load data from Google Sheets first */
        try {
            await Storage.init();
            console.log(`Loaded ${Storage.getAll().length} locations from Google Sheets`);
        } catch (err) {
            console.warn('Could not reach Google Sheets, using local cache:', err.message);
        }

        /* Init modules */
        await MapManager.init();
        FormManager.init();

        /* Wire tab buttons (top nav) */
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        /* Wire bottom nav */
        document.querySelectorAll('.bottom-tab').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        /* Search */
        document.getElementById('search-box').addEventListener('input', () => this._renderList());

        /* Filters */
        document.getElementById('filter-status').addEventListener('change', () => this._renderList());
        document.getElementById('filter-category').addEventListener('change', () => this._renderList());

        /* Export / Import */
        document.getElementById('export-btn').addEventListener('click', () => Storage.exportJSON());
        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', (e) => {
            if (e.target.files[0]) Storage.importFile(e.target.files[0]);
            e.target.value = '';
        });

        /* Dark mode toggle (kept for compatibility — always dark now, but toggle works) */
        const darkToggle = document.getElementById('dark-toggle');
        darkToggle.textContent = '🌙';
        darkToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('ds-dark-mode', isDark);
            darkToggle.textContent = isDark ? '🌙' : '☀️';
        });

        /* Initial render */
        this._renderList();
        this._renderStats();

        console.log('❤ App ready!');
    },

    /* ---- Tab switching ---- */
    switchTab(tab) {
        this.currentTab = tab;

        /* Hide all content panels */
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

        /* Show target */
        const panel = document.getElementById(`${tab}-view`);
        if (panel) {
            panel.classList.remove('hidden');
            panel.classList.add('active');
        }

        /* Update top nav */
        document.querySelectorAll('.nav-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tab);
        });

        /* Update bottom nav */
        document.querySelectorAll('.bottom-tab').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tab);
        });

        /* Per-tab side-effects */
        if (tab === 'map') MapManager.refresh();
        if (tab === 'list') this._renderList();
        if (tab === 'stats') this._renderStats();
    },

    /* ---- Render location list with search & filters ---- */
    _renderList() {
        const query = document.getElementById('search-box').value.toLowerCase();
        const filterStatus = document.getElementById('filter-status').value;
        const filterCat = document.getElementById('filter-category').value;

        let locations = Storage.getAll();

        /* Apply filters */
        if (filterStatus !== 'all') locations = locations.filter(l => l.status === filterStatus);
        if (filterCat !== 'all') locations = locations.filter(l => l.category === filterCat);
        if (query) {
            locations = locations.filter(l =>
                (l.name || '').toLowerCase().includes(query) ||
                (l.area || '').toLowerCase().includes(query) ||
                (l.category || '').toLowerCase().includes(query)
            );
        }

        const container = document.getElementById('locations-list');
        const empty = document.getElementById('list-empty');
        container.innerHTML = '';

        if (!locations.length) {
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        locations.forEach(loc => {
            const s = Utils.sanitize;
            const uLoc = MapManager.userLocation;
            const dist = uLoc ? Utils.calculateDistance(uLoc.lat, uLoc.lng, loc.lat || 0, loc.lng || 0) : null;

            const card = document.createElement('div');
            card.className = 'location-card';
            card.innerHTML = `
                <div class="card-header">
                    <div>
                        <h3 class="card-name">${s(loc.name)}</h3>
                        <p class="card-category">${s(loc.category || '')}</p>
                    </div>
                    <span class="card-status-badge">${loc.status === 'Favorites ⭐' ? '⭐' : loc.status === 'Been There ✅' ? '✅' : '⁉'}</span>
                </div>
                <div class="card-details">
                    <p>📍 ${s(loc.area || 'N/A')} ${dist ? `· ${dist} km` : ''}</p>
                    <p>💰 ${s(loc.price || 'N/A')} ${loc.yourRating ? `· ⭐ ${loc.yourRating}` : ''}</p>
                </div>
                <div class="card-actions">
                    ${loc.url ? `<a href="${s(loc.url)}" target="_blank" rel="noopener" class="card-link">🔗 Website</a>` : ''}
                    ${loc.photosLink ? `<a href="${s(loc.photosLink)}" target="_blank" rel="noopener" class="card-link">📸 Photos</a>` : ''}
                    <button class="card-action-btn edit-btn" data-id="${loc.id}">✏️ Edit</button>
                    <button class="card-action-btn delete-btn" data-id="${loc.id}">🗑️ Delete</button>
                </div>
            `;

            /* Click card → fly to map */
            card.addEventListener('click', (e) => {
                if (e.target.closest('a') || e.target.closest('.delete-btn') || e.target.closest('.edit-btn')) return;
                if (loc.lat && loc.lng) {
                    this.switchTab('map');
                    MapManager.flyTo(loc.lat, loc.lng);
                }
            });

            /* Delete button */
            card.querySelector('.delete-btn')?.addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirmed = await Utils.confirm(`Delete "${loc.name}"?`, 'Delete Location');
                if (confirmed) {
                    try {
                        await Storage.remove(loc.id);
                        MapManager.removeMarker(loc.id);
                        Utils.toast(`"${loc.name}" deleted`);
                        this._renderList();
                        this._renderStats();
                    } catch (err) {
                        Utils.toast('Failed to delete from Google Sheets', 'error');
                    }
                }
            });

            /* Edit button */
            card.querySelector('.edit-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                const locData = Storage.get(loc.id);
                if (locData) {
                    this.switchTab('add');
                    FormManager.editLocation(locData);
                }
            });

            container.appendChild(card);
        });
    },

    /* ---- Render stats dashboard ---- */
    _renderStats() {
        const stats = Storage.getStats();
        document.getElementById('stat-total').textContent = stats.total;
        document.getElementById('stat-visited').textContent = stats.visited;
        document.getElementById('stat-avgRating').textContent = stats.avgRating;
        document.getElementById('stat-spent').textContent = `RM${stats.spent.toLocaleString()}`;

        const container = document.getElementById('stat-categories');
        container.innerHTML = '';
        const entries = Object.entries(stats.categories).sort((a, b) => b[1] - a[1]);
        const maxCount = entries.length ? entries[0][1] : 1;

        entries.forEach(([cat, count]) => {
            const pct = (count / maxCount) * 100;
            const bar = document.createElement('div');
            bar.className = 'category-bar-wrap';
            bar.innerHTML = `
                <div class="category-bar-header">
                    <span class="cat-name">${Utils.sanitize(cat)}</span>
                    <span class="cat-count">${count}</span>
                </div>
                <div class="category-bar">
                    <div class="category-bar-fill" style="width:${pct}%"></div>
                </div>
            `;
            container.appendChild(bar);
        });
    },

    /* ---- Called from map popup button ---- */
    selectLocation(id) {
        const loc = Storage.get(id);
        if (loc && loc.lat && loc.lng) {
            this.switchTab('map');
            MapManager.flyTo(loc.lat, loc.lng);
            const marker = MapManager.markers[id];
            if (marker) marker.openPopup();
        }
    },

    /* ---- Refresh list + stats + map after data change ---- */
    refreshAll() {
        this._renderList();
        this._renderStats();
        MapManager.reload();
    },

    /* ---- PIN Lock Screen (alphanumeric) - Liquid Glass styled ---- */
    _lockScreen() {
        return new Promise(resolve => {
            const screen = document.getElementById('lock-screen');
            const display = document.getElementById('pin-display');
            const padWrap = document.getElementById('pin-pad-wrap');
            const error = document.getElementById('pin-error');
            const msg = document.getElementById('lock-message');
            const modeBtn = document.getElementById('pin-mode');
            const backBtn = document.getElementById('pin-backspace');
            const enterBtn = document.getElementById('pin-enter');
            const correctPin = String(CONFIG.ACCESS_PIN);

            msg.textContent = CONFIG.LOCK_MESSAGE || 'Enter PIN to access';

            if (sessionStorage.getItem('ds-unlocked') === 'true') {
                screen.style.display = 'none';
                resolve();
                return;
            }

            let entered = '';
            let isAlpha = false;

            const NUM_KEYS = ['1','2','3','4','5','6','7','8','9','','0',''];

            const ALPHA_ROWS = [
                ['A','B','C','D','E','F','G','H','I'],
                ['J','K','L','M','N','O','P','Q','R'],
                ['S','T','U','V','W','X','Y','Z','']
            ];

            function buildPad(alpha) {
                padWrap.innerHTML = '';
                const grid = document.createElement('div');
                grid.className = 'pin-keypad';

                if (alpha) {
                    ALPHA_ROWS.forEach(row => {
                        row.forEach(ch => {
                            if (!ch) {
                                const d = document.createElement('div');
                                grid.appendChild(d);
                                return;
                            }
                            const btn = document.createElement('button');
                            btn.className = 'pin-key';
                            btn.dataset.key = ch;
                            btn.textContent = ch;
                            btn.addEventListener('click', () => addChar(ch));
                            grid.appendChild(btn);
                        });
                    });
                } else {
                    NUM_KEYS.forEach(k => {
                        if (!k) {
                            const d = document.createElement('div');
                            grid.appendChild(d);
                            return;
                        }
                        const btn = document.createElement('button');
                        btn.className = 'pin-key num-key';
                        btn.dataset.key = k;
                        btn.textContent = k;
                        btn.addEventListener('click', () => addChar(k));
                        grid.appendChild(btn);
                    });
                }
                padWrap.appendChild(grid);
            }

            function renderDisplay() {
                display.innerHTML = '';
                const max = Math.max(correctPin.length, 8);
                for (let i = 0; i < max; i++) {
                    const box = document.createElement('span');
                    box.className = 'pin-box';
                    if (i < entered.length) {
                        box.classList.add('filled');
                        box.textContent = entered[i];
                    } else if (i === entered.length) {
                        box.classList.add('cursor');
                        box.textContent = '_';
                    } else {
                        box.classList.add('empty');
                        box.textContent = '';
                    }
                    display.appendChild(box);
                }
            }

            function addChar(ch) {
                if (entered.length >= 12) return;
                entered += ch;
                error.style.display = 'none';
                renderDisplay();
            }

            function submitPin() {
                if (entered.toUpperCase() === correctPin.toUpperCase()) {
                    sessionStorage.setItem('ds-unlocked', 'true');
                    screen.style.display = 'none';
                    resolve();
                } else {
                    error.style.display = 'block';
                    entered = '';
                    renderDisplay();
                }
            }

            backBtn.addEventListener('click', () => {
                entered = entered.slice(0, -1);
                error.style.display = 'none';
                renderDisplay();
            });

            enterBtn.addEventListener('click', submitPin);

            modeBtn.addEventListener('click', () => {
                isAlpha = !isAlpha;
                modeBtn.textContent = isAlpha ? '123' : 'ABC';
                buildPad(isAlpha);
            });

            document.addEventListener('keydown', function _keyHandler(e) {
                const key = e.key;
                if (key === 'Enter') {
                    e.preventDefault();
                    submitPin();
                } else if (key === 'Backspace') {
                    e.preventDefault();
                    entered = entered.slice(0, -1);
                    error.style.display = 'none';
                    renderDisplay();
                } else if (key.length === 1 && /^[a-zA-Z0-9]$/.test(key)) {
                    e.preventDefault();
                    addChar(key);
                }
            });

            buildPad(false);
            renderDisplay();
            error.style.display = 'none';
            screen.style.display = 'flex';

            const hiddenInput = document.getElementById('pin-hidden-input');
            if (hiddenInput) {
                setTimeout(() => hiddenInput.focus(), 300);
                display.addEventListener('click', () => hiddenInput.focus());
                hiddenInput.addEventListener('input', function _onInput() {
                    const val = this.value.replace(/[^a-zA-Z0-9]/g, '');
                    if (val.length > 0) {
                        const newChars = val.slice(entered.length);
                        for (const ch of newChars) {
                            if (entered.length < 12) addChar(ch.toUpperCase());
                        }
                    }
                    this.value = '';
                });
            }
        });
    }
};

/* ---- Boot ---- */
document.addEventListener('DOMContentLoaded', () => App.init());
