# mOS — Your desktop, anywhere.

mOS is a **portable browser-based pseudo-desktop** built with HTML5, CSS3 and vanilla JavaScript. It is designed to live in a folder or on a USB drive and provide a familiar desktop-like experience without pretending to be a real operating system.

## Features

- Desktop shell with wallpaper, icons, taskbar and clock
- Start menu and global app/file search
- Reusable draggable, resizable, minimizable and maximizable windows
- Built-in **Files**, **Notes**, **Calculator**, **Browser**, **Settings**, **Computer**, **Terminal**, **Trash** and **Help**
- Persistent virtual filesystem backed by IndexedDB
- Create, rename, move, import, download and trash files
- Local notes that persist across reloads
- Safe calculator input
- Browser app that respects normal browser embedding/security rules
- Dark/light themes, accent colors and wallpapers
- Offline/PWA support when served from HTTPS or localhost
- Responsive layout for smaller screens
- Keyboard shortcuts and accessible controls

## Project structure

```
mOS/
├── index.html
├── manifest.json
├── service-worker.js
├── css/
│   └── mos.css
├── js/
│   ├── mos.js
│   └── apps.js
└── assets/
    └── mos.svg
```

The structure is intentionally small. The core desktop/runtime is in `js/mos.js`; built-in application modules are in `js/apps.js`.

## Run locally

For the broadest browser API support, serve the folder from a local HTTP server:

```bash
python -m http.server 8080
```

Then open:

```
http://localhost:8080
```

Opening `index.html` directly with `file://` can limit Service Worker and some storage/file APIs. mOS itself does not require Python at runtime; Python is only a convenient static server for local development.

## USB use

Copy the entire repository folder to the USB drive.

For the simplest static demo, open `index.html`. For full PWA/service-worker behavior, run a small local HTTP server from the USB folder or host it over HTTPS.

The virtual mOS filesystem is stored in the browser's IndexedDB for the site origin. It is not automatically stored as ordinary files beside `index.html` on the USB drive.

## Important browser limitations

mOS is a web application, not a kernel or standalone OS. Browser sandboxing means it cannot silently control the host computer, manage real CPU/RAM, or access protected files.

The Browser app also cannot force external websites to permit iframe embedding. Sites using security policies such as X-Frame-Options/CSP may need to be opened in the system browser instead.

## Resetting mOS

Use **Settings → Privacy → Reset mOS** to remove the local virtual filesystem and saved preferences for the current browser origin.

## Roadmap

Future versions can add more apps and storage adapters without changing the desktop shell:

- media player
- image/PDF viewers
- code editor
- richer terminal simulator
- local filesystem adapter where supported
- sync/cloud storage connectors
- plugin and theme system

> **mOS is a browser-based pseudo-desktop environment, not a standalone operating system.**
