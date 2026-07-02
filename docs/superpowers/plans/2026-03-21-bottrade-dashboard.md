# Bottrade Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a real-time crypto trading dashboard that connects to Binance Futures via WebSocket, calculates technical indicators, generates LONG/SHORT/NEUTRO signals with confluence scoring, and displays everything in a React dashboard.

**Architecture:** Monorepo with 3 workspaces (shared types, Express+Socket.io server, React+Vite client). Server connects to Binance WebSocket for real-time data, calculates indicators using `technicalindicators`, applies scoring rules, persists signals to MySQL, and pushes updates to the frontend via Socket.io.

**Tech Stack:** TypeScript, Express, Socket.io, ws, React, Vite, TailwindCSS, Zustand, MySQL (XAMPP), technicalindicators

**Spec:** `docs/superpowers/specs/2026-03-21-bottrade-dashboard-design.md`

---

## File Map

### packages/shared/
| File | Responsibility |
|------|---------------|
| `src/types.ts` | All shared TypeScript interfaces (CandleData, IndicatorValues, PriceData, SignalData, etc.) |

### packages/server/
| File | Responsibility |
|------|---------------|
| `src/config.ts` | Constants, defaults, env loading |
| `src/database.ts` | MySQL pool, table creation, CRUD for signals/settings |
| `src/calculator.ts` | Technical indicator calculations (MA, EMA, MACD, StochRSI, Volume) |
| `src/signals.ts` | Scoring logic, overrides, risk management, alert generation |
| `src/wsManager.ts` | Binance WebSocket connections, reconnection, candle buffer |
| `src/index.ts` | Express server, Socket.io setup, orchestration |

### packages/client/
| File | Responsibility |
|------|---------------|
| `src/store/useStore.ts` | Zustand store for all app state |
| `src/hooks/useSocket.ts` | Socket.io connection hook |
| `src/components/Dashboard.tsx` | Main layout, grid, header |
| `src/components/PairCard.tsx` | Card container per pair |
| `src/components/PriceHeader.tsx` | Price display, funding, countdown |
| `src/components/IndicatorPanel.tsx` | MA/EMA/MACD/StochRSI/Volume display |
| `src/components/SignalPanel.tsx` | Direction, score bar, decision text |
| `src/components/RiskPanel.tsx` | Entry/SL/TP, position size, margin |
| `src/components/SettingsPanel.tsx` | Settings drawer |
| `src/components/AlertToast.tsx` | Toast notification wrapper |
| `src/styles/globals.css` | Tailwind imports, custom theme colors |

---

## Task 1: Monorepo Scaffolding & Config

**Files:**
- Create: `package.json` (root)
- Create: `tsconfig.base.json`
- Create: `.env`
- Create: `.gitignore`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/client/package.json`
- Create: `packages/client/tsconfig.json`
- Create: `packages/client/vite.config.ts`
- Create: `packages/client/tailwind.config.js`
- Create: `packages/client/index.html`
- Create: `packages/client/src/styles/globals.css`
- Create: `packages/client/postcss.config.js`

- [ ] **Step 1: Create root package.json with workspaces**

```json
{
  "name": "bottrade",
  "private": true,
  "workspaces": [
    "packages/shared",
    "packages/server",
    "packages/client"
  ],
  "scripts": {
    "dev:server": "npm run dev --workspace=packages/server",
    "dev:client": "npm run dev --workspace=packages/client",
    "dev": "concurrently \"npm run dev:server\" \"npm run dev:client\""
  },
  "devDependencies": {
    "concurrently": "^8.2.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  }
}
```

- [ ] **Step 3: Create .env and .gitignore**

`.env`:
```
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=bottrade
PORT=3001
CLIENT_ORIGIN=http://localhost:5173
```

`.gitignore`:
```
node_modules/
dist/
.env
*.log
```

- [ ] **Step 4: Create packages/shared config**

`packages/shared/package.json`:
```json
{
  "name": "@bottrade/shared",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/types.ts",
  "types": "./src/types.ts",
  "exports": {
    ".": "./src/types.ts"
  }
}
```

`packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create packages/server config**

`packages/server/package.json`:
```json
{
  "name": "@bottrade/server",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts"
  },
  "dependencies": {
    "@bottrade/shared": "*",
    "express": "^4.21.0",
    "socket.io": "^4.7.0",
    "ws": "^8.17.0",
    "technicalindicators": "^3.1.0",
    "axios": "^1.7.0",
    "mysql2": "^3.11.0",
    "dotenv": "^16.4.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/ws": "^8.5.0",
    "@types/node": "^20.0.0",
    "tsx": "^4.7.0"
  }
}
```

`packages/server/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

- [ ] **Step 6: Create packages/client config**

`packages/client/package.json`:
```json
{
  "name": "@bottrade/client",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "@bottrade/shared": "*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "socket.io-client": "^4.7.0",
    "zustand": "^4.5.0",
    "react-hot-toast": "^2.4.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "vite": "^5.4.0"
  }
}
```

`packages/client/vite.config.ts`:
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
      },
    },
  },
})
```

