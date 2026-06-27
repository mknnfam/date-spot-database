/**
 * Date Spot Database — Google Apps Script Backend
 *
 * Deploy this as a Google Apps Script Web App to turn
 * a Google Sheet into a REST API for your date spots.
 *
 * SETUP (5 minutes):
 * 1. Create a new Google Sheet (sheets.new)
 * 2. Set the first row as headers (see HEADERS below)
 * 3. Go to Extensions → Apps Script
 * 4. Paste this entire file
 * 5. Deploy → New deployment → Web app
 * 6. Set "Execute as: Me" and "Who has access: Anyone"
 * 7. Copy the Web App URL → paste into js/config.js
 */

/* ==========================================
   CONFIG — Edit these two values
   ========================================== */

const CONFIG = {
  /* Set a secret token so only YOUR web app can write.
     Generate one: open browser console and type: crypto.randomUUID()
     Then put the same token in js/config.js on your web app. */
  API_TOKEN: 'ds-d158f1b7',

  /* Sheet name (tab at the bottom of your Google Sheet) */
  SHEET_NAME: 'DateSpots'
};

/* ==========================================
   HEADERS — Must match row 1 of your sheet
   ========================================== */

const HEADERS = [
  'id', 'name', 'address', 'area', 'category', 'price',
  'openingHours', 'bestTime', 'effortLevel', 'vibe',
  'crowdLevel', 'privacyLevel', 'yourRating', 'herRating',
  'dateVisited', 'url', 'photosLink', 'status', 'couldRevisit',
  'notes', 'lat', 'lng', 'dateAdded', 'dateModified'
];

/* ==========================================
   ROUTER — Entry point for all HTTP methods
   ========================================== */

function doGet(e) {
  return handleCors(() => {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const locations = rowsToObjects(data);

    if (e && e.parameter && e.parameter.id) {
      const loc = locations.find(r => r.id === e.parameter.id);
      return respond(loc || { error: 'Not found' }, loc ? 200 : 404);
    }

    return respond(locations);
  });
}

function doPost(e) {
  return handleCors(() => {
    authorize(e);
    const body = JSON.parse(e.postData.contents);
    const sheet = getSheet();

    /* Handle delete action */
    if (body._action === 'delete') {
      return doDeleteInternal(sheet, body.id);
    }

    /* Handle update action */
    if (body._action === 'update') {
      return doUpdateInternal(sheet, body);
    }

    const location = {
      id: generateId(),
      name: body.name || '',
      address: body.address || '',
      area: body.area || '',
      category: body.category || '',
      price: body.price || '',
      openingHours: body.openingHours || '',
      bestTime: body.bestTime || '',
      effortLevel: body.effortLevel || '',
      vibe: body.vibe || '',
      crowdLevel: Number(body.crowdLevel) || 0,
      privacyLevel: Number(body.privacyLevel) || 0,
      yourRating: Number(body.yourRating) || 0,
      herRating: Number(body.herRating) || 0,
      dateVisited: body.dateVisited || '',
      url: body.url || '',
      photosLink: body.photosLink || '',
      status: body.status || 'Want to Go ⁉',
      couldRevisit: body.couldRevisit === true || body.couldRevisit === 'Yes' ? 'Yes' : 'No',
      notes: body.notes || '',
      lat: body.lat || '',
      lng: body.lng || '',
      dateAdded: new Date().toISOString(),
      dateModified: new Date().toISOString()
    };

    sheet.appendRow(HEADERS.map(h => location[h] !== undefined ? location[h] : ''));
    return respond(location, 201);
  });
}

function doPut(e) {
  return handleCors(() => {
    authorize(e);
    const body = JSON.parse(e.postData.contents);
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const rows = rowsToObjects(data);

    const idx = rows.findIndex(r => r.id === body.id);
    if (idx === -1) return respond({ error: 'Not found' }, 404);

    /* Merge: keep existing values, overwrite with provided ones */
    const updated = { ...rows[idx], ...body, dateModified: new Date().toISOString() };
    const rowNum = idx + 2; /* +2 because row 1 is headers, 0-indexed */

    HEADERS.forEach((h, col) => {
      sheet.getRange(rowNum, col + 1).setValue(updated[h] !== undefined ? updated[h] : '');
    });

    return respond(updated);
  });
}

function doDelete(e) {
  return handleCors(() => {
    authorize(e);
    const id = e && e.parameter && e.parameter.id;
    if (!id) return respond({ error: 'Missing ?id=' }, 400);

    const sheet = getSheet();
    return doDeleteInternal(sheet, id);
  });
}

/* Internal delete helper (shared between doDelete and doPost action) */
function doDeleteInternal(sheet, id) {
  const data = sheet.getDataRange().getValues();
  const rows = rowsToObjects(data);

  const idx = rows.findIndex(r => r.id === id);
  if (idx === -1) return respond({ error: 'Not found' }, 404);

  sheet.deleteRow(idx + 2);
  return respond({ deleted: id });
}

/* Internal update helper (via doPost _action: 'update') */
function doUpdateInternal(sheet, body) {
  const data = sheet.getDataRange().getValues();
  const rows = rowsToObjects(data);

  const idx = rows.findIndex(r => r.id === body.id);
  if (idx === -1) return respond({ error: 'Not found' }, 404);

  const updated = { ...rows[idx], ...body, dateModified: new Date().toISOString() };
  delete updated._action;

  const rowNum = idx + 2;
  HEADERS.forEach((h, col) => {
    sheet.getRange(rowNum, col + 1).setValue(updated[h] !== undefined ? updated[h] : '');
  });

  return respond(updated);
}

/* ==========================================
   HELPERS
   ========================================== */

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function rowsToObjects(data) {
  if (!data || data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] !== undefined ? row[i] : '';
    });
    return obj;
  });
}

function generateId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < 12; i++) id += chars.charAt(Math.floor(Math.random() * chars.length));
  return id;
}

function authorize(e) {
  const token = e && e.parameter && e.parameter.token;
  if (CONFIG.API_TOKEN !== 'change-me-to-a-random-uuid' && token !== CONFIG.API_TOKEN) {
    throw new Error('Unauthorized: invalid or missing token');
  }
}

/* ==========================================
   CORS + RESPONSE HELPERS
   ========================================== */

function handleCors(fn) {
  try {
    const result = fn();
    return buildResponse(result.status || 200, result.body || result);
  } catch (err) {
    return buildResponse(err.status || 401, { error: err.message });
  }
}

function respond(body, statusCode = 200) {
  return { body, status: statusCode };
}

function buildResponse(code, payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
