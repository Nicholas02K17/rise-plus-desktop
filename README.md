# RISE+ desktop app (Windows and Linux)

A small program that opens the live RISE+ app (https://rise-plus.onrender.com) in its own window, with the RISE+ icon, a Start menu entry and no browser bar. Nothing else runs on the computer: every screen comes from the server, so members always have the latest version without updating anything.

## Downloads

The finished files are attached to the newest release on this repository's **Releases** page:

| File | For |
|---|---|
| `RISE-Plus-Setup.exe` | Windows 10 and 11. Installs RISE+ into the Start menu (one click). |
| `RISE-Plus-Portable.exe` | Windows, no installation: runs from a USB stick or the Downloads folder. |
| `RISE-Plus.AppImage` | Any Linux. Make it executable and run it. |
| `rise-plus.deb` | Ubuntu, Debian, Linux Mint and similar. |

**Windows shows a warning the first time.** The files are not signed with a paid certificate (about 10 US dollars a month), so Windows says "Windows protected your PC". Click **More info**, then **Run anyway**. It happens only once per computer; the app is safe and its whole source is in this repository.

## Building it yourself

You need Node.js 22 or newer.

```
npm install
npm start          # run it from source
npm run dist       # Windows installer + portable exe, into dist/
npm run dist:linux # AppImage + deb (on Linux)
```

## Releasing a new version

Only needed when this window program itself changes (a new icon, a new site address). Changes to the RISE+ app never need a release.

1. Raise `"version"` in `package.json`, for example `1.0.1`.
2. Commit, then create and push a tag with the same number:

```
git add -A
git commit -m "Desktop app 1.0.1"
git tag v1.0.1
git push && git push --tags
```

GitHub Actions builds the Windows and Linux files (about 10 minutes) and attaches them to a new release. The app checks this repository's latest release on start-up and offers the download when a newer version exists.

## What the program does

- Opens https://rise-plus.onrender.com in a window (Electron, a Chromium engine). Remembers the window size and position.
- Links that leave the site (the Email buttons, CanU's social links, registration forms) open in the normal browser or mail app.
- Shows a friendly "cannot be reached" page with a retry button when offline or while the free server wakes up.
- Menu (press Alt): Reload, Back, zoom, Open in browser, Check for updates, Quit.
- Runs a single instance; launching it again focuses the existing window.