`packages/client/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"],
  "references": [{ "path": "../shared" }]
}
```

`packages/client/tailwind.config.js`:
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0f0f0f' },
        card: { DEFAULT: '#1a1a1a', border: '#2a2a2a' },
        bull: '#00c896',
        bear: '#ff4444',
        warn: '#ffaa00',
        muted: '#888888',
      },
    },
  },
  plugins: [],
}
```

`packages/client/postcss.config.js`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

`packages/client/src/styles/globals.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0f0f0f;
  color: #ffffff;
  font-family: system-ui, -apple-system, sans-serif;
}

.font-mono-num {
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-variant-numeric: tabular-nums;
}
```

`packages/client/index.html`:
```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Bottrade</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Install dependencies**

Run: `npm install`
Expected: All 3 workspaces installed, no errors.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold monorepo with shared/server/client workspaces"
```

---

## Task 2: Shared Types

**Files:**
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: Write all shared interfaces**

Copy all interfaces exactly from the spec (lines 79-175 of the design doc). All interfaces must be `export`ed. This includes: `CandleData`, `IndicatorValues`, `PriceData`, `RiskManagement`, `Alert`, `SignalData`, `PairAnalysis`, `UserSettings`, `SignalRecord`.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --project packages/shared/tsconfig.json --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add shared TypeScript interfaces"
```

---

## Task 3: Server — Config & Database

**Files:**
- Create: `packages/server/src/config.ts`
- Create: `packages/server/src/database.ts`

- [ ] **Step 1: Create MySQL database**

Run via XAMPP phpMyAdmin or MySQL CLI:
```sql
CREATE DATABASE IF NOT EXISTS bottrade CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```
Expected: Database `bottrade` exists.

- [ ] **Step 2: Write config.ts**

```typescript
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../../.env') })

export const config = {
  db: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'bottrade',
  },
  port: parseInt(process.env.PORT || '3001', 10),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  binance: {
    wsBaseUrl: 'wss://fstream.binance.com/stream',
    restBaseUrl: 'https://fapi.binance.com',
    restTimeout: 10_000,
    restMaxRetries: 3,
  },
  ws: {
    reconnectBaseDelay: 1000,
    reconnectMaxDelay: 30_000,
    pingInterval: 30_000,
  },
  candles: {
    bufferSize: 250,
    minForSignals: 200,
    interval: '15m' as const,
    historyLimit: 200,
  },
  defaults: {
    baseCapital: 100,
    leverage: 5,
    fundingThreshold: 0.05,
    stochRsiHighThreshold: 90,
    stochRsiLowThreshold: 10,
    soundAlerts: true,
    desktopNotifications: false,
    pairs: ['ETHUSDT', 'BTCUSDT'],
  },
} as const
```

- [ ] **Step 3: Write database.ts**

Uses `mysql2/promise`. Copy the three CREATE TABLE statements from the spec file (`docs/superpowers/specs/2026-03-21-bottrade-dashboard-design.md`, lines 185-238) verbatim for `initDatabase()`.

