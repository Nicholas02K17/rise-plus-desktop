// RISE+ desktop shell: a window that shows the live RISE+ app (https://rise-plus.onrender.com).
// Nothing runs locally except this window; every screen comes from the server, so the app is always current.
const { app, BrowserWindow, shell, Menu, dialog, nativeImage } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SITE = 'https://rise-plus.onrender.com';
const SITE_ORIGIN = new URL(SITE).origin;
const RELEASES_API = 'https://api.github.com/repos/Nicholas02K17/rise-plus-desktop/releases/latest';
const RELEASES_PAGE = 'https://github.com/Nicholas02K17/rise-plus-desktop/releases/latest';
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
  win.webContents.on('will-navigate', (event, url) => {
    if (!isSiteUrl(url)) {
      event.preventDefault();
      openOutside(url);
    }
  });

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

function buildMenu() {
  const template = [
    {
      label: 'RISE+',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: (_, win) => win && win.loadURL(SITE) },
        { label: 'Back', accelerator: 'Alt+Left', click: (_, win) => win && win.webContents.navigationHistory.canGoBack() && win.webContents.navigationHistory.goBack() },
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

/** The shell rarely needs updating (the app itself is live), but when it does, point people at the download page. */
async function checkForUpdates({ manual = false } = {}) {
  try {
    const res = await fetch(RELEASES_API, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'rise-plus-desktop' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const release = await res.json();
    const latest = String(release.tag_name || '').replace(/^v/, '');
    if (latest && newerThan(latest, app.getVersion())) {
      const { response } = await dialog.showMessageBox({
        type: 'info',
        title: 'RISE+ update',
        message: `A newer version of the RISE+ desktop app is available (${latest}).`,
        detail: 'Your events and account are not affected; only this window program is updated.',
        buttons: ['Download', 'Later'],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) shell.openExternal(RELEASES_PAGE);
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
  buildMenu();
  createWindow();
  setTimeout(() => checkForUpdates().catch(() => {}), 15_000);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => app.quit());
