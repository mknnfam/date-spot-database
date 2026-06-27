# ❤ Date Spot Database

A mobile-first web app to manage date locations, powered by **Google Sheets** as the database via **Google Apps Script**.

## Architecture

```
Web App (HTML/JS) → Google Apps Script API → Google Sheets
                         ↓
                 LocalStorage (cache)
```

- **All data lives in Google Sheets** — you can edit it directly
- **Apps Script** acts as the REST API bridge
- **LocalStorage** is a read cache for speed (data syncs on every write)
- **Works offline** — cached data still shows if you lose connection

---

## Setup (15 minutes)

### Step 0: Set your PIN (before deploying)

Open `js/config.js` and change the PIN:

```js
ACCESS_PIN: '1234',   // Change this to any 4-digit number
LOCK_MESSAGE: 'Enter PIN to access'  // Optional message on lock screen
```

Your wife just needs to know the same PIN. Anyone else hitting the URL sees a locked screen.
Set `ACCESS_PIN: ''` to disable the lock.

### Step 1: Create the Google Sheet

1. Go to [sheets.new](https://sheets.new)
2. Rename the sheet tab (bottom) to **DateSpots**
3. In **Row 1**, paste these column headers:

```
id	      name	    address	    area	    category	    price
openingHours	bestTime	effortLevel	vibe
crowdLevel	privacyLevel	yourRating	herRating
dateVisited	url	photosLink	status	couldRevisit
notes	lat	lng	dateAdded	dateModified
```

> **Tip:** Keep it as one long row. Don't worry about getting it perfect — the Apps Script will create the headers automatically if you leave the sheet blank.

### Step 2: Deploy the Apps Script

1. Open your sheet → **Extensions → Apps Script**
2. Delete any default code
3. Open `apps-script/Code.gs` from this project and **paste the entire file**
4. Click the **Save** icon (💾)
5. Click **Deploy → New deployment**
6. Set:
   - **Type:** Web app
   - **Execute as:** Me
   - **Who has access:** Anyone
7. Click **Deploy**
8. **Copy the Web App URL** (you'll need it next)

### Step 3: Generate an API Token

1. Open your browser's DevTools console (`F12` → Console)
2. Type: `crypto.randomUUID()` and press Enter
3. Copy the generated UUID (looks like `"a1b2c3d4-..."`)

### Step 4: Configure the Web App

1. Open `js/config.js` in this project
2. Paste your Apps Script URL:
   ```js
   APP_SCRIPT_URL: 'https://script.google.com/macros/s/.../exec'
   ```
3. Paste your API token:
   ```js
   API_TOKEN: 'your-generated-uuid-here'
   ```

4. Open `apps-script/Code.gs` and update the token:
   ```js
   API_TOKEN: 'your-generated-uuid-here'
   ```

5. **Redeploy the Apps Script** (Deploy → Manage → Edit → New version → Deploy)

### Step 5: Deploy the Web App

If you haven't already cloned/pushed to GitHub:

```bash
cd /opt/data/date-spot-database
npm install
npm run dev        # Test locally at http://localhost:8080
```

To deploy to GitHub Pages:

```bash
git init
git add .
git commit -m "Date Spot Database with Google Sheets backend"
git remote add origin https://github.com/YOUR_USERNAME/date-spot-database.git
git push -u origin main
```

Then enable GitHub Pages in your repo settings.

---

## Features

- **PIN access** — only people who know the PIN can use the app
- **CSV import** — upload your Notion CSV export directly (column names auto-mapped)
- **Add locations** — form with all fields (name, address, category, price, vibe, ratings, etc.)
- **Interactive map** — Leaflet + OpenStreetMap with clustered markers
- **List view** — search, filter by status/category, delete
- **Stats dashboard** — total spots, visited count, avg rating, estimated spend, category breakdown
- **Dark mode** — manual toggle, remembers preference
- **Mobile-first** — bottom nav, touch-friendly, responsive
- **Google Sheets powered** — edit data directly in your sheet
- **Works offline** — cached data available without internet

---

## File Structure

```
date-spot-database/
├── apps-script/
│   └── Code.gs              ← Google Apps Script (deploy to Google)
├── css/
│   └── styles.css            ← Custom styles + dark mode
├── js/
│   ├── config.js             ← YOUR Apps Script URL + token (edit this!)
│   ├── utils.js              ← Geocoding, sanitize, toast, confirm
│   ├── storage.js            ← API client + LocalStorage cache
│   ├── map.js                ← Leaflet map + marker clustering
│   ├── form.js               ← Add/edit form handling
│   └── app.js                ← Main orchestrator
├── index.html                ← Main HTML
├── package.json              ← Dependencies
└── .gitignore
```

---

## API Reference (Apps Script Endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `?token=...` | Get all locations |
| `GET` | `?token=...&id=abc123` | Get one location |
| `POST` | `?token=...` | Add a new location (JSON body) |
| `PUT` | `?token=...` | Update a location (JSON body with id) |
| `DELETE` | `?token=...&id=abc123` | Delete a location |

All responses are JSON. The `token` parameter is required for write operations.

---

## Editing Data Directly in Google Sheets

Since all data lives in your sheet, you can:
- Add rows manually (each row = one location)
- Edit any field directly in the sheet
- Share the sheet with your partner so you both can edit
- The web app reads these changes on next page load

**⚠️ Important:** If editing manually, make sure each row has a unique `id` value. Leave `dateAdded` and `dateModified` blank — the API fills them automatically.

---

## Free Services

| Service | Cost | What it does |
|---------|------|-------------|
| Google Sheets | Free | Database (all your data) |
| Google Apps Script | Free | REST API backend |
| GitHub Pages | Free | Web app hosting |
| Leaflet + OpenStreetMap | Free | Interactive maps |
| Nominatim | Free | Address geocoding |

**Total cost: $0/month**

---

## Troubleshooting

**"Config not loaded" error**
→ Make sure `js/config.js` exists and has your Apps Script URL filled in.

**"Failed to save" error**
→ Check your API token matches between `js/config.js` and `apps-script/Code.gs`
→ Re-deploy the Apps Script after changing the token

**Map not showing**
→ Check browser console (F12) for errors
→ Make sure locations have `lat` and `lng` values

**Data not appearing**
→ Open your Google Sheet — is data there?
→ Check the Apps Script deployment is active
→ Try hard refresh (Ctrl+Shift+R)