```typescript
import mysql, { Pool, PoolConnection } from 'mysql2/promise'
import type { SignalData, IndicatorValues, UserSettings, SignalRecord } from '@bottrade/shared'
import { config } from './config.js'
```

**Connection pool with retry:**
```typescript
let pool: Pool

async function createPool(): Promise<Pool> {
  return mysql.createPool({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    waitForConnections: true,
    connectionLimit: 10,
  })
}

// Retry connection with exponential backoff: 1s, 2s, 4s, max 30s
// On failure: log error, queue signals in signalBuffer (max 100)
```

**Signal buffer (for MySQL outages):**
```typescript
interface BufferedSignal {
  signal: SignalData
  indicators: IndicatorValues
  symbol: string
  price: number
}

const signalBuffer: BufferedSignal[] = [] // max 100 entries
```

**Functions:**

```typescript
export async function initDatabase(): Promise<void>
// Creates pool, runs CREATE TABLE IF NOT EXISTS for all 3 tables
// On error: retry with backoff, log to console

export async function saveSignal(
  symbol: string,
  signal: SignalData,
  indicators: IndicatorValues
): Promise<number | null>
// INSERT into signals table, get insertId
// INSERT into indicator_snapshots with signal_id = insertId
// Map SignalData fields to snake_case columns:
//   confluenceScore → confluence_score
//   riskManagement.entry → entry_price
//   riskManagement.stopLoss → stop_loss (null if NEUTRO)
//   actionPoints → JSON.stringify(actionPoints)
//   overrides → JSON.stringify(overrides)
// On MySQL error: push to signalBuffer (if < 100), return null

export async function getSettings(): Promise<UserSettings>
// SELECT value FROM settings WHERE key_name = 'user_settings'
// If found: JSON.parse(value) as UserSettings
// If not found: return config.defaults as UserSettings

export async function updateSettings(partial: Partial<UserSettings>): Promise<UserSettings>
// Get current settings, merge with partial: { ...current, ...partial }
// UPSERT: INSERT INTO settings (key_name, value) VALUES ('user_settings', ?)
//         ON DUPLICATE KEY UPDATE value = ?
// Return merged settings

export async function getHistory(
  symbol?: string, limit = 50, offset = 0
): Promise<{ signals: SignalRecord[], total: number }>
// SELECT COUNT(*) for total (with optional WHERE symbol = ?)
// SELECT * FROM signals WHERE ... ORDER BY created_at DESC LIMIT ? OFFSET ?
// Map snake_case DB rows to camelCase SignalRecord:
//   confluence_score → confluenceScore
//   entry_price → entryPrice
//   created_at → createdAt (toISOString())
//   action_points → JSON.parse(action_points)
//   overrides → JSON.parse(overrides)

export async function flushBuffer(): Promise<void>
// If signalBuffer.length > 0 and pool is connected:
//   For each buffered signal, call saveSignal()
//   Clear successfully saved entries from buffer
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --project packages/server/tsconfig.json --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/config.ts packages/server/src/database.ts
git commit -m "feat: add server config and MySQL database layer"
```

---

## Task 4: Server — Technical Indicator Calculator

**Files:**
- Create: `packages/server/src/calculator.ts`

- [ ] **Step 1: Write calculator.ts**

Uses the `technicalindicators` library (CommonJS, works with `esModuleInterop: true`):

```typescript
import { SMA, EMA, MACD, StochasticRSI } from 'technicalindicators'
import type { CandleData, IndicatorValues } from '@bottrade/shared'
```

Implements:

- `calculateIndicators(candles: CandleData[], prevIndicators?: IndicatorValues): IndicatorValues`
  - **MAs**: SMA with periods 20, 50, 100, 200 on close prices
  - **EMAs**: EMA with periods 20, 50 on close prices
  - **MACD**: standard 12, 26, 9 parameters. Determine `trend` from histogram direction. Detect `divergence` by comparing last 2 swing highs/lows of price vs MACD.
  - **StochRSI**: period 14, K period 3, D period 3. Determine `zone`. Track `persistentOverbought` (counter of consecutive candles with K >= 90, true if >= 3). Track `persistentOversold` (K <= 10, true if >= 3). Use `prevIndicators` to carry forward counter state.
  - **Volume**: current = last candle volume, average = SMA(20) of volumes, `isSpike` = current > average * 2, `candleDirection` = close >= open ? 'green' : 'red'

