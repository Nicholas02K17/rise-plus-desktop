// RISE+ desktop shell: a window that shows the live RISE+ app (https://rise-plus.onrender.com).
// Nothing runs locally except this window; every screen comes from the server, so the app is always current.
//
// Two builds come out of this one file. The regular build uses a current Electron and runs on Windows 10/11 and
// Linux. The "legacy" build (electron-builder.legacy.yml) uses Electron 22, the last version that starts on
// Windows 7, 8 and 8.1. Electron 22 stopped receiving security fixes in October 2023, so the legacy build says so
// in its user agent ("RISEPlusLegacy/<version>"): the website shows a use-at-your-own-risk notice and the server
// refuses admin and president sign-ins from it. Everything below must therefore stay compatible with Electron 22
// (Node 16: no global fetch, no navigationHistory).
const { app, BrowserWindow, shell, Menu, dialog, nativeImage, net, session } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const APP_VERSION = require('./package.json').version; // app.getVersion() is Electron's own version when run from source
const ELECTRON_MAJOR = Number(String(process.versions.electron || '').split('.')[0]) || 0;
const LEGACY = ELECTRON_MAJOR > 0 && ELECTRON_MAJOR < 23;
if (LEGACY) app.userAgentFallback = `${app.userAgentFallback} RISEPlusLegacy/${APP_VERSION}`;

const SITE = 'https://rise-plus.onrender.com';
const SITE_ORIGIN = new URL(SITE).origin;
const RELEASES_API = 'https://api.github.com/repos/Nicholas02K17/rise-plus-desktop/releases/latest';
const RELEASES_PAGE = 'https://github.com/Nicholas02K17/rise-plus-desktop/releases/latest';
const RELEASES_DOWNLOAD = 'https://github.com/Nicholas02K17/rise-plus-desktop/releases/latest/download';
const STATE_FILE = () => path.join(app.getPath('userData'), 'window-state.json');

app.setAppUserModelId('org.canucanada.riseplus');

// One window at a time: a second launch focuses the existing one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function loadState() {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE(), 'utf8'));
    if (state && Number.isFinite(state.width) && Number.isFinite(state.height)) return state;
  } catch {
    /* first run */
  }
  return { width: 1100, height: 800 };
}

function saveState(win) {
  try {
    if (win.isDestroyed()) return;
    const bounds = win.getNormalBounds();
    fs.writeFileSync(STATE_FILE(), JSON.stringify({ ...bounds, maximized: win.isMaximized() }));
  } catch {
    /* not important */
  }
}

function isSiteUrl(url) {
  try {
    return new URL(url).origin === SITE_ORIGIN;
  } catch {
    return false;
  }
}

/** Anything that is not our site (mailto:, CanU's social links, map pages, registration forms) opens outside. */
function openOutside(url) {
  if (/^(https?:|mailto:)/i.test(url)) shell.openExternal(url);
}

function createWindow() {
  const state = loadState();
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 360,
    minHeight: 560,
    title: 'RISE+',
    backgroundColor: '#faf7f2',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: true,
    },
  });
  if (state.maximized) win.maximize();

  // Links that leave the site open in the normal browser or mail app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    openOutside(url);
    return { action: 'deny' };
  });
  const keepInside = (event, url) => {
    if (!isSiteUrl(url)) {
      event.preventDefault();
      openOutside(url);
    }
  };
  win.webContents.on('will-navigate', keepInside);
  win.webContents.on('will-redirect', keepInside); // a redirect to another site opens outside as well

  // Offline or server asleep: show a friendly page with a retry button instead of Chromium's error.
  win.webContents.on('did-fail-load', (event, code, description, validatedUrl, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = aborted (navigation replaced), not an error
    win.loadFile(path.join(__dirname, 'error.html'), { query: { site: SITE, reason: description || String(code) } });
  });

  // Keep the window title fixed even when the page changes document.title.
  win.on('page-title-updated', (event) => event.preventDefault());

  for (const evt of ['resize', 'move', 'close']) win.on(evt, () => saveState(win));

  win.loadURL(SITE);
  return win;
}

/** Back one page. navigationHistory exists from Electron 32; Electron 22 still has the older methods. */
function goBack(webContents) {
  const history = webContents.navigationHistory;
  if (history) {
    if (history.canGoBack()) history.goBack();
  } else if (typeof webContents.canGoBack === 'function' && webContents.canGoBack()) {
    webContents.goBack();
  }
}

