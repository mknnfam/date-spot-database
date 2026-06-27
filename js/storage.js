/* ============================================
   Storage — Google Sheets + LocalStorage cache
   ============================================
   Source of truth: Google Sheets (via Apps Script)
   Cache: LocalStorage (for speed + offline fallback)
*/

const CACHE_KEY = 'dateSpotDatabase_cache';
const API_BASE = CONFIG.APP_SCRIPT_URL;
const API_TOKEN = CONFIG.API_TOKEN;

const Storage = {
    _ready: false,
    _loading: null,

    /* ---- Init: fetch from API on first load ---- */
    async init(forceRefresh = false) {
        if (this._loading) return this._loading;

        if (!forceRefresh && this._ready) return;
        if (!forceRefresh && this._fromCache().length > 0) {
            this._ready = true;
            return;
        }

        this._loading = this._fetchAll();
        try {
            await this._loading;
        } finally {
            this._loading = null;
        }
    },

    /* ---- Get all locations (from cache, fast) ---- */
    getAll() {
        if (!this._ready) {
            /* Try cache anyway; caller can await init() first */
            const cached = this._fromCache();
            if (cached.length) return cached;
        }
        return this._fromCache();
    },

    /* ---- Get one location ---- */
    get(id) {
        return this.getAll().find(l => l.id === id) || null;
    },

    /* ---- Add a new location (API + cache) ---- */
    async add(location) {
        const payload = { ...location };
        if (payload.id) delete payload.id;
        if (payload.dateAdded) delete payload.dateAdded;

        const result = await this._apiCall('POST', payload);
        if (!result) throw new Error('Failed to save to Google Sheets');

        const loc = { ...payload, ...result };
        const list = this._fromCache();
        list.push(loc);
        this._toCache(list);
        this._ready = true;
        return loc;
    },

    /* ---- Update a location (API + cache) ---- */
    async update(id, data) {
        const result = await this._apiCall('POST', { _action: 'update', id, ...data });
        if (!result) throw new Error('Failed to update in Google Sheets');

        const list = this._fromCache();
        const idx = list.findIndex(l => l.id === id);
        if (idx !== -1) {
            list[idx] = { ...list[idx], ...result };
            this._toCache(list);
        }
        return true;
    },

    /* ---- Delete a location (API + cache) ---- */
    async remove(id) {
        const result = await this._apiCall('POST', { _action: 'delete', id });
        if (!result) throw new Error('Failed to delete from Google Sheets');

        const list = this._fromCache().filter(l => l.id !== id);
        this._toCache(list);
    },

    /* ---- Refresh cache from API ---- */
    async refresh() {
        const data = await this._fetchAll();
        if (data) {
            this._toCache(data);
            this._ready = true;
        }
        return this._fromCache();
    },

    /* ---- Export as JSON (from cache) ---- */
    exportJSON() {
        const list = this.getAll();
        if (!list.length) { Utils.toast('No data to export', 'info'); return; }
        const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
        this._download(blob, 'date-spots.json');
        Utils.toast('Exported successfully!');
    },

    /* ---- Import file (JSON or CSV) ---- */
    async importFile(file) {
        if (file.name.endsWith('.csv')) {
            return this.importCSV(file);
        }
        return this.importJSON(file);
    },

    /* ---- Import JSON into API ---- */
    async importJSON(file) {
        const text = await file.text();
        let data;
        try {
            data = JSON.parse(text);
            if (!Array.isArray(data)) throw new Error('Must be array');
            if (!data.length) { Utils.toast('File empty', 'error'); return; }
            for (let i = 0; i < data.length; i++) {
                if (!data[i].name || !data[i].address) {
                    Utils.toast(`Entry #${i+1} missing name/address`, 'error');
                    return;
                }
            }
        } catch (err) {
            Utils.toast('Invalid JSON file', 'error');
            return;
        }

        const confirmed = await Utils.confirm(
            `This will ADD ${data.length} locations to your Google Sheet. Existing data stays.`,
            'Import Data?'
        );
        if (!confirmed) return;

        let count = 0;
        for (const loc of data) {
            try {
                await this.add(loc);
                count++;
            } catch (err) {
                console.error('Import error on:', loc.name, err);
            }
        }

        await this.refresh();
        Utils.toast(`✅ Imported ${count}/${data.length} locations!`);
        if (typeof App !== 'undefined') App.refreshAll();
    },

    /* ---- Import CSV with column mapping ---- */
    async importCSV(file) {
        const text = await file.text();
        const lines = text.split(/\r?\n/).filter(l => l.trim());

        if (lines.length < 2) {
            Utils.toast('CSV file has no data rows', 'error');
            return;
        }

        const headers = this._parseCSVLine(lines[0]);

        const confirmed = await Utils.confirm(
            `Found ${lines.length - 1} rows in your CSV. This will ADD them to your Google Sheet.`,
            'Import CSV?'
        );
        if (!confirmed) return;

        /* Column name mapping (your Notion columns -> our field names) */
        const columnMap = {
            'name': 'name', 'Name': 'name',
            'address': 'address', 'Location': 'address',
            'area': 'area', 'Area': 'area',
            'category': 'category', 'Category': 'category',
            'price': 'price', 'Price': 'price', 'Price Range': 'price',
            'openinghours': 'openingHours', 'Opening Hours': 'openingHours',
            'besttime': 'bestTime', 'Best Time': 'bestTime',
            'vibe': 'vibe', 'Vibe': 'vibe',
            'crowdlevel': 'crowdLevel', 'Crowd Level': 'crowdLevel',
            'privacy': 'privacyLevel', 'Privacy': 'privacy', 'Privacy Level': 'privacyLevel',
            'effortlevel': 'effortLevel', 'Effort Level': 'effortLevel',
            'yourrating': 'yourRating', 'Your Rating': 'yourRating',
            'herrating': 'herRating', 'Her Rating': 'herRating',
            'url': 'url', 'URL': 'url',
            'status': 'status', 'Status': 'status',
            'notes': 'notes', 'Notes': 'notes',
            'date': 'dateAdded', 'Date': 'dateAdded', 'Date Added': 'dateAdded',
            'photoslink': 'photosLink', 'google photos link': 'photosLink', 'Photos Link': 'photosLink',
            'couldrevisit': 'couldRevisit', 'Could Revisit': 'couldRevisit',
            'lat': 'lat', 'Lat': 'lat', 'latitude': 'lat',
            'lng': 'lng', 'Lng': 'lng', 'longitude': 'lng', 'lon': 'lng',
            'rating': 'yourRating',
            'location': 'address',
            'google maps link': 'googleMapsLink',
            'opening hours': 'openingHours',
            'best time': 'bestTime',
            'crowd level': 'crowdLevel',
            'privacy level': 'privacyLevel',
            'effort level': 'effortLevel',
            'your rating': 'yourRating',
            'her rating': 'herRating',
            'could revisit': 'couldRevisit',
            'date added': 'dateAdded',
            'date visited': 'dateVisited',
            'date': 'dateAdded'
        };

        let count = 0;
        for (let i = 1; i < lines.length; i++) {
            const values = this._parseCSVLine(lines[i]);
            const row = {};
            headers.forEach((h, idx) => {
                const mappedKey = columnMap[h.trim()] || h.trim();
                row[mappedKey] = (values[idx] || '').trim();
            });

            /* Skip empty rows */
            if (!row.name && !row.address) continue;

            /* Convert numeric fields */
            if (row.yourRating) row.yourRating = parseFloat(row.yourRating) || 0;
            if (row.herRating) row.herRating = parseFloat(row.herRating) || 0;
            if (row.crowdLevel) row.crowdLevel = parseInt(row.crowdLevel) || 50;
            if (row.privacyLevel) row.privacyLevel = parseInt(row.privacyLevel) || 50;
            if (row.couldRevisit) row.couldRevisit = row.couldRevisit.toLowerCase() === 'yes' || row.couldRevisit === 'true';

            try {
                const result = await this.add(row);
                if (result) count++;
            } catch (err) {
                console.error('CSV import row error:', i, err);
            }
        }

        await this.refresh();
        Utils.toast(`✅ Imported ${count}/${lines.length - 1} locations from CSV!`);
        if (typeof App !== 'undefined') App.refreshAll();
    },

    /* ---- Simple CSV line parser (handles quoted fields) ---- */
    _parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { inQuotes = !inQuotes; continue; }
            if (ch === ',' && !inQuotes) { result.push(current); current = ''; continue; }
            current += ch;
        }
        result.push(current);
        return result;
    },

    /* ---- Stats (from cache) ---- */
    getStats() {
        const list = this.getAll();
        const total = list.length;
        const visited = list.filter(l => l.status === 'Been There ✅' || l.status === 'Favorites ⭐').length;
        const rated = list.filter(l => (Number(l.yourRating) || 0) > 0);
        const avgRating = rated.length
            ? (rated.reduce((s, l) => s + Number(l.yourRating || 0), 0) / rated.length).toFixed(1)
            : '0';

        const priceMap = { 'RM0-50': 25, 'RM50-100': 75, 'RM100-200': 150, 'RM200-300': 250, 'RM300+': 350 };
        const spent = visited.reduce((s, l) => s + (priceMap[l.price] || 0), 0);

        const cats = {};
        list.forEach(l => { const c = l.category || 'Uncategorised'; cats[c] = (cats[c] || 0) + 1; });

        return { total, visited, avgRating: Number(avgRating), spent, categories: cats };
    },

    /* ================ PRIVATE ================ */

    async _fetchAll() {
        return this._apiCall('GET');
    },

    _fromCache() {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    },

    _toCache(list) {
        localStorage.setItem(CACHE_KEY, JSON.stringify(list));
    },

    async _apiCall(method, body = null, params = null) {
        const url = new URL(API_BASE);
        url.searchParams.set('token', API_TOKEN);
        if (method === 'DELETE' && params?.id) url.searchParams.set('id', params.id);
        if (method === 'GET' && params?.id) url.searchParams.set('id', params.id);

        const options = { method, headers: { 'Accept': 'application/json' } };
        if (body && (method === 'POST' || method === 'PUT')) {
            options.body = JSON.stringify(body);
        }

        try {
            const resp = await fetch(url.toString(), options);
            if (!resp.ok) {
                const err = await resp.text();
                console.error(`${method} failed:`, err);
                return null;
            }
            return await resp.json();
        } catch (err) {
            console.error(`${method} error:`, err);
            /* If GET fails, try returning cache */
            if (method === 'GET') {
                const cached = this._fromCache();
                if (cached.length) {
                    console.log('Falling back to cache');
                    return cached;
                }
            }
            throw err;
        }
    },

    _download(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
};