Key implementation details:
- Takes the full candle buffer (250 candles) as input
- Returns latest indicator values only
- Uses `prevIndicators` to access previous StochRSI state for persistent counters
- Divergence detection: compare last 5 candle closes (peaks/troughs) vs MACD values
- **Note:** StochRSI persistent counters are in-memory only. On server restart, counters reset to 0. This is a known limitation.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --project packages/server/tsconfig.json --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/calculator.ts
git commit -m "feat: add technical indicator calculator"
```

---

## Task 5: Server — Signal Scoring & Risk Management

**Files:**
- Create: `packages/server/src/signals.ts`

- [ ] **Step 1: Write signals.ts**

Implements the full scoring pipeline from the spec (lines 243-356):

- `generateSignal(indicators: IndicatorValues, price: PriceData, settings: UserSettings, prevSignal?: SignalData): SignalData`

**Sub-score functions (each returns its sub-score):**
- `calcStructureScore(price, indicators)`: compare `price.price` (last trade price, NOT markPrice) against each of the 6 moving averages (MA20, MA50, MA100, MA200, EMA20, EMA50). Count how many are below price → map to 0-25
- `calcMacdScore(indicators)`: histogram value + direction → 0-20
- `calcStochRsiScore(indicators)`: K/D position and crossovers → 0-20
- `calcVolumeScore(indicators)`: spike + candle direction → 0-15
- `calcFundingScore(price)`: funding rate magnitude → 0-15
- `calcEmaAlignmentScore(indicators)`: EMA20 vs EMA50 → 0-5

**Pipeline:**
1. Sum all sub-scores → base score (0-100)
2. Apply context multiplier (×0.7 if structure contradicts score)
3. Apply divergence bonus (±15 after multiplier)
4. Clamp to [0, 100]
5. Classify direction and confidence using half-open intervals:
   - `[85, 100]` → LONG, HIGH confidence
   - `[65, 85)` → LONG, normal (score 65 = LONG normal)
   - `(35, 65)` → NEUTRO
   - `(15, 35]` → SHORT, normal (score 35 = SHORT normal)
   - `[0, 15]` → SHORT, HIGH confidence

**Overrides:**
- Check all override conditions from spec table (lines 330-338)
- Overrides can block directions or add alerts
- Return overrides as string array in SignalData

**Risk Management:**
- `calcRiskManagement(direction, score, price, indicators, settings): RiskManagement | null`
- Returns null for NEUTRO
- Stop Loss: find nearest MA below (LONG) or above (SHORT), min 0.5%, fallback 1.5%
- Take Profit: dynamic R:R based on score brackets
- Position size: capital × leverage, margin = size / leverage

**Alert Detection:**
- `detectAlerts(signal, prevSignal, indicators, price, settings): Alert[]`
- Direction change
- Funding exceeds threshold
- StochRSI extreme zones
- Full alignment (score > 80) — **Note:** The threshold of 80 is a plan decision; the spec does not specify an exact threshold for full-alignment alerts.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --project packages/server/tsconfig.json --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/signals.ts
git commit -m "feat: add signal scoring, overrides, and risk management"
```

---

## Task 6: Server — Binance WebSocket Manager

**Files:**
- Create: `packages/server/src/wsManager.ts`

- [ ] **Step 1: Write wsManager.ts**

Implements WebSocket connections to Binance Futures streams. Uses `ws` library and `axios` for REST.

```typescript
import { EventEmitter } from 'events'
```

**Class: `BinanceWSManager extends EventEmitter`**

