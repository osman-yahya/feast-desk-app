# feast. Desk — CLAUDE.md

Electron POS & billing desktop app for feast. restaurant owners.
Cashiers use it daily; it must work fully offline after the first connect.

---

## Dev commands

```bash
npm run dev        # start Electron + Vite HMR (use this to verify changes)
npm run build      # compile only (no package)
npm run package    # build + electron-builder → dmg/exe/AppImage
```

`postinstall` runs `electron-rebuild -f -w better-sqlite3` automatically.
**Never skip it** — better-sqlite3 uses a native `.node` file that must be compiled for the current Electron ABI.

---

## Architecture overview

```
feast-desk-app/
├── src/
│   ├── main/               # Node.js / Electron main process
│   │   ├── index.js        # BrowserWindow, startup, IPC registration
│   │   ├── ipc/            # One file per domain → exports register(ipcMain)
│   │   ├── db/
│   │   │   ├── database.js          # open DB, WAL, run migrations
│   │   │   ├── migrations/          # 001_init.js, 002_fix_wall_angle.js, ...
│   │   │   └── repositories/        # one repo per table
│   │   ├── services/                # business logic (no IPC, no DB direct)
│   │   └── server/                  # Express + ws local waiter/kitchen server
│   │       ├── express.js
│   │       ├── routes/
│   │       └── public/index.html    # waiter & kitchen SPA (vanilla JS)
│   ├── preload/index.js    # contextBridge → window.feastAPI
│   └── renderer/           # React 18 SPA (Vite)
│       └── src/
│           ├── App.jsx
│           ├── config/modules.config.js
│           ├── store/               # Zustand stores
│           ├── pages/               # one directory per route
│           └── components/
│               ├── layout/          # AppShell, Sidebar, TopBar, LockGuard
│               └── ui/              # Button, Card, Modal, PasswordGate, ...
└── resources/icons/        # .icns .ico .png
```

**Renderer ↔ Main communication**: always via `window.feastAPI.*` (contextBridge).
Never import main-process modules into the renderer.
Never call `ipcRenderer` directly — all channels go through the preload bridge.

---

## IPC bridge — `window.feastAPI`

Full contract defined in `src/preload/index.js`. Summary:

```
auth:     connect(code), getRestaurant(), disconnect(), refresh(code)
menu:     get()
tables:   getFloors(), createFloor(name), getTables(floorId),
          upsertTable(data), deleteTable(id),
          getFloorElements(floorId), saveFloorElements(floorId, els[])
orders:   getOpen(), getByTable(tableId), getItems(orderId),
          create(tableId?), addItem(orderId, item), removeItem(itemId), updateItem(itemId, patch)
checkout: buildBill(orderId, pct?), markFree(itemId, bool),
          markPartialPaid(itemIds[]), applyDiscount(itemId, pct),
          finalize(orderId, method, pct?, note?), deleteOrder(orderId)
analyze:  basic(from, to), advanced(from, to)
server:   start(), stop(), status(), qr()
settings: get(key), set(key, val), getAll(),
          getDiscounts(), saveDiscount(data), deleteDiscount(id),
          getUnclosed(), closeOrder(id),
          exportConfig(), importConfig(data), pruneOldData()

// Push (main → renderer):
window.feastAPI.on('cache:stale', cb)   → menu cache is >24 h old
window.feastAPI.on('server:message', cb) → WS message forwarded from waiter
```

Allowed push channels are whitelisted in the preload (`allowed` array) — add new ones there.

---

## Database

**Engine**: better-sqlite3, WAL mode, `foreign_keys = ON`.
**Location**: `app.getPath('userData')/data/feast.db` (never in the app bundle).

### Migration system

`database.js` runs migrations in order at startup.
To add a migration:
1. Create `src/main/db/migrations/00N_description.js` exporting `default function migrate(db) { db.exec(...) }`
2. Register it in the `migrations` array in `database.js`.

Migrations are tracked in `_migrations` table — each runs exactly once.
**Never edit a migration that has already run in production.** Add a new one instead.

### Schema (abridged)

