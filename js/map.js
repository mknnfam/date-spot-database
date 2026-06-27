/* ============================================
   Map — Leaflet map with MarkerCluster
   ============================================ */

const MapManager = {
    map: null,
    markers: {},          // id -> L.marker
    markerCluster: null,
    userMarker: null,
    userLocation: null,

    async init() {
        this.userLocation = await Utils.getUserLocation();

        this.map = L.map('map', {
            center: [this.userLocation.lat, this.userLocation.lng],
            zoom: 12,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap',
            maxZoom: 19
        }).addTo(this.map);

        /* MarkerCluster layer */
        this.markerCluster = L.markerClusterGroup({
            chunkedLoading: true,
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false
        });
        this.map.addLayer(this.markerCluster);

        /* Blue user-marker */
        const blueIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });

        this.userMarker = L.marker([this.userLocation.lat, this.userLocation.lng], {
            icon: blueIcon,
            title: 'Your Location',
            zIndexOffset: 1000
        }).addTo(this.map);
        this.userMarker.bindPopup('<b>📍 You are here</b>');

        document.getElementById('user-location-indicator').classList.remove('hidden');

        this._loadAll();
    },

    /* ---- Load all locations from Storage ---- */
    _loadAll() {
        Storage.getAll().forEach(loc => {
            if (loc.lat && loc.lng) {
                this._addMarker(loc);
            }
        });
    },

    /* ---- Add a single marker (internal) ---- */
    _addMarker(location) {
        const { id, name, category, lat, lng, yourRating } = location;
        if (!lat || !lng) return;

        const color = (!yourRating || yourRating < 1) ? 'red'
                    : yourRating >= 4 ? 'green'
                    : yourRating >= 3 ? 'orange' : 'red';

        const icon = L.icon({
            iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
            iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
        });

        const marker = L.marker([lat, lng], { icon, title: name });

        /* Build popup — no inline JS, just data-id */
        const s = Utils.sanitize;
        const safeName = s(name);
        const safeCat = s(category || '');
        const herR = location.herRating || '-';

        marker.bindPopup(`
            <div style="min-width:180px">
                <h3 style="font-weight:700;font-size:1rem;margin-bottom:2px">${safeName}</h3>
                <p style="font-size:0.85rem;color:#6b7280;margin-bottom:6px">${safeCat}</p>
                <p style="font-size:0.85rem;margin-bottom:8px">
                    ⭐ Your: ${yourRating || '-'} | Her: ${herR}
                </p>
                <button class="popup-view-btn" data-id="${Utils.escAttr(id)}"
                    style="background:#3b82f6;color:white;border:none;padding:6px 14px;border-radius:8px;font-size:0.8rem;cursor:pointer">
                    View Details
                </button>
            </div>
        `);

        marker.on('popupopen', () => {
            /* Attach click listener after popup is in DOM (delegation-safe) */
            setTimeout(() => {
                const btn = document.querySelector('.popup-view-btn');
                if (btn) {
                    btn.onclick = (e) => {
                        e.stopPropagation();
                        const locId = btn.dataset.id;
                        if (locId && typeof App !== 'undefined' && App.selectLocation) {
                            App.selectLocation(locId);
                        }
                    };
                }
            }, 0);
        });

        this.markers[id] = marker;
        this.markerCluster.addLayer(marker);
    },

    /* ---- Public: add a new marker ---- */
    addMarker(location) {
        this._addMarker(location);
    },

    /* ---- Remove a marker ---- */
    removeMarker(id) {
        if (this.markers[id]) {
            this.markerCluster.removeLayer(this.markers[id]);
            delete this.markers[id];
        }
    },

    /* ---- Fly to a location ---- */
    flyTo(lat, lng) {
        if (this.map) this.map.flyTo([lat, lng], 16, { duration: 1 });
    },

    /* ---- Invalidate map size (on tab switch) ---- */
    refresh() {
        setTimeout(() => {
            if (this.map) this.map.invalidateSize();
        }, 150);
    }
};