Constructor takes list of symbols. For each symbol, maintains:
- One combined WebSocket connection with 3 streams
- A candle buffer (array of CandleData, max 250)
- A `PriceData` object that is incrementally updated by both `@markPrice` and `@ticker` streams:
  - `@markPrice` updates: `markPrice`, `fundingRate`, `fundingCountdown`
  - `@ticker` updates: `price`, `change24h`, `volume24h`
  - `symbol` is set once on init
  - The emitted `'price-update'` event always sends the full merged `PriceData` object
- URL: `wss://fstream.binance.com/stream?streams=${symbol.toLowerCase()}@kline_15m/${symbol.toLowerCase()}@markPrice@1s/${symbol.toLowerCase()}@ticker`

**Methods:**
- `start()`: for each symbol, fetch historical candles via REST, then connect WebSocket
- `stop()`: close all WebSocket connections
- `addPair(symbol)`: add a new pair dynamically
- `removePair(symbol)`: remove and close connection

**WebSocket message handling:**
- Parse `data.stream` to determine type
- `@kline_15m`: if `data.data.k.x === true` (closed), parse to CandleData, add to buffer, emit `'candle-closed'` with `{ symbol, candles }`
- `@markPrice`: emit `'price-update'` with parsed PriceData (calculate fundingCountdown from nextFundingTime)
- `@ticker`: update price/change24h/volume24h in the PriceData, emit `'price-update'`

**Reconnection:**
- On close/error: exponential backoff (1s, 2s, 4s, ..., max 30s)
- On reconnect: re-fetch candles via REST before reconnecting WebSocket
- Ping every 30s

**REST candle fetch:**
- `GET /fapi/v1/klines?symbol={SYMBOL}&interval=15m&limit=200`
- Handle 429 (respect Retry-After), 418 (emit error), 5xx (retry up to 3 times)

**Events emitted:**
- `'candle-closed'`: `{ symbol, candles: CandleData[] }`
- `'price-update'`: `{ symbol, priceData: PriceData }`
- `'connection-status'`: `{ symbol, connected: boolean }`
- `'error'`: `{ symbol, error: Error }`

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --project packages/server/tsconfig.json --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/wsManager.ts
git commit -m "feat: add Binance WebSocket manager with reconnection"
```

---

## Task 7: Server — Main Entry Point (Orchestration)

**Files:**
- Create: `packages/server/src/index.ts`

- [ ] **Step 1: Write index.ts**

Ties everything together:

```typescript
import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
```

**Setup:**
1. Load config
2. Init database (create tables, load settings)
3. Create Express app + HTTP server + Socket.io (with CORS from config)
4. Create BinanceWSManager with initial pairs from settings

**Event wiring:**
- `wsManager.on('candle-closed')`: calculate indicators → generate signal → save to DB → emit `analysis-update` to all clients
- `wsManager.on('price-update')`: emit `price-update` to all clients (throttled to 1/sec per symbol)
- `wsManager.on('connection-status')`: emit to all clients

**Socket.io handlers (per client connection):**
- On connect: emit `state-snapshot` with current state of all pairs
- `add-pair`: validate symbol, call wsManager.addPair, update settings
- `remove-pair`: call wsManager.removePair, update settings
- `update-settings`: validate, save to DB, emit `settings-updated`
- `get-history`: query DB, respond via callback

**State management:**
- Keep a Map<string, PairAnalysis> in memory for current state
- Update on each candle-closed and price-update
- Throttle price-update emissions to 1/sec per symbol using a timestamp map

- [ ] **Step 2: Test server starts**

Run: `npm run dev:server`
Expected: Server listens on port 3001, database tables created, WebSocket connections established. Console logs show connection to Binance streams.

- [ ] **Step 3: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat: add server entry point with full orchestration"
```

---

## Task 8: Client — Zustand Store & Socket Hook

**Files:**
- Create: `packages/client/src/store/useStore.ts`
- Create: `packages/client/src/hooks/useSocket.ts`

- [ ] **Step 1: Write useStore.ts**

Zustand store managing all client state:

