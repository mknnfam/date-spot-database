/* ============================================
   Utils — Helper functions
   ============================================ */

const Utils = {
    /* ---- Sanitize a string for safe HTML display ---- */
    sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    },

    /* ---- Format ISO date to readable ---- */
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        if (isNaN(date)) return '';
        return date.toLocaleDateString('en-MY', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    },

    /* ---- Haversine distance in km ---- */
    calculateDistance(lat1, lon1, lat2, lon2) {
        if (!lat1 || !lon1 || !lat2 || !lon2) return null;
        const R = 6371;
        const toRad = (deg) => deg * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLon = toRad(lon2 - lon1);
        const a = Math.sin(dLat/2)**2 +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
        return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
    },

    /* ---- Google Maps search URL ---- */
    getGoogleMapsUrl(address) {
        if (!address) return '#';
        return `https://www.google.com/maps/search/${encodeURIComponent(address)}`;
    },

    /* ---- Geocode via Nominatim with rate limiting ---- */
    _geocodeQueue: Promise.resolve(),
    _geocodeLastCall: 0,

    async geocodeAddress(address) {
        if (!address || !address.trim()) return null;

        /* Enforce 1 req/sec rate limit */
        const now = Date.now();
        const wait = Math.max(0, 1100 - (now - this._geocodeLastCall));
        if (wait > 0) {
            await new Promise(r => setTimeout(r, wait));
        }

        try {
            this._geocodeLastCall = Date.now();
            const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
            const resp = await fetch(url, {
                headers: {
                    'User-Agent': 'DateSpotDatabase/1.0',
                    'Accept': 'application/json'
                }
            });
            if (!resp.ok) {
                console.warn('Nominatim returned', resp.status);
                return null;
            }
            const data = await resp.json();
            if (data && data.length > 0) {
                return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
            }
        } catch (err) {
            console.error('Geocoding error:', err);
        }
        return null;
    },

    /* ---- Get user location via browser API ---- */
    getUserLocation() {
        return new Promise(resolve => {
            if (!navigator.geolocation) {
                resolve({ lat: 3.1390, lng: 101.6869 }); // fallback KL
                return;
            }
            navigator.geolocation.getCurrentPosition(
                pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                () => resolve({ lat: 3.1390, lng: 101.6869 }),
                { timeout: 8000, enableHighAccuracy: false }
            );
        });
    },

    /* ---- Toast notification ---- */
    toast(message, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.textContent = message;
        container.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    },

    /* ---- Confirm dialog (returns Promise<bool>) ---- */
    confirm(message, title = 'Are you sure?') {
        return new Promise(resolve => {
            const overlay = document.createElement('div');
            overlay.className = 'confirm-overlay';
            overlay.innerHTML = `
                <div class="confirm-box">
                    <h3>${this.sanitize(title)}</h3>
                    <p>${this.sanitize(message)}</p>
                    <div class="confirm-actions">
                        <button class="btn-cancel">Cancel</button>
                        <button class="btn-confirm">Confirm</button>
                    </div>
                </div>`;
            document.body.appendChild(overlay);
            overlay.querySelector('.btn-cancel').onclick = () => {
                overlay.remove(); resolve(false);
            };
            overlay.querySelector('.btn-confirm').onclick = () => {
                overlay.remove(); resolve(true);
            };
            overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
        });
    },

    /* ---- Escape for use in HTML data attributes ---- */
    escAttr(str) {
        return String(str).replace(/['"]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
};
