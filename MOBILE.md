# Clem — Mobile (Capacitor)

Clem is packaged for iOS and Android using [Capacitor](https://capacitorjs.com/). The app builds as a **SPA** (single-page app) and runs in a native WebView. Closet data lives in `localStorage` on-device; server APIs (e.g. color analysis) call your deployed Lovable backend.

## Prerequisites

- Node.js 20+
- **iOS:** Xcode + CocoaPods (macOS only)
- **Android:** Android Studio + SDK

## First-time setup

```bash
cd clem
npm install

# Point native API calls at your deployed Clem backend
cp .env.example .env
# Edit .env — set VITE_SERVER_BASE_URL to your Lovable deploy URL, e.g.:
# VITE_SERVER_BASE_URL=https://your-project.lovable.app

# Add native platforms (once)
npx cap add ios
npx cap add android
```

## Build and run

```bash
# Build SPA + sync web assets into native projects
npm run cap:build

# Open in Xcode or Android Studio
npm run cap:open:ios
npm run cap:open:android

# Or build and run on a simulator/device
npm run cap:run:ios
npm run cap:run:android
```

## Development workflow

| Command | Purpose |
|---------|---------|
| `npm run dev` | Web dev server (browser) |
| `npm run serve:backend` | Dev server on LAN (`--host`) for device testing |
| `npm run build:mobile` | SPA build → `dist/client` |
| `npm run cap:sync` | Copy `dist/client` into `ios/` and `android/` |

For live reload on a physical device during development, run `npm run serve:backend`, note your machine's LAN IP, and temporarily set `server.url` in `capacitor.config.ts` to `http://<your-ip>:5173` (remove before App Store builds).

## Architecture notes

- **SPA mode** is enabled in `vite.config.ts` (`tanstackStart.spa`) so Capacitor gets static assets in `dist/client`.
- **API routes** (`/api/color-analysis`) do not run inside the native shell. On device, `getApiUrl()` in `src/lib/api-base.ts` prefixes paths with `VITE_SERVER_BASE_URL`.
- **CapacitorHttp** is enabled to route fetch through native HTTP and avoid CORS issues on device.
- Most features (closet, outfits, wishlist) work offline via `localStorage` — no backend required.

## App Store checklist

1. Set `VITE_SERVER_BASE_URL` to production URL before `npm run cap:build`
2. Remove any `server.url` override from `capacitor.config.ts`
3. Configure app icons and splash screens in Xcode / Android Studio
4. Update `appId` in `capacitor.config.ts` if needed (currently `app.clem.closet`)

## References

- [TanStack Start + Capacitor guide](https://dev.to/aaronksaunders/tanstack-start-to-mobile-building-robust-apps-with-capacitor-24ae)
- [Capacitor docs](https://capacitorjs.com/docs)
