# Puzzle Inspiration

Cross-device real-time creativity puzzle with a GM/Player split, keyboard-accessible drag/drop, lazy-loaded theme mosaics, reconnect UX, offline-friendly shell caching, and a smoke-tested frontend.

## Features
- Live WebSocket sync with Game Master controls, players, boosts, hints, and leaderboard.
- Keyboard drag/drop assist (Enter/Space to grab/drop, arrows to move between phases, Esc to cancel) plus highlighted targets.
- Lazy-loaded mosaic reveal with shimmer placeholders to save bandwidth.
- Reconnect toast with retry on socket interruptions.
- Service worker caches app shell and Unsplash theme images for repeat visits/offline.
- Automated smoke test (Vitest + Testing Library).

## Project layout
- `client/` — React 19 + Vite frontend.
- `server/` — Node + ws WebSocket server.

## Prerequisites
- Node 18+ recommended (tested with npm).

## Setup
```sh
cd server && npm install
cd ../client && npm install
```

## Run locally
1) Start the server (WebSocket, default ws://localhost:8787):
```sh
cd server
npm start
```

2) Start the client dev server:
```sh
cd client
npm run dev
```
Open the printed localhost URL. The client will auto-register the service worker in production builds; in dev, Vite bypasses SW.

## Build
```sh
cd client
npm run build
```

## Tests
Smoke test:
```sh
cd client
npm run test:smoke
```

## Lint
```sh
cd client
npm run lint
```

## Environment
- Client WebSocket URL: `VITE_WS_URL` (defaults to `ws://localhost:8787`).

## Notes
- The service worker caches same-origin requests plus Unsplash theme images; other external assets stay network-fetched.
- For best SW behavior, serve the built client over HTTPS or `localhost`.

