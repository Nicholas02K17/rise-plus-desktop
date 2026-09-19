# RISE+ desktop app (Windows and Linux)

A small program that opens the live RISE+ app (https://rise-plus.onrender.com) in its own window, with the RISE+ icon, a Start menu entry and no browser bar. Nothing else runs on the computer: every screen comes from the server, so members always have the latest version without updating anything.

## Downloads

The finished files are attached to the newest release on this repository's **Releases** page:

| File | For |
|---|---|
| `RISE-Plus-Setup-x64.exe` | Windows 10 and 11, 64-bit (almost every Windows computer). Installs RISE+ into the Start menu (one click). |
| `RISE-Plus-Setup-ia32.exe` | Windows 10, 32-bit. Same installer for older or low-cost computers. |
| `RISE-Plus-Portable-x64.exe` | Windows 64-bit, no installation: runs from a USB stick or the Downloads folder. |
| `RISE-Plus-Portable-ia32.exe` | Windows 32-bit, no installation. |
| `RISE-Plus.AppImage` | Any 64-bit Linux. Make it executable and run it. |
| `rise-plus.deb` | Ubuntu, Debian, Linux Mint and similar (64-bit). |
| `RISE-Plus-Setup-win7-x64.exe`, `RISE-Plus-Setup-win7-ia32.exe` | Windows 7, 8 and 8.1 (64-bit and 32-bit). The legacy build, see below. Use at your own risk. |
| `RISE-Plus-Portable-win7-x64.exe`, `RISE-Plus-Portable-win7-ia32.exe` | Windows 7, 8 and 8.1, no installation. |

**Which Windows file?** The Get the app page on the website picks the right one automatically. To check by hand: open Settings, System, About, and read "System type": "64-bit operating system" means the `x64` file, "32-bit operating system" means the `ia32` file. Windows 11 is always 64-bit. Running a 64-bit file on a 32-bit computer gives the message "This app can't run on your PC"; the `ia32` file fixes that. The 32-bit files run on 64-bit Windows too, only a little slower.

**Windows shows a warning the first time.** The files are not signed with a paid certificate (about 10 US dollars a month), so Windows says "Windows protected your PC". Click **More info**, then **Run anyway**. It happens only once per computer; the app is safe and its whole source is in this repository.

**No 32-bit Linux.** Electron, the engine this program is built on, has not offered a 32-bit Linux build since 2019, so there is nothing to build from. People on a 32-bit Linux computer use the website in their browser instead.

## Windows 7, 8 and 8.1: the legacy build

The regular files need Windows 10 or newer. For Windows 7, 8 and 8.1 there is a separate build (`win7` in the file name, covering all three) made from the same `main.js` with **Electron 22.3.27**, the last Electron that starts on those systems. Nothing exists for Windows XP or Vista: no engine that runs there can open today's websites.

Electron 22 stopped receiving security fixes in October 2023, and so did those Windows versions. The legacy build is therefore offered on these terms, which the website states plainly next to the download and inside the app (a bar with an "I understand" button):

- People use it at their own risk. CanU Canada cannot protect an outdated computer and is not responsible for harm on the user's side, such as a stolen password.
- Admin and president accounts cannot sign in from it. `main.js` adds `RISEPlusLegacy/<version>` to the user agent when it runs on Electron 22, and the RISE+ server refuses admin sign-ins and admin requests carrying that mark (error code `LEGACY_CLIENT`). A user agent can be faked, but faking it only lets someone pick the weaker client for themselves.
- It cannot harm the RISE+ server: the server treats every client the same and checks everything itself.

What the app itself does to limit the damage an old engine could do: it only ever shows rise-plus.onrender.com (any other address, including server redirects, opens in the normal browser), the page runs sandboxed with no access to Node, and the only browser permission it may be granted is notifications. This applies to both builds.

`electron-builder.legacy.yml` pins the Electron version and names the files. electron-builder verifies the downloaded Electron against the official `SHASUMS256.txt`; the expected hashes are noted in that file. Do not raise the version: Electron 23 and newer do not start on Windows 7 or 8.

## Building it yourself

You need Node.js 22 or newer.

```
npm install
npm start          # run it from source
npm run dist        # Windows installers + portable exes (64-bit and 32-bit), into dist/
npm run dist:legacy # the Windows 7/8 build on Electron 22, into dist-legacy/
npm run dist:linux  # AppImage + deb (on Linux)
```

`smoke.js` opens the window off-screen and reports what loaded (title, user agent, whether the Windows 7/8 notice appeared) plus a screenshot. Run it with the Electron under test, for example `SMOKE_MAIN=1 npx electron smoke.js`; in the VS Code terminal prefix `env -u ELECTRON_RUN_AS_NODE`.

### About the Electron version

`package.json` pins Electron to the 43 line (`^43.7.1`) on purpose: **Electron 43 is the last version with a 32-bit Windows build.** Electron 44 and newer only ship 64-bit files, so raising the version would silently make the 32-bit downloads impossible to build. Electron keeps 43 patched for a few months after each new major version; when it stops (see https://www.electronjs.org/docs/latest/tutorial/electron-timelines), the choice is either to stay on 43 without further security fixes or to move to a newer Electron and drop the two `ia32` files (remove `"ia32"` from both `arch` lists in `package.json`, the two `ia32` lines in `.github/workflows/build.yml`, and the 32-bit entries in the website's `public/js/components/desktop-downloads.js`).

## Releasing a new version

Only needed when this window program itself changes (a new icon, a new site address). Changes to the RISE+ app never need a release.

1. Raise `"version"` in `package.json`, for example `1.1.1`.
2. Commit, then create and push a tag with the same number:

```
git add -A
git commit -m "Desktop app 1.1.1"
git tag v1.1.1
git push && git push --tags
```

GitHub Actions builds the Windows and Linux files (about 10 minutes) and attaches them to a new release. The app checks this repository's latest release on start-up and, when a newer version exists, offers to download the file that matches that computer (64-bit or 32-bit, installer or portable, AppImage or .deb).

## What the program does

- Opens https://rise-plus.onrender.com in a window (Electron, a Chromium engine). Remembers the window size and position.
- Links that leave the site (the Email buttons, CanU's social links, registration forms) open in the normal browser or mail app.
- Shows a friendly "cannot be reached" page with a retry button when offline or while the free server wakes up.
- Menu (press Alt): Reload, Back, zoom, Open in browser, Check for updates, Quit.
- Runs a single instance; launching it again focuses the existing window.
