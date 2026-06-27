/* ============================================
   Config — Edit these values after deploying
   ============================================

   AFTER deploying the Apps Script:
   1. Copy your Web App URL from Extensions → Apps Script → Deploy → Web app
   2. Paste it below as APP_SCRIPT_URL
   3. Generate a token: open browser console and type: crypto.randomUUID()
   4. Paste it below as API_TOKEN
   5. Put the SAME token in apps-script/Code.gs under CONFIG.API_TOKEN
*/

const CONFIG = {
    /* Your Apps Script Web App URL (paste after deployment) */
    APP_SCRIPT_URL: 'YOUR_APPS_SCRIPT_URL_HERE',

    /* Secret token shared between web app and Apps Script */
    API_TOKEN: 'YOUR_API_TOKEN_HERE'
};
