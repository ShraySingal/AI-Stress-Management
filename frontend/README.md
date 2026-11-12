# MindEase Frontend & UI Architecture

This directory houses all frontend-related code, assets, Figma exports, and historical backups in one unified location.

## Directory Overview

```text
frontend/
├── index.html           # Main active Web & PWA application entrypoint
├── css/
│   └── style.css        # MindEase UI design system (mobile shell, tokens, glassmorphism)
├── js/
│   └── app.js           # Frontend logic, screen navigation & FastAPI backend bridge
├── assets/              # High-resolution vector app icons (192px, 512px, maskable)
├── manifest.webmanifest # PWA configuration (app name, standalone display mode, shortcuts)
├── sw.js                # Offline Service Worker (caching, offline queue, sync)
│
├── figma_export/        # Original raw code exported from Figma Make (Next.js prototype)
└── legacy_backup/       # Archived backup of the original frontend prior to Figma migration
```

## How It Works
* **Active Web App**: Served directly by FastAPI at `http://localhost:8000/`.
* **API Bridge**: `js/app.js` connects to backend routes (`/api/auth/login`, `/api/dashboard`, `/api/predictions/predict`, `/api/chat`, `/api/mood`, `/api/stress`, `/api/sleep`).
* **PWA Mode**: Open on any phone or desktop browser and tap **"Add to Home Screen"** to install as a standalone app.