```sql
restaurant_cache  -- always row id=1, holds menu_json + level + cached_at
floors            -- id, name, sort_order
tables            -- id, floor_id, name, grid_col, grid_row, width, height, status
floor_elements    -- id, floor_id, type('wall'|'label'), grid_col, grid_row, width, height, angle(0|90), label_text
orders            -- id, table_id (NULL=direct), status('open'|'checkout_pending'|'paid'|'deleted')
order_items       -- id, order_id, menu_item_id, menu_item_name, unit_price, quantity, is_free, is_paid_partial
checkouts         -- id, order_id, subtotal, discount_total, grand_total, payment_method, items_snapshot(JSON)
predefined_discounts
settings          -- key/value store
```

`floor_elements.angle` — only `0` (horizontal `—`) and `90` (vertical `|`) are used. No CHECK constraint (removed in migration 002).

---

## Authentication flow

1. User enters code `<restaurant_id>-<restaurant_secret>` on ConnectPage.
2. `auth.service.js` posts to `https://api.feast.tr/rsts/menu/get`.
3. On success: writes `restaurant_cache` row (id=1), downloads logo image.
4. App startup: if `cached_at` > 24 h, fires background refresh and emits `cache:stale` push event.
5. `restaurant_cache.level` (1–4) gates feature modules — set once from API, never locally editable.

API response shape: `{ menu: { id, owner, name, content: { categories: [{ name, items: [{id, name, price, sold_out}] }] } } }`
Access categories as `menu.content.categories` — **not** `menu.categories`.

---

## Module access

Defined in `src/renderer/src/config/modules.config.js`.

| Module | minLevel |
|---|---|
| direct_order | 1 |
| settings | 1 |
| tables | 2 |
| analyze (basic) | 2 |
| server | 3 |
| analyze (advanced) | 4 |

`LockGuard` wraps routes — redirects if level insufficient.
`PasswordGate` wraps routes that also need the settings password (Analyze, Server, Settings, Layout Editor).
Password is session-scoped: stored in `useSettingsStore.sessionUnlocked` (Zustand, resets on app restart).

---

## State management — Zustand stores

All async calls go through `window.feastAPI.*`; stores hold UI-facing state only.

| Store | Responsibility |
|---|---|
| `useRestaurantStore` | `restaurant`, `menu`, `level`, `isConnected`, `init()`, `refresh()` |
| `useTableStore` | `floors`, `activeFloorId`, `tables`, `floorElements`, CRUD actions |
| `useOrderStore` | `directOrder`/`directItems`, `tableOrders` (map), CRUD actions |
| `useSettingsStore` | `settings`, `discounts`, `sessionUnlocked`, `unlock()`, `lock()` |
| `useServerStore` | `isRunning`, `port`, `ip`, `qrDataURL`, `waiterClients`, `kitchenClients` |

---

## Design system

Tokens in `src/renderer/src/styles/tokens.css` (CSS custom properties):

```
--color-bg:           #FFFDF8   off-white background
--color-surface:      #FFFFFF   white cards
--color-brand:        #FF3131   feast red — CTAs only
--color-dark-surface: #1C1917   dark metric cards
--color-text:         #1C1917
--color-text-muted:   #78716C
--color-border:       #E7E0D8
--radius-card:        20px
--radius-pill:        9999px
--shadow-card:        0 2px 16px rgba(0,0,0,0.07)
```

Tailwind classes map to these via `tailwind.config.js`:
`bg-surface-bg`, `bg-brand`, `text-ink`, `text-ink-muted`, `border-border-warm`,
`bg-brand-pale`, `bg-surface-dark`, `rounded-pill`, `rounded-card`, `shadow-card`.

**Visual rules**:
- Cards: `bg-white rounded-2xl shadow-card p-6`
- Dark/metric cards: `bg-surface-dark text-white`
- Primary button: pill-shaped, `bg-brand text-white`
- All icons: lucide-react, outline style
- Touch targets: qty buttons `w-8 h-8`, category/menu buttons `py-3 min-h-[44px]`

---

## UI component catalogue

