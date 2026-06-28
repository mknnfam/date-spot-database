/* ============================================
   Form — Add/edit location form management
   Includes "Add with AI" feature
   ============================================ */

const FormManager = {
    _geocoding: false,
    _lastCoords: null,
    _editingId: null,    // set when editing an existing location

    init() {
        const form = document.getElementById('add-location-form');
        form.addEventListener('submit', (e) => this._handleSubmit(e));

        /* Slider live labels */
        const crowd = document.getElementById('f-crowd');
        const priv  = document.getElementById('f-privacy');
        crowd.addEventListener('input', () => { document.getElementById('crowdValue').textContent = crowd.value; });
        priv.addEventListener('input', () => { document.getElementById('privacyValue').textContent = priv.value; });

        /* Geocode on address blur with loading indicator */
        const addrField = document.getElementById('f-address');
        addrField.addEventListener('blur', () => this._geocodeOnBlur());
        addrField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); this._geocodeOnBlur(); }
        });

        /* Star rating click */
        document.querySelectorAll('.star-rating').forEach(container => {
            const stars = container.querySelectorAll('.star');
            const target = document.getElementById(container.dataset.target);
            stars.forEach(star => {
                star.addEventListener('click', () => {
                    const val = parseInt(star.dataset.value);
                    target.value = val;
                    stars.forEach(s => {
                        s.classList.toggle('active', parseInt(s.dataset.value) <= val);
                        s.textContent = parseInt(s.dataset.value) <= val ? '★' : '☆';
                    });
                });
                star.addEventListener('mouseenter', () => {
                    const val = parseInt(star.dataset.value);
                    stars.forEach(s => {
                        s.style.color = parseInt(s.dataset.value) <= val ? '#f59e0b' : 'rgba(255,255,255,0.15)';
                    });
                });
                star.addEventListener('mouseleave', () => {
                    stars.forEach(s => {
                        s.style.color = '';
                    });
                });
            });
        });

        /* Vibe tag toggles */
        document.querySelectorAll('.vibe-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                tag.classList.toggle('selected');
                this._updateVibeHidden();
            });
        });

        /* ---- Clear / reset form ---- */
        document.querySelector('.clear-btn')?.addEventListener('click', () => {
            this._clearForm();
        });

        /* ---- Add with AI button ---- */
        document.getElementById('ai-add-btn')?.addEventListener('click', () => {
            this._openAIModal();
        });
    },

    /* ========== "Add with AI" Feature ========== */

    _openAIModal() {
        /* Remove any existing modal */
        const existing = document.getElementById('ai-modal-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ai-modal-overlay';
        overlay.className = 'ai-modal-overlay';
        overlay.innerHTML = `
            <div class="ai-modal">
                <div class="modal-title">
                    <span>✨</span>
                    <span>Add with AI</span>
                </div>
                <p class="modal-desc">Describe the place you want to add. AI will find the details and pre-fill the form.</p>
                <div class="modal-input-wrap">
                    <input type="text" id="ai-query-input" class="glass-input" placeholder='e.g., "cafe in Bangsar" or "romantic restaurant near KLCC"' autofocus>
                </div>
                <button id="ai-submit-btn" class="glass-btn glass-btn-primary" style="width:100%;padding:12px;font-size:0.9rem;display:flex;align-items:center;justify-content:center;gap:8px;">
                    <span>✨ Look Up</span>
                </button>
                <div id="ai-loading" class="modal-loading hidden">
                    <div class="iridescent-spinner" style="margin:0 auto;"></div>
                    <p class="loading-text">Searching for place details...</p>
                </div>
                <div id="ai-error" class="hidden" style="margin-top:12px;padding:10px 14px;background:rgba(248,113,113,0.1);border:1px solid rgba(248,113,113,0.2);border-radius:var(--radius-sm);color:var(--red);font-size:0.85rem;"></div>
            </div>
        `;

        document.body.appendChild(overlay);

        /* Close on overlay click */
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.remove();
        });

        /* Submit handler */
        const submitBtn = document.getElementById('ai-submit-btn');
        const queryInput = document.getElementById('ai-query-input');
        const loading = document.getElementById('ai-loading');
        const error = document.getElementById('ai-error');

        function doLookup() {
            const query = queryInput.value.trim();
            if (!query) {
                error.textContent = 'Please describe the place you want to add.';
                error.classList.remove('hidden');
                return;
            }

            submitBtn.classList.add('hidden');
            loading.classList.remove('hidden');
            error.classList.add('hidden');

            const lookupUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://localhost:8080/api/ai-lookup'
                : 'https://6819341f14ea.tail9f46bb.ts.net:8080/api/ai-lookup';

            fetch(lookupUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            })
            .then(resp => {
                if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
                return resp.json();
            })
            .then(data => {
                overlay.remove();
                if (data && data.name) {
                    FormManager._fillFromAI(data);
                } else {
                    FormManager._fillFromAI(data);
                    if (!data.name) {
                        Utils.toast('AI found the area but not all details. Fill in the rest manually.', 'info');
                    }
                }
            })
            .catch(err => {
                loading.classList.add('hidden');
                submitBtn.classList.remove('hidden');
                error.textContent = `Lookup failed: ${err.message}. Check that the AI server is running.`;
                error.classList.remove('hidden');
                console.error('AI lookup error:', err);
            });
        }

        submitBtn.addEventListener('click', doLookup);
        queryInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                doLookup();
            }
        });

        /* Focus input */
        setTimeout(() => queryInput.focus(), 100);
    },

    _fillFromAI(data) {
        /* Clear form first */
        this._clearForm();

        /* Switch to add tab */
        if (typeof App !== 'undefined') App.switchTab('add');

        /* Fill fields */
        if (data.name) document.getElementById('f-name').value = data.name;
        if (data.address) document.getElementById('f-address').value = data.address;
        if (data.area) document.getElementById('f-area').value = data.area;
        if (data.category) {
            /* Try to match category to our options */
            const catOptions = document.getElementById('f-category').options;
            let matched = false;
            for (let i = 0; i < catOptions.length; i++) {
                if (catOptions[i].value.toLowerCase().includes(data.category.toLowerCase()) ||
                    data.category.toLowerCase().includes(catOptions[i].value.toLowerCase())) {
                    document.getElementById('f-category').value = catOptions[i].value;
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                /* Use the value as-is if it contains an emoji prefix pattern */
                document.getElementById('f-category').value = data.category;
            }
        }
        if (data.price) document.getElementById('f-price').value = data.price;
        if (data.openingHours) document.getElementById('f-hours').value = data.openingHours;
        if (data.bestTime) document.getElementById('f-bestTime').value = data.bestTime;
        if (data.effortLevel) document.getElementById('f-effort').value = data.effortLevel;

        /* Vibe — try to match known tags */
        if (data.vibe) {
            const vibes = data.vibe.split(',').map(v => v.trim().toLowerCase());
            document.querySelectorAll('.vibe-tag').forEach(tag => {
                const tagVal = tag.dataset.value.toLowerCase();
                const match = vibes.some(v => tagVal.includes(v) || v.includes(tagVal));
                tag.classList.toggle('selected', match);
            });
            this._updateVibeHidden();
        }

        if (data.crowdLevel) {
            const c = parseInt(data.crowdLevel);
            if (!isNaN(c)) {
                document.getElementById('f-crowd').value = c;
                document.getElementById('crowdValue').textContent = c;
            }
        }
        if (data.privacyLevel) {
            const p = parseInt(data.privacyLevel);
            if (!isNaN(p)) {
                document.getElementById('f-privacy').value = p;
                document.getElementById('privacyValue').textContent = p;
            }
        }

        if (data.url) document.getElementById('f-url').value = data.url;
        if (data.status) document.getElementById('f-status').value = data.status;
        if (data.notes) document.getElementById('f-notes').value = data.notes;

        /* Coordinates */
        if (data.lat && data.lng) {
            const lat = parseFloat(data.lat);
            const lng = parseFloat(data.lng);
            if (!isNaN(lat) && !isNaN(lng)) {
                document.getElementById('f-lat').value = lat;
                document.getElementById('f-lng').value = lng;
                this._lastCoords = { lat, lng };
                const status = document.getElementById('geocode-status');
                status.className = '';
                status.style.cssText = 'font-size:0.72rem;margin-top:4px;color:var(--green);';
                status.textContent = '✅ Location from AI';
                status.classList.remove('hidden');
            }
        }

        /* If no coordinates but we have an address, trigger geocode */
        if (!data.lat && data.address) {
            this._geocodeOnBlur();
        }

        Utils.toast('✨ AI details loaded! Review and save.', 'success');
    },

    /* ---- Fill form with existing location data for editing ---- */
    editLocation(loc) {
        this._editingId = loc.id;
        this._clearForm();

        document.getElementById('f-name').value = loc.name || '';
        document.getElementById('f-address').value = loc.address || '';
        document.getElementById('f-area').value = loc.area || '';
        document.getElementById('f-category').value = loc.category || '';
        document.getElementById('f-price').value = loc.price || '';
        document.getElementById('f-hours').value = loc.openingHours || '';
        document.getElementById('f-bestTime').value = loc.bestTime || '';
        document.getElementById('f-effort').value = loc.effortLevel || '';
        document.getElementById('f-vibe').value = loc.vibe || '';
        document.getElementById('f-crowd').value = loc.crowdLevel || 50;
        document.getElementById('crowdValue').textContent = loc.crowdLevel || 50;
        document.getElementById('f-privacy').value = loc.privacyLevel || 50;
        document.getElementById('privacyValue').textContent = loc.privacyLevel || 50;
        document.getElementById('f-yourRating').value = loc.yourRating || 0;
        document.getElementById('f-herRating').value = loc.herRating || 0;
        document.getElementById('f-dateVisited').value = loc.dateVisited || '';
        document.getElementById('f-url').value = loc.url || '';
        document.getElementById('f-photosLink').value = loc.photosLink || '';
        document.getElementById('f-status').value = loc.status || 'Want to Go ⁉';
        document.getElementById('f-revisit').value = loc.couldRevisit === 'Yes' ? 'Yes' : 'No';
        document.getElementById('f-notes').value = loc.notes || '';
        document.getElementById('f-lat').value = loc.lat || '';
        document.getElementById('f-lng').value = loc.lng || '';
        this._lastCoords = (loc.lat && loc.lng) ? { lat: parseFloat(loc.lat), lng: parseFloat(loc.lng) } : null;

        /* Restore star ratings */
        document.querySelectorAll('.star-rating').forEach(container => {
            const targetId = container.dataset.target;
            const val = targetId === 'f-yourRating' ? (loc.yourRating || 0) : (loc.herRating || 0);
            container.querySelectorAll('.star').forEach(s => {
                const sv = parseInt(s.dataset.value);
                s.classList.toggle('active', sv <= val);
                s.textContent = sv <= val ? '★' : '☆';
            });
        });

        /* Restore vibe tags */
        const vibes = (loc.vibe || '').split(',').map(v => v.trim().toLowerCase());
        document.querySelectorAll('.vibe-tag').forEach(tag => {
            tag.classList.toggle('selected', vibes.includes(tag.dataset.value.toLowerCase()));
        });

        /* Update submit button text */
        document.getElementById('submit-text').textContent = '✏️ Update Location';
        Utils.toast(`Editing "${loc.name}"`, 'info');
    },

    _clearForm() {
        const form = document.getElementById('add-location-form');
        form.reset();
        document.getElementById('crowdValue').textContent = '50';
        document.getElementById('privacyValue').textContent = '50';
        this._lastCoords = null;
        this._editingId = null;
        const geoStatus = document.getElementById('geocode-status');
        geoStatus.classList.add('hidden');
        geoStatus.textContent = '';
        geoStatus.style.cssText = '';
        document.querySelectorAll('.star').forEach(s => {
            s.textContent = '☆';
            s.classList.remove('active');
            s.style.color = '';
        });
        document.querySelectorAll('.vibe-tag').forEach(t => t.classList.remove('selected'));
        this._updateVibeHidden();
        document.getElementById('f-lat').value = '';
        document.getElementById('f-lng').value = '';
        document.getElementById('submit-text').textContent = 'Save Location ❤️';
    },

    _updateVibeHidden() {
        const selected = [];
        document.querySelectorAll('.vibe-tag.selected').forEach(t => {
            selected.push(t.dataset.value);
        });
        document.getElementById('f-vibe').value = selected.join(', ');
    },

    async _geocodeOnBlur() {
        const address = document.getElementById('f-address').value.trim();
        if (!address) return;

        const status = document.getElementById('geocode-status');
        status.className = '';
        status.style.cssText = 'font-size:0.72rem;margin-top:4px;color:var(--accent);';
        status.textContent = '🔍 Finding location...';
        status.classList.remove('hidden');

        const coords = await Utils.geocodeAddress(address);
        if (coords) {
            this._lastCoords = coords;
            document.getElementById('f-lat').value = coords.lat;
            document.getElementById('f-lng').value = coords.lng;
            status.style.cssText = 'font-size:0.72rem;margin-top:4px;color:var(--green);';
            status.textContent = '✅ Location found!';
        } else {
            this._lastCoords = null;
            status.style.cssText = 'font-size:0.72rem;margin-top:4px;color:var(--red);';
            status.textContent = '⚠️ Could not find this address. Check spelling or be more specific.';
        }
    },

    async _handleSubmit(e) {
        e.preventDefault();

        const btn = document.getElementById('submit-btn');
        const text = document.getElementById('submit-text');
        const spinner = document.getElementById('submit-spinner');
        btn.disabled = true;
        text.textContent = 'Saving...';
        spinner.classList.remove('hidden');

        try {
            /* Collect data */
            const name     = document.getElementById('f-name').value.trim();
            const address  = document.getElementById('f-address').value.trim();
            const area     = document.getElementById('f-area').value.trim();
            const category = document.getElementById('f-category').value;
            const price    = document.getElementById('f-price').value;
            const hours    = document.getElementById('f-hours').value.trim();
            const bestTime = document.getElementById('f-bestTime').value;
            const effort   = document.getElementById('f-effort').value;
            const vibe     = document.getElementById('f-vibe').value;
            const crowd    = parseInt(document.getElementById('f-crowd').value);
            const privacy  = parseInt(document.getElementById('f-privacy').value);
            const yourR    = parseFloat(document.getElementById('f-yourRating').value) || 0;
            const herR     = parseFloat(document.getElementById('f-herRating').value) || 0;
            const dVisited = document.getElementById('f-dateVisited').value;
            const url      = document.getElementById('f-url').value.trim();
            const photos   = document.getElementById('f-photosLink').value.trim();
            const status   = document.getElementById('f-status').value;
            const revisit  = document.getElementById('f-revisit').value;
            const notes    = document.getElementById('f-notes').value.trim();

            /* Validate required */
            if (!name) { Utils.toast('Please enter a location name', 'error'); return; }
            if (!address) { Utils.toast('Please enter an address', 'error'); return; }
            if (!category) { Utils.toast('Please select a category', 'error'); return; }
            if (!price) { Utils.toast('Please select a price range', 'error'); return; }

            /* Geocode if not already */
            let coords = this._lastCoords;
            if (!coords || document.getElementById('f-lat').value === '') {
                const statusEl = document.getElementById('geocode-status');
                statusEl.className = '';
                statusEl.style.cssText = 'font-size:0.72rem;margin-top:4px;color:var(--accent);';
                statusEl.textContent = '🔍 Geocoding address...';
                statusEl.classList.remove('hidden');
                coords = await Utils.geocodeAddress(address);
                if (coords) {
                    this._lastCoords = coords;
                    document.getElementById('f-lat').value = coords.lat;
                    document.getElementById('f-lng').value = coords.lng;
                }
            }

            if (!coords) {
                Utils.toast('Could not find coordinates for that address. Check spelling.', 'error');
                return;
            }

            let location;
            if (this._editingId) {
                /* ---- EDIT mode ---- */
                location = await Storage.update(this._editingId, {
                    name, address, area, category, price,
                    openingHours: hours,
                    bestTime, effortLevel: effort,
                    vibe, crowdLevel: crowd, privacyLevel: privacy,
                    yourRating: yourR, herRating: herR,
                    dateVisited: dVisited || null,
                    url, photosLink: photos,
                    status, couldRevisit: revisit === 'Yes',
                    notes,
                    lat: coords.lat,
                    lng: coords.lng
                });

                MapManager.removeMarker(this._editingId);
                MapManager.addMarker({ ...{name, address, category, yourRating: yourR, herRating: herR, lat: coords.lat, lng: coords.lng}, id: this._editingId });

                Utils.toast(`✅ "${name}" updated!`);
                this._editingId = null;
            } else {
                /* ---- ADD mode ---- */
                location = await Storage.add({
                    name, address, area, category, price,
                    openingHours: hours,
                    bestTime, effortLevel: effort,
                    vibe, crowdLevel: crowd, privacyLevel: privacy,
                    yourRating: yourR, herRating: herR,
                    dateVisited: dVisited || null,
                    url, photosLink: photos,
                    status, couldRevisit: revisit === 'Yes',
                    notes,
                    lat: coords.lat,
                    lng: coords.lng
                });

                MapManager.addMarker(location);
                Utils.toast(`✅ "${name}" added!`);
            }

            /* Reset form */
            this._clearForm();

            /* Refresh stats + list, then switch to map */
            if (typeof App !== 'undefined') App.refreshAll();
            this._switchTab('map');
        } finally {
            btn.disabled = false;
            text.textContent = 'Save Location ❤️';
            spinner.classList.add('hidden');
        }
    },

    _switchTab(tabName) {
        if (typeof App !== 'undefined') {
            App.switchTab(tabName);
        }
    }
};