```typescript
interface AppState {
  pairs: Record<string, PairAnalysis>       // plain object, NOT Map (Zustand re-render compat)
  settings: UserSettings
  connectionStatus: Record<string, boolean> // plain object, NOT Map
  serverConnected: boolean
  // Actions
  updatePrice: (symbol: string, price: PriceData) => void
  updateAnalysis: (analysis: PairAnalysis) => void
  setConnectionStatus: (symbol: string, connected: boolean) => void
  setServerConnected: (connected: boolean) => void
  setSettings: (settings: UserSettings) => void
  setSnapshot: (analyses: PairAnalysis[]) => void
}
```

**Important:** Use `Record<string, T>` (plain objects), NOT `Map`. Zustand uses shallow equality — mutating a Map in-place won't trigger re-renders. With plain objects, spread to create new references on update: `set({ pairs: { ...get().pairs, [symbol]: data } })`.

Throttle logic is handled in the Socket hook, not here.

- [ ] **Step 2: Write useSocket.ts**

React hook that manages Socket.io connection lifecycle:

```typescript
export function useSocket(): void
```

- Connects to server on mount, disconnects on unmount
- Listens to all server events (`price-update`, `analysis-update`, `alert`, `connection-status`, `settings-updated`, `state-snapshot`)
- Routes events to Zustand store actions
- On `alert` event: triggers react-hot-toast
- Implements 1/sec throttle per symbol for price-update events using `useRef` for timestamp tracking
- Tracks server connection state (`connect`/`disconnect` events)

**Socket instance pattern:** Use a module-level variable so exported helpers can access the socket:

```typescript
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function useSocket(): void {
  // On mount: socket = io(...), set up listeners, update store
  // On unmount: socket.disconnect(), socket = null
}

// Exported helpers — access the module-level socket
export function emitAddPair(symbol: string): void { socket?.emit('add-pair', { symbol }) }
export function emitRemovePair(symbol: string): void { socket?.emit('remove-pair', { symbol }) }
export function emitUpdateSettings(settings: Partial<UserSettings>): void { socket?.emit('update-settings', settings) }
export function emitGetHistory(params: { symbol?: string, limit?: number, offset?: number }, callback: (data: { signals: SignalRecord[], total: number }) => void): void { socket?.emit('get-history', params, callback) }
```

On `alert` events, also:
- If `settings.soundAlerts` is true: play a short notification sound via `new Audio('/alert.mp3').play()`. Include an `alert.mp3` file in `packages/client/public/`.
- If `settings.desktopNotifications` is true and `Notification.permission === 'granted'`: fire `new Notification(alert.message)`. Request `Notification.requestPermission()` when the toggle is turned on in SettingsPanel.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --project packages/client/tsconfig.json --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/client/src/store/useStore.ts packages/client/src/hooks/useSocket.ts
git commit -m "feat: add Zustand store and Socket.io hook"
```

---

## Task 9: Client — App Shell & Dashboard Layout

**Depends on:** Task 8 (useSocket hook)

**Files:**
- Create: `packages/client/src/main.tsx`
- Create: `packages/client/src/App.tsx`
- Create: `packages/client/src/components/Dashboard.tsx`

- [ ] **Step 1: Write main.tsx**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 2: Write App.tsx**

```tsx
import { Toaster } from 'react-hot-toast'
import { useSocket } from './hooks/useSocket'
import Dashboard from './components/Dashboard'

export default function App() {
  useSocket()
  return (
    <>
      <Dashboard />
      <Toaster position="top-right" toastOptions={{
        style: { background: '#1a1a1a', color: '#fff', border: '1px solid #2a2a2a' }
      }} />
    </>
  )
}
```

- [ ] **Step 3: Write Dashboard.tsx**

Main layout component:
- Header bar: "Bottrade" title, server connection indicator (green dot if connected, red if not), gear icon to toggle SettingsPanel
- Grid of PairCards: responsive CSS grid (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`)
- Reads pairs from Zustand store, renders one PairCard per pair
- If no pairs: empty state message

- [ ] **Step 4: Verify client starts**

