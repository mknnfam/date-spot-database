/* ============================================
   App — Main orchestration
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
            /* Storage.getAll() will fall back to cache */
        }

        /* Init modules */
        await MapManager.init();
        FormManager.init();

        /* Wire tab buttons (top nav) */
        document.querySelectorAll('.tab-btn').forEach(btn => {
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

        /* Dark mode toggle */
        const darkToggle = document.getElementById('dark-toggle');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const saved = localStorage.getItem('ds-dark-mode');
        if (saved === 'true' || (saved === null && prefersDark)) {
            document.documentElement.classList.add('dark');
            darkToggle.textContent = '☀️';
        }
        darkToggle.addEventListener('click', () => {
            const isDark = document.documentElement.classList.toggle('dark');
            localStorage.setItem('ds-dark-mode', isDark);
            darkToggle.textContent = isDark ? '☀️' : '🌙';
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
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

        /* Show target */
        const panel = document.getElementById(`${tab}-view`);
        if (panel) panel.classList.remove('hidden');

        /* Update top nav */
        document.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.tab === tab);
            if (b.dataset.tab === tab) {
                b.className = 'tab-btn active px-5 py-2.5 rounded-lg bg-red-500 text-white font-semibold text-sm transition-all';
            } else {
                const base = 'tab-btn px-5 py-2.5 rounded-lg font-semibold text-sm transition-all';
                b.className = b.classList.contains('bg-green-500')
                    ? `${base} bg-green-500 text-white`
                    : b.classList.contains('bg-purple-500')
                    ? `${base} bg-purple-500 text-white`
                    : `${base} bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200`;
            }
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
            card.className = 'location-card bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 border-red-500';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h3 class="font-bold text-gray-900 dark:text-gray-100">${s(loc.name)}</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400">${s(loc.category || '')}</p>
                    </div>
                    <span class="text-lg">${loc.status === 'Favorites ⭐' ? '⭐' : loc.status === 'Been There ✅' ? '✅' : '⁉'}</span>
                </div>
                <div class="text-sm text-gray-600 dark:text-gray-400 mb-3 space-y-0.5">
                    <p>📍 ${s(loc.area || 'N/A')} ${dist ? `· ${dist} km` : ''}</p>
                    <p>💰 ${s(loc.price || 'N/A')} ${loc.yourRating ? `· ⭐ ${loc.yourRating}` : ''}</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                    ${loc.url ? `<a href="${s(loc.url)}" target="_blank" rel="noopener" class="text-xs text-blue-500 hover:underline">🔗 Website</a>` : ''}
                    ${loc.photosLink ? `<a href="${s(loc.photosLink)}" target="_blank" rel="noopener" class="text-xs text-blue-500 hover:underline">📸 Photos</a>` : ''}
                    <button class="text-xs text-red-500 hover:underline ml-auto delete-loc-btn" data-id="${loc.id}">🗑️ Delete</button>
                    <button class="text-xs text-indigo-500 hover:underline edit-loc-btn" data-id="${loc.id}">✏️ Edit</button>
                </div>
            `;

            /* Click card → fly to map */
            card.addEventListener('click', (e) => {
                if (e.target.closest('a') || e.target.closest('.delete-loc-btn') || e.target.closest('.edit-loc-btn')) return;
                if (loc.lat && loc.lng) {
                    this.switchTab('map');
                    MapManager.flyTo(loc.lat, loc.lng);
                }
            });

            /* Delete button */
            card.querySelector('.delete-loc-btn')?.addEventListener('click', async (e) => {
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
            card.querySelector('.edit-loc-btn')?.addEventListener('click', (e) => {
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
            bar.innerHTML = `
                <div class="flex justify-between text-sm mb-1">
                    <span class="text-gray-700 dark:text-gray-300">${Utils.sanitize(cat)}</span>
                    <span class="font-semibold text-gray-600 dark:text-gray-400">${count}</span>
                </div>
                <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-3">
                    <div class="bg-red-500 h-2.5 rounded-full transition-all duration-500" style="width:${pct}%"></div>
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

    /* ---- PIN Lock Screen (alphanumeric) ---- */
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
                screen.classList.add('opacity-0');
                setTimeout(() => { screen.style.display = 'none'; resolve(); }, 400);
                return;
            }

            let entered = '';
            let isAlpha = false;

            /* Numeric keypad layout (0-9 in phone layout) */
            const NUM_KEYS = ['1','2','3','4','5','6','7','8','9','','0',''];

            /* Alpha keypad layout (A-Z as 3-col rows) */
            const ALPHA_ROWS = [
                ['A','B','C','D','E','F','G','H','I'],
                ['J','K','L','M','N','O','P','Q','R'],
                ['S','T','U','V','W','X','Y','Z','']
            ];

            function buildPad(alpha) {
                padWrap.innerHTML = '';
                const grid = document.createElement('div');
                grid.className = 'grid grid-cols-3 gap-2 max-w-[240px] mx-auto';

                if (alpha) {
                    ALPHA_ROWS.forEach(row => {
                        row.forEach(ch => {
                            if (!ch) {
                                const d = document.createElement('div');
                                grid.appendChild(d);
                                return;
                            }
                            const btn = document.createElement('button');
                            btn.className = 'pin-key w-full aspect-square rounded-2xl bg-gray-100 dark:bg-gray-700 text-lg font-bold text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all';
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
                        btn.className = 'pin-key w-full aspect-square rounded-2xl bg-gray-100 dark:bg-gray-700 text-2xl font-bold text-gray-800 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600 active:scale-95 transition-all';
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
                /* Show up to 12 chars max */
                const max = Math.max(correctPin.length, 8);
                for (let i = 0; i < max; i++) {
                    const box = document.createElement('span');
                    box.className = 'inline-flex items-center justify-center w-8 h-10 rounded-lg border-2 text-lg font-mono font-bold transition-all duration-150';
                    if (i < entered.length) {
                        box.className += ' bg-red-100 dark:bg-red-900 border-red-400 dark:border-red-500 text-red-600 dark:text-red-300';
                        box.textContent = entered[i];
                    } else if (i === entered.length) {
                        box.className += ' border-red-400 dark:border-red-500 bg-white dark:bg-gray-700 animate-pulse';
                        box.textContent = '_';
                    } else {
                        box.className += ' border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700';
                        box.textContent = '';
                    }
                    display.appendChild(box);
                }
            }

            function addChar(ch) {
                if (entered.length >= 12) return;
                entered += ch;
                error.classList.add('hidden');
                renderDisplay();
            }

            function submitPin() {
                if (entered.toUpperCase() === correctPin.toUpperCase()) {
                    sessionStorage.setItem('ds-unlocked', 'true');
                    screen.classList.add('opacity-0');
                    setTimeout(() => { screen.style.display = 'none'; resolve(); }, 400);
                } else {
                    error.classList.remove('hidden');
                    entered = '';
                    renderDisplay();
                }
            }

            /* Event listeners */
            backBtn.addEventListener('click', () => {
                entered = entered.slice(0, -1);
                error.classList.add('hidden');
                renderDisplay();
            });

            enterBtn.addEventListener('click', submitPin);

            modeBtn.addEventListener('click', () => {
                isAlpha = !isAlpha;
                modeBtn.textContent = isAlpha ? '123' : 'ABC';
                buildPad(isAlpha);
            });

            /* Keyboard input — type directly */
            document.addEventListener('keydown', function _keyHandler(e) {
                const key = e.key;
                if (key === 'Enter') {
                    e.preventDefault();
                    submitPin();
                } else if (key === 'Backspace') {
                    e.preventDefault();
                    entered = entered.slice(0, -1);
                    error.classList.add('hidden');
                    renderDisplay();
                } else if (key.length === 1 && /^[a-zA-Z0-9]$/.test(key)) {
                    e.preventDefault();
                    addChar(key);
                }
            });

            /* Init */
            buildPad(false);
            renderDisplay();
            error.classList.add('hidden');
            screen.style.display = 'flex';
            screen.classList.remove('opacity-0');
        });
    }
};

/* ---- Boot ---- */
document.addEventListener('DOMContentLoaded', () => App.init());