/**
 * Browser permissions the page may ask for. Only notifications (the site's own alerts); the camera, microphone,
 * location, USB and the rest are refused without asking, and nothing is granted to a page outside the site.
 */
const ALLOWED_PERMISSIONS = new Set(['notifications']);
function lockPermissions() {
  const fromSite = (details) => {
    try {
      return Boolean(details && details.requestingUrl && new URL(details.requestingUrl).origin === SITE_ORIGIN);
    } catch {
      return false;
    }
  };
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(ALLOWED_PERMISSIONS.has(permission) && fromSite(details));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission, origin) => {
    return ALLOWED_PERMISSIONS.has(permission) && origin === SITE_ORIGIN;
  });
}

function buildMenu() {
  const template = [
    {
      label: 'RISE+',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: (_, win) => win && win.loadURL(SITE) },
        { label: 'Back', accelerator: 'Alt+Left', click: (_, win) => win && goBack(win.webContents) },
        { type: 'separator' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { role: 'resetZoom' },
        { type: 'separator' },
        { label: 'Open in browser', click: () => shell.openExternal(SITE) },
        { label: 'Check for updates', click: () => checkForUpdates({ manual: true }) },
        { type: 'separator' },
        { role: 'quit', label: 'Quit RISE+' },
      ],
    },
    { role: 'editMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function newerThan(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map((n) => Number(n) || 0);
  const pb = String(b).replace(/^v/, '').split('.').map((n) => Number(n) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

/**
 * The release file that matches this computer and the way RISE+ was installed here, so the update button
 * downloads the right one directly. Windows comes in 64-bit (x64) and 32-bit (ia32) versions, each as an
 * installer or a portable exe; Linux as an AppImage or a .deb. Returns null when there is no matching build
 * (for example Windows on ARM), in which case the Releases page is shown instead.
 */
function downloadFileForThisComputer() {
  if (process.platform === 'win32') {
    if (process.arch !== 'x64' && process.arch !== 'ia32') return null;
    const portable = Boolean(process.env.PORTABLE_EXECUTABLE_FILE); // set by the portable exe launcher
    return `RISE-Plus-${portable ? 'Portable' : 'Setup'}-${LEGACY ? 'win7-' : ''}${process.arch}.exe`;
  }
  if (process.platform === 'linux' && process.arch === 'x64') {
    return process.env.APPIMAGE ? 'RISE-Plus.AppImage' : 'rise-plus.deb'; // APPIMAGE is set by the AppImage runtime
  }
  return null;
}

/** Where "Download" goes: the exact file when the release has it, otherwise the Releases page. */
function downloadUrl(release) {
  const file = downloadFileForThisComputer();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  if (file && assets.some((asset) => asset && asset.name === file)) return `${RELEASES_DOWNLOAD}/${file}`;
  return RELEASES_PAGE;
}

/** GET a JSON document with Electron's own network stack (works on every Electron version, unlike global fetch). */
function getJson(url) {
  return new Promise((resolve, reject) => {
    const request = net.request({ url, method: 'GET' });
    request.setHeader('Accept', 'application/vnd.github+json');
    request.setHeader('User-Agent', 'rise-plus-desktop');
    request.on('response', (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(new Error(`HTTP ${response.statusCode}`));
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch (err) {
          reject(err);
        }
      });
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end();
  });
}

/** The shell rarely needs updating (the app itself is live), but when it does, point people at the download. */
async function checkForUpdates({ manual = false } = {}) {
  try {
    const release = await getJson(RELEASES_API);
    const latest = String(release.tag_name || '').replace(/^v/, '');
    if (latest && newerThan(latest, APP_VERSION)) {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'RISE+ update',
        message: `A newer version of the RISE+ desktop app is available (${latest}).`,
        detail: 'Your events and account are not affected; only this window program is updated. The download matches this computer.',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) shell.openExternal(downloadUrl(release));
    } else if (manual) {
      dialog.showMessageBox({ type: 'info', title: 'RISE+ update', message: 'You have the latest version.' });
    }
  } catch (err) {
    if (manual) dialog.showMessageBox({ type: 'warning', title: 'RISE+ update', message: 'Could not check for updates right now.', detail: String(err && err.message ? err.message : err) });
  }
}

app.whenReady().then(() => {
  if (process.platform === 'linux') {
    try {
      const icon = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png'));
      if (!icon.isEmpty()) app.dock?.setIcon?.(icon);
    } catch {
      /* optional */
    }
  }
  lockPermissions();
  buildMenu();
  createWindow();
  setTimeout(() => checkForUpdates().catch(() => {}), 15_000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
