# 🎬 Stream8

<p align="center">
  <img src="public/icons/icon-512.png" width="128" height="128" alt="Stream8 Logo" />
</p>

**Stream8** is a modern and responsive Progressive Web App (PWA) designed to track and stream your favorite movies, TV shows, and anime. It seamlessly integrates with **The Movie Database (TMDB)** and **AniList** APIs, and syncs in real-time with [Stream8 Sync Server](https://github.com/rizzonicola/stream8-sync).

🌐 **Live Application:** [https://stream8.poppi.cc](https://stream8.poppi.cc)

---

## ✨ Features

* **Comprehensive Catalog:** Search and discover Movies, TV Shows, and Anime via TMDB and AniList APIs.
* **PWA Support:** Installable on desktop and mobile devices as a native-like application.
* **Cross-Device Sync:** Native integration with the self-hosted [Stream8 Sync Server](https://github.com/rizzonicola/stream8-sync) to sync watch history and playback progress across devices.
* **Custom Sources & Streaming:** Advanced setup for external streaming providers and JSON configurations.

---

## 📸 Screenshots

| Desktop View | Mobile View |
| :---: | :---: |
| ![Desktop Home](.github/screenshots/desktop-home.png) | ![Mobile Home](.github/screenshots/mobile-home.png) |

---

## 🔑 TMDB Configuration

Stream8 never ships a TMDB token to the browser. In production, calls go to
`/api/tmdb/*` and are handled by the Cloudflare Pages Function in
`functions/api/tmdb/[[path]].js`, which reads the encrypted `TMDB_TOKEN`
secret from the Pages project.

For local development:

1. Copy `.dev.vars.example` to `.dev.vars` and set your **TMDB v4 Read Access
   Token** (the long token starting with `eyJ...`, not the v3 API key).
2. Run `npm run dev:api` — starts the Pages Function locally on port `8788`.
3. Run `npm run dev` in another terminal — Vite proxies `/api` to port `8788`.

Never prefix the token with `VITE_`: Vite would inline it into the browser
bundle. The production secret is configured in **Cloudflare Pages → Settings →
Variables and Secrets → `TMDB_TOKEN` → Encrypt**.

## 🛠️ Getting Started
### Prerequisites
 * Node.js (v18 or higher)
 * npm or yarn
### Installation
```bash
# 1. Install dependencies
npm install

# 2. Run the development server
npm run dev

```
## 📄 License
Distributed under the **GNU General Public License v3.0 (GPLv3)**. See LICENSE for more information.