Run: `npm run dev:client`
Expected: Vite dev server starts at localhost:5173, empty Dashboard renders with header.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/main.tsx packages/client/src/App.tsx packages/client/src/components/Dashboard.tsx
git commit -m "feat: add app shell and dashboard layout"
```

---

## Task 10: Client — PairCard & PriceHeader

**Files:**
- Create: `packages/client/src/components/PairCard.tsx`
- Create: `packages/client/src/components/PriceHeader.tsx`

- [ ] **Step 1: Write PairCard.tsx**

Container component for each trading pair:
- Card styling: bg-card (#1a1a1a), border border-card-border (#2a2a2a), rounded-lg
- Left border colored by signal direction: bull green, bear red, warn yellow for NEUTRO
- Receives `PairAnalysis` as prop
- Composes: PriceHeader, IndicatorPanel, SignalPanel, RiskPanel
- If `connectionStatus` for this symbol is false: overlay with "DESCONECTADO" and grayscale filter
- If indicators not ready (lastUpdate === 0): show "Carregando indicadores..."

- [ ] **Step 2: Write PriceHeader.tsx**

Displays:
- Symbol name (e.g., "ETHUSDT") large and bold
- Current price with CSS animation (pulse/blink on change using `key` prop or transition)
- Mark price smaller next to it
- 24h change with green/red color and +/- prefix
- Funding rate with color coding:
  - Green if negative (shorts paying)
  - Yellow if 0 to +0.05%
  - Red if > +0.05%
  - Badge "EXTREMO" if > +0.10% or < -0.10%
- Funding countdown (HH:MM:SS) in muted text
- 24h volume formatted with K/M/B suffixes

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/PairCard.tsx packages/client/src/components/PriceHeader.tsx
git commit -m "feat: add PairCard container and PriceHeader component"
```

---

## Task 11: Client — IndicatorPanel

**Files:**
- Create: `packages/client/src/components/IndicatorPanel.tsx`

- [ ] **Step 1: Write IndicatorPanel.tsx**

Collapsible section showing all indicator values:

**Moving Averages table:**
- 6 rows: MA20, MA50, MA100, MA200, EMA20, EMA50
- Columns: Name, Value (formatted price), Status (✅ if price above, 🔴 if below)

**MACD section:**
- Histogram value with color (green if positive, red if negative)
- Trend text: "Momentum bullish crescendo", "Momentum bearish crescendo", etc.
- Divergence badge if detected: "DIV BULLISH" (green) or "DIV BEARISH" (red)

**StochRSI section:**
- K and D values with 2 decimal places
- Zone indicator: "SOBRECOMPRA" (red), "SOBREVENDA" (green), "NEUTRO" (yellow)
- "PERSISTENTE" badge if persistentOverbought or persistentOversold

**Volume section:**
- Current volume vs average (formatted)
- Spike indicator: ⚡ "SPIKE" badge if isSpike
- Candle direction indicator (green/red square)

- [ ] **Step 2: Commit**

```bash
git add packages/client/src/components/IndicatorPanel.tsx
git commit -m "feat: add IndicatorPanel with MA, MACD, StochRSI, Volume display"
```

---

## Task 12: Client — SignalPanel & RiskPanel

**Files:**
- Create: `packages/client/src/components/SignalPanel.tsx`
- Create: `packages/client/src/components/RiskPanel.tsx`

- [ ] **Step 1: Write SignalPanel.tsx**

Main signal display:
- Direction badge: large "LONG" (green bg), "SHORT" (red bg), or "NEUTRO" (yellow bg)
- Score bar: horizontal bar with gradient (red at 0 → yellow at 50 → green at 100). Fill width = score%. Score number displayed on the bar.
- "ALTA CONFIANCA" badge if confidence === 'high'
- Critical decision text in white, slightly larger font
- Action points as bullet list
- Entry trigger and reversal trigger if present (distinct styling)
- Overrides listed as yellow warning badges

- [ ] **Step 2: Write RiskPanel.tsx**

Risk management display (only shown when riskManagement is not null):
- Entry price
- Stop Loss: price + percentage distance in red
- Take Profit: price + percentage distance in green
- Risk:Reward ratio visual (e.g., "1:2.0" with bar)
- Position size in USDT
- Margin required in USDT
- Leverage badge (e.g., "5x")

