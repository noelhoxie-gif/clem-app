# Vesti Browser Extension — Roadmap

> Goal: heart any product on any retailer's site, instantly sync to your Vesti wishlist. Rakuten-style, but for outfits.

## How it works (architecture)

```
[ Retailer page ]  ──user clicks ♥──▶  [ Vesti extension ]
                                              │
                                              ├── reads og:image, title, price from page DOM
                                              │
                                              └─POST /api/public/wishlist/sync──▶  [ Vesti server ]
                                                                                        │
                                                                                        └─▶ user's wishlist (DB)
```

## Phase 1 — MVP extension (Chrome / Edge / Brave / Arc)

- Manifest V3 + content script injected on all `https://*` pages.
- Floating heart button (bottom-right) on detected product pages — heuristics:
  - presence of `<meta property="og:type" content="product">`
  - schema.org `Product` JSON-LD
  - URL contains `/product/`, `/p/`, `/shop/`
- Click captures: URL, og:image, og:title, og:site_name, price (JSON-LD `offers.price`).
- Sends to `POST https://project--<id>.lovable.app/api/public/wishlist/sync` with a per-user device token.
- Toast: "Saved to Vesti ✓ View wishlist".

## Phase 2 — Account pairing

- One-tap auth: extension opens `/connect-extension` in Vesti, user approves, token issued.
- Token stored in `chrome.storage.local`, attached to every sync request.
- Wishlist becomes a server-backed list (requires Lovable Cloud + auth — currently the app uses localStorage).

## Phase 3 — Smart suggestions

- Extension reads page → asks Vesti AI: "does this fit any active trip folder?" (e.g. Cannes Trip weather + gaps).
- Inline badge: "Great for Cannes day 3 — 26°C sunny".

## Phase 4 — Safari + iOS

- Safari Web Extension (same code, repackaged via Xcode).
- iOS Share Sheet extension as a fallback (any app → Share → Save to Vesti).

## What's needed before shipping Phase 1

1. **Lovable Cloud auth** so wishlists are tied to user accounts, not per-device localStorage.
2. **Public sync endpoint** at `/api/public/wishlist/sync` with HMAC-signed device tokens.
3. **Chrome Web Store listing** ($5 one-time dev fee).

## Why not "fully automatic" without a click?

Browsers sandbox extensions from cross-site auto-actions for privacy. The user must explicitly heart — but the heart can live *on the retailer's page*, which is the seamless part.

## Today's in-app stand-in

Until the extension ships, the Wishlist tab supports:
- Paste any product URL → auto-fetched preview (Firecrawl).
- In-app web search → heart results directly into your wishlist.