| Component | Usage |
|---|---|
| `Button` | `variant` = default/secondary/danger/ghost; `size` = sm/md/lg; `icon`; `loading` |
| `Card` / `CardHeader` | `dark` prop for dark surface; `action` slot in header |
| `Modal` | `open`, `onClose`, `title`, `size` (sm/md/lg) |
| `ConfirmLock` | 3-second hold-to-confirm delete — use for all destructive actions |
| `PasswordGate` | Wraps any subtree behind settings password; session-unlocks on correct entry |
| `LockGuard` | Route-level level check; redirects to `/direct-order` if insufficient |
| `PillBadge` | `label`, `color` (green/red/gray/amber), `dot` |
| `Toast` / `useToast` | `toast(message, 'success'|'error'|'info')` |

---

## Floor editor

Grid: 20 cols × 14 rows, each cell = 56 px.

**Tools**:
- `table` — click cell → Add Table modal
- `wall` — click-drag to draw; direction picker: `—` (0°) or `|` (90°)
- `label` — click cell → Add Label modal (no `window.prompt` — uses Modal)

**SVG pattern** (critical): the dot grid SVG has `pointer-events-none`. A separate
transparent-rect SVG captures clicks/drags. Never merge them or clicks will break.

Wall drag: `onMouseDown` records start cell, `onMouseMove` shows preview, `onMouseUp` places element.
Preview is a red semi-transparent div rendered outside the SVG.

Tables and elements are saved incrementally (tables) or in bulk on Save (elements).
`isDirty` gate prevents accidental saves.

---

## Local server (Level 3)

`src/main/services/server.service.js` runs Express + ws on the same HTTP server.

**WebSocket roles**: clients connect with `?role=waiter` or `?role=kitchen`.
Tracked in `clients.waiter` and `clients.kitchen` Sets.

**Message flow**:
- Waiter adds item → `POST /api/orders/:tableId/items` → server broadcasts:
  - `order:item-added` → kitchen (via `broadcastToKitchen`)
  - `order:updated` → all (via `broadcastToAll`)
- Kitchen marks done → sends `{ type:'order:done', tableId, tableName, orderId }` via WS
  - Server calls `broadcastToWaiters({ type:'order:done', ... })`
  - Server sends `server:order-done` push event to main window renderer

**`publicDir`** (static SPA files) is resolved at runtime:
```js
app.isPackaged
  ? join(process.resourcesPath, 'public')
  : join(app.getAppPath(), 'src', 'main', 'server', 'public')
```
`electron-builder.config.js` includes `extraResources: [{ from: 'src/main/server/public', to: 'public' }]`.

API endpoints served by Express:
- `GET  /api/menu` — cached restaurant menu JSON
- `GET  /api/orders` — all open orders with table names
- `GET  /api/orders/:tableId` — order + items for one table
- `POST /api/orders/:tableId/items` — add item, auto-creates order if missing
- `GET  /api/floors` — all floors with their tables embedded

---

## Common gotchas

| Gotcha | Detail |
|---|---|
| `menu.categories` vs `menu.content.categories` | API returns `{ content: { categories } }` — always use the nested path |
| `pointer-events-none` on SVG parent | Blocks ALL child events, not just the element it's set on. Keep dot-grid SVG and click-capture SVG separate. |
| Category active index | Use array index (`activeCatIdx`), not `cat.id` — IDs may be undefined in menu JSON |
| SQLite angle CHECK | Old DBs had `CHECK(angle IN (0,30,45,60,75))` — migration 002 removed it. Never re-add a CHECK on angle. |
| `better-sqlite3` in ASAR | Must be in `asarUnpack`; `postinstall` must run after every `npm install` |
| `window.prompt` | Blocked in Electron context — use a Modal with controlled input instead |
| AppShell `main` overflow | Must be `overflow-hidden flex flex-col min-h-0`; pages manage their own scroll |
| Full-bleed pages (DirectOrder) | Use `-m-6` to escape AppShell padding, `flex flex-1 min-h-0` for height |

---

## Build & packaging

```js
// electron-builder.config.js key settings
asarUnpack: ['node_modules/better-sqlite3/**']   // CRITICAL
extraResources: [
  { from: 'resources/icons', to: 'icons' },
  { from: 'src/main/server/public', to: 'public' }
]
```

Targets: macOS `.dmg`, Windows NSIS, Linux AppImage.
