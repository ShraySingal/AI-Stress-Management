# MindEase Frontend & UI Architecture

This directory houses all frontend-related code, vector assets, and design system resources for the MindEase application in one clean, unified location.

## Directory Structure

```text
frontend/
├── index.html           # Main Single Page Application (SPA) entrypoint with inlined SVG icons
├── css/
│   └── style.css        # MindEase design system (mobile frame, dark mode tokens, typography, glassmorphism)
├── js/
│   ├── app.js           # Client-side routing, auth state, interactive trackers, AI chat, and FastAPI bridge
│   ├── icons.json       # Local offline vector icon dictionary
│   └── lucide.min.js    # Local Lucide icon engine
├── assets/
│   ├── icon.svg         # Primary vector application icon
│   ├── icon-192.svg     # 192px PWA home-screen icon
│   ├── icon-512.svg     # 512px PWA splash icon
│   └── architecture.jpg # Visual system architecture graphic
├── manifest.webmanifest # Progressive Web App (PWA) manifest configuration
├── sw.js                # Service Worker for cache invalidation & offline support
└── README.md            # Frontend guide and documentation
```

## Running the Frontend

- **Via Backend Server**: When running `python -m uvicorn backend.main:app --port 8000`, the frontend is automatically served at `http://127.0.0.1:8000/`.
- **Via Direct Browser / Live Server**: You can also open `frontend/index.html` directly or through VS Code Live Server; it will automatically connect to the backend API at `http://127.0.0.1:8000/api`.
- **PWA Installation**: Open on any smartphone (Chrome, Safari) or desktop browser and select **"Add to Home Screen"** to install MindEase as a standalone native-like application.
