// Development check only: opens the RISE+ window off-screen, waits for the site, saves a screenshot, exits.
//
//   npx electron smoke.js                 quick check with a plain window (this file's own settings)
//   SMOKE_MAIN=1 npx electron smoke.js    the real main.js: its window, user agent, permissions and menu
//   SMOKE_SITE=http://127.0.0.1:4000/login npx electron smoke.js   point at a local server instead
//
// Run it with the Electron of the build under test, for example the Electron 22 used by the legacy build:
//   SMOKE_MAIN=1 node_modules_of_electron22/.bin/electron smoke.js
// In the VS Code terminal prefix `env -u ELECTRON_RUN_AS_NODE`, otherwise require('electron') breaks.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SITE = process.env.SMOKE_SITE || 'https://rise-plus.onrender.com/login';
const USE_MAIN = process.env.SMOKE_MAIN === '1';
const OUT = path.join(__dirname, 'dist', `smoke-${USE_MAIN ? 'main' : 'plain'}-electron${String(process.versions.electron).split('.')[0]}.png`);

if (USE_MAIN) require('./main.js'); // creates the real window on ready; we inspect it below

app.whenReady().then(async () => {
  const timer = setTimeout(() => {
    console.error('SMOKE TIMEOUT');
    app.exit(2);
  }, 90_000);
  let win;
  if (USE_MAIN) {
    win = BrowserWindow.getAllWindows()[0];
    if (!win) throw new Error('main.js did not create a window');
    if (process.env.SMOKE_SHOW !== '1') win.hide(); // SMOKE_SHOW=1 keeps it visible, which makes the screenshot reliable
    if (process.env.SMOKE_SITE) win.loadURL(SITE);
    await new Promise((resolve) => win.webContents.once('did-finish-load', resolve));
  } else {
    win = new BrowserWindow({ width: 1100, height: 800, show: false, webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false } });
    win.webContents.on('did-fail-load', (e, code, desc) => console.error('SMOKE FAIL', code, desc));
    await win.loadURL(SITE);
  }
  await new Promise((r) => setTimeout(r, 6000));
  const probe = await win.webContents.executeJavaScript(`({
    title: document.title,
    heading: (document.querySelector('h1') || {}).textContent || '',
    ua: navigator.userAgent,
    legacyNotice: Boolean(document.querySelector('.legacy-notice')),
    legacyNoticeText: (document.querySelector('.legacy-notice__text') || {}).textContent || '',
    url: location.href,
  })`);
  let screenshot = OUT;
  try {
    const image = await win.webContents.capturePage();
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, image.toPNG());
  } catch (err) {
    screenshot = `not taken (${err && err.message ? err.message : err})`; // hidden windows cannot always be captured
  }
  console.log(JSON.stringify({ electron: process.versions.electron, chrome: process.versions.chrome, ...probe, screenshot }, null, 2));
  clearTimeout(timer);
  app.exit(0);
});