If riskManagement is null (NEUTRO signal): show muted "Sem sugestão de trade" message.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/SignalPanel.tsx packages/client/src/components/RiskPanel.tsx
git commit -m "feat: add SignalPanel and RiskPanel components"
```

---

## Task 13: Client — SettingsPanel & AlertToast

**Files:**
- Create: `packages/client/src/components/SettingsPanel.tsx`
- Create: `packages/client/src/components/AlertToast.tsx`

- [ ] **Step 1: Write SettingsPanel.tsx**

Slide-in drawer from right side (controlled by Dashboard state):
- Overlay backdrop (dark semi-transparent)
- Panel on right with card background

Form fields:
- Capital base: number input (default R$100)
- Alavancagem: select dropdown (2x, 3x, 5x, 10x, 20x)
- Pares monitorados: list with remove button per pair + input to add new pair
- Funding threshold: number input (default 0.05)
- StochRSI high/low thresholds: number inputs
- Toggle: sons de alerta
- Toggle: notificações desktop

On change: debounce 500ms, then emit `update-settings` via socket. Show "Salvo" toast on success.

- [ ] **Step 2: Write AlertToast.tsx**

Wrapper/helper for react-hot-toast with themed styling:

```typescript
export function showAlert(alert: Alert): void
```

- `direction-change`: icon 📌, duration 5s
- `funding-extreme`: icon ⚠️, duration 8s, red border if critical
- `stochrsi-extreme`: icon ⚡, duration 5s
- `full-alignment`: icon 🟢, duration 8s, green border

Color toast border by severity:
- `info`: card-border color
- `warning`: warn yellow
- `critical`: bear red

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/components/SettingsPanel.tsx packages/client/src/components/AlertToast.tsx
git commit -m "feat: add SettingsPanel drawer and AlertToast system"
```

---

## Task 14: Integration Testing & Polish

**Files:**
- Modify: various files for bug fixes and polish

- [ ] **Step 1: Start both server and client**

Run: `npm run dev`
Expected: Server starts on 3001, connects to Binance WS for ETHUSDT and BTCUSDT, client starts on 5173.

- [ ] **Step 2: Verify real-time price updates**

Open `http://localhost:5173` in browser.
Expected: Two PairCards (ETHUSDT, BTCUSDT) showing live prices updating every ~1 second, funding rate, countdown.

- [ ] **Step 3: Verify indicator calculations**

Wait for a 15-minute candle to close (or check console logs for initial calculation from historical candles).
Expected: Indicators populate in the cards — MAs, MACD, StochRSI, Volume all showing values.

- [ ] **Step 4: Verify signal generation**

Check that signal direction, score bar, and risk management are displayed.
Expected: Each card shows LONG/SHORT/NEUTRO with score, decision text, and action points.

- [ ] **Step 5: Verify settings panel**

Click gear icon, change capital to R$500, close panel.
Expected: Risk panel updates position sizes. Settings persist across page refresh.

- [ ] **Step 6: Verify reconnection**

Temporarily disconnect internet or stop server, then restart.
Expected: Cards show "DESCONECTADO" during outage, reconnect automatically, data resumes.

- [ ] **Step 7: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix: integration testing fixes and polish"
```

---

## Task 15: Final Cleanup & Documentation

**Files:**
- Modify: `packages/client/src/styles/globals.css` (any missing animations)
- Create: `packages/client/src/components/` (any missing utility components)

- [ ] **Step 1: Add price blink animation**

In `globals.css`, add a subtle CSS animation for price changes:
```css
@keyframes price-flash {
  0% { background-color: rgba(0, 200, 150, 0.2); }
  100% { background-color: transparent; }
}
.price-flash {
  animation: price-flash 0.5s ease-out;
}
```

- [ ] **Step 2: Verify score gradient bar renders correctly**

Check that the score bar in SignalPanel shows the correct gradient fill and number.

- [ ] **Step 3: Test alert toasts**

Verify toasts appear for direction changes, funding extremes, StochRSI extremes.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: polish animations and finalize v1"
```
