/* ============================================
   Config — Edit these values
   ============================================ */

const CONFIG = {
    /* ---- Google Sheets API ---- */

    /* Your Apps Script Web App URL (paste after deployment) */
    APP_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbx0tE3DDSnbfMO9REp4GmcKh2EhLtm-SAZvnl2-XY7MCcSaCUidYNNF0mkenyQGBdMrhw/exec',

    /* Secret token shared between web app and Apps Script */
    API_TOKEN: 'ds-d158f1b7',

    /* ---- Access PIN ---- */

    /* Simple PIN gate so only you & your wife can access the app.
       Change this to any 4-6 digit number you both know.
       Set to empty string '' to disable the PIN gate entirely. */
    ACCESS_PIN: 'mknn2026',

    /* Message shown on the lock screen */
    LOCK_MESSAGE: 'Enter PIN to access'
};
