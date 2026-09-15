// Development check only: opens the RISE+ window off-screen, waits for the site, saves a screenshot, exits.
// Run with: npx electron smoke.js
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SITE = 'https://rise-plus.onrender.com/login';
const OUT = path.join(__dirname, 'dist', 'smoke.png');

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1100, height: 800, show: false, webPreferences: { contextIsolation: true, sandbox: true } });
  const timer = setTimeout(() => {
    console.error('SMOKE TIMEOUT');
    app.exit(2);
  }, 90_000);
  win.webContents.on('did-fail-load', (e, code, desc) => {
    console.error('SMOKE FAIL', code, desc);
  });
  await win.loadURL(SITE);
  await new Promise((r) => setTimeout(r, 6000));
  const title = await win.webContents.executeJavaScript('document.title');
  const heading = await win.webContents.executeJavaScript('(document.querySelector("h1") || {}).textContent || ""');
  const ua = await win.webContents.executeJavaScript('navigator.userAgent');
  const image = await win.webContents.capturePage();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, image.toPNG());
  console.log(JSON.stringify({ title, heading, electron: /Electron/.test(ua), screenshot: OUT }));
  clearTimeout(timer);
  app.exit(0);
});
