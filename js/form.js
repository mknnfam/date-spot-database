/* ============================================
   Form — Add/edit location form management
   ============================================ */

const FormManager = {
    _geocoding: false,
    _lastCoords: null,

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
                        s.style.color = parseInt(s.dataset.value) <= val ? '#f59e0b' : '#d1d5db';
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

        /* Clear button */
        document.querySelector('.clear-btn')?.addEventListener('click', () => {
            form.reset();
            document.getElementById('crowdValue').textContent = '50';
            document.getElementById('privacyValue').textContent = '50';
            this._lastCoords = null;
            document.getElementById('geocode-status').classList.add('hidden');
            /* Reset stars */
            document.querySelectorAll('.star').forEach(s => {
                s.textContent = '☆';
                s.classList.remove('active');
            });
            /* Reset vibe */
            document.querySelectorAll('.vibe-tag').forEach(t => t.classList.remove('selected'));
            this._updateVibeHidden();
            document.getElementById('f-lat').value = '';
            document.getElementById('f-lng').value = '';
        });
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
        status.className = 'text-xs mt-1 text-blue-500';
        status.textContent = '🔍 Finding location...';
        status.classList.remove('hidden');

        const coords = await Utils.geocodeAddress(address);
        if (coords) {
            this._lastCoords = coords;
            document.getElementById('f-lat').value = coords.lat;
            document.getElementById('f-lng').value = coords.lng;
            status.className = 'text-xs mt-1 text-green-500';
            status.textContent = '✅ Location found!';
        } else {
            this._lastCoords = null;
            status.className = 'text-xs mt-1 text-red-500';
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
                statusEl.className = 'text-xs mt-1 text-blue-500';
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

            const location = await Storage.add({
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

            /* Reset form */
            e.target.reset();
            document.getElementById('crowdValue').textContent = '50';
            document.getElementById('privacyValue').textContent = '50';
            document.querySelectorAll('.star').forEach(s => {
                s.textContent = '☆'; s.classList.remove('active');
            });
            document.querySelectorAll('.vibe-tag').forEach(t => t.classList.remove('selected'));
            this._updateVibeHidden();
            this._lastCoords = null;
            document.getElementById('geocode-status').classList.add('hidden');
            document.getElementById('f-lat').value = '';
            document.getElementById('f-lng').value = '';

            Utils.toast(`✅ "${name}" added!`);

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
