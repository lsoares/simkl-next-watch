# Pre-Trakt Cleanup Report — Hybrid Architecture

**Decision:** Keep Simkl as the metadata/catalog source; use Trakt only for user state (watched, watchlist, ratings, progress). Simpler than a full dual-provider abstraction; cleaner domain boundary.

## Progress

- ✅ **Step 1 done — Simkl credentials bundled.** Per-user Simkl app registration removed. Credentials live in gitignored `config.local.js`; tests seed test values via Playwright fixture. All 19 tests pass. See commit diff for specifics across [simklRepository.js](../simklRepository.js), [next-watch.js](../next-watch.js), [index.html](../index.html), [build.js](../build.js), and test files.

## Why hybrid

- Simkl metadata endpoints (`/tv/*`, `/movies/*`, `/search/*`, `data.simkl.in/discover/*`, `/tv/episodes/*`) work with a **public app `client_id` only** — no user OAuth, no `client_secret`. Bundled in [config.local.js](../config.local.js).
- Simkl items already carry `ids.imdb`, `ids.tmdb`, `ids.tvdb`. Trakt accepts those identifiers for all reads and writes. Cross-reference is exact, no fuzzy matching.
- Trakt uses the same pattern: bundle the app's `client_id`/`client_secret` in config.local.js; each user's `access_token` obtained via OAuth redirect at login, stored per-user in localStorage.
- Net effect: **zero signup steps for users** (one click → OAuth → done). Developer registers one Simkl app + one Trakt app, once.

## Two credential layers

| Layer | What it is | Per-user? | Bundled? |
|---|---|---|---|
| **App credential** (`client_id`, `client_secret`) | Identifies the app to the provider API | No — same for all users | ✅ Yes — in `config.local.js` |
| **User credential** (`access_token`) | Identifies the user to the provider | Yes | ❌ Never — obtained at login, stored per-user |

## Target architecture

Two thin, single-purpose modules:

### `simklCatalog.js` (renames/trims current [simklRepository.js](../simklRepository.js))
Keeps: `getTrending`, `getShow`, `getMovie`, `getEpisodes`, `searchByTitle`.
Drops: `exchangeOAuthCode`, `getLibrary`, `markWatched`, `rate`, `removeFromHistory`, `addToWatchlist`, sync cache, `normalizeItem`.
`apiFetch` collapses: hardcoded `client_id`, no bearer-token branching (no user auth needed for metadata).
Ends up ~40% the size of the current file.

### `traktUserState.js` (new)
Exports: `getWatchedMap()`, `getWatchlistSet()`, `getProgress(show)`, `markWatched(item)`, `rate(item)`, `addToWatchlist(item)`, `removeFromHistory(item)`, plus an OAuth helper (`exchangeOAuthCode`).
Keyed by IMDB/TMDB ID — matches against Simkl items without translation.
Bundled app credentials + per-user access token.

### UI layer
Stays mostly unchanged. For each Simkl item the UI asks `traktUserState` for watch/watchlist/progress. Library view = Trakt's watchlist ∪ watched, joined against Simkl details by IMDB ID (lazy-fetch details for unknown items).

## Remaining cleanup items (ordered by blocker status for the hybrid)

### 2. Simkl-specific field access across UI (HIGH)
`String(item.ids?.simkl_id || item.ids?.simkl || "")` repeated 12+ times at [next-watch.js:105,184,592,610,690,712,757,774,798,966,984,997](../next-watch.js). `simklId()` helper at [next-watch.js:7](../next-watch.js#L7) is bypassed.

Fix: **normalize at the catalog boundary** — every item emitted by `simklCatalog` has a plain `id` (IMDB ID, for cross-referencing with Trakt), plus the fields the UI actually reads:
```js
{ id, type, title, year, posterUrl, url, rating, watchedEpisodes, totalEpisodes, nextEpisode, lastWatchedAt, userRating, status }
```
`status`, `watchedEpisodes`, `userRating`, `lastWatchedAt`, `nextEpisode` come from `traktUserState`, merged in by the UI (or by a thin join helper).

### 3. Simkl URL building lives in UI (MEDIUM)
`posterUrl()`, `trendingPosterUrl()`, `buildSimklUrl()`, `buildTrendingUrl()` at [next-watch.js:71-106](../next-watch.js#L71-L106) shape Simkl-specific strings; PosterCard uses them at [next-watch.js:220,224,233](../next-watch.js#L220).

Fix: move URL construction into `simklCatalog` — emit `posterUrl` and `url` as fields on the normalized item. UI reads them; no provider-shaped strings in rendering.

### 4. Direct `simkl.*` calls for user state in UI (HIGH)
`markWatched()`, `addToWatchlist()`, `rate()`, `removeFromHistory()` called directly at [next-watch.js:467,494,509,524,540,562,615,648,751,796,921,947](../next-watch.js).

Fix: these become `traktUserState.*` calls. No interface — duck-typed module. Drop-in rename at call sites.

### 5. `hydrateMissingDetails` mixes fetch + DOM (MEDIUM)
[next-watch.js:706-745](../next-watch.js#L706-L745) — 40 lines mixing filtering, fetching, cache mutation, DOM injection. Cyclomatic ~6.

Fix: split into pure fetch/merge (returns updated items) + a separate render pass driven by state change. Follow-up after the provider split lands — not a blocker.

### 6. Global mutable state (LOW — for now)
Module-level `let currentView`, `libraryIndex`, `tvItems`, `movieItems`, `trendingBadgeSetsPromise` in the app IIFE.

Under hybrid, `libraryIndex` becomes Trakt's watchlist/watched sets keyed by IMDB ID. `tvItems`/`movieItems` become Simkl details keyed by the same IDs. Keep the globals for now; containerize later if friction grows.

### 7. `showView()` conditional chain (LOW)
5-branch if-chain acting as a state machine. Not a blocker for hybrid; revisit only if adding views.

## Remaining order of work

1. ✅ **Bundle Simkl credentials** (done).
2. **Rename `simklRepository.js` → `simklCatalog.js`**, drop all `/sync/*` methods, `normalizeItem`, sync cache. This also simplifies `apiFetch` (no bearer token branch).
3. **Add `traktUserState.js`** with OAuth (redirect flow, bundled `client_secret`) + the user-state methods. Register a Trakt app, add its credentials to `config.local.js`.
4. **Emit normalized items from `simklCatalog`** — move `posterUrl`, `url`, `id` (IMDB) into the shape; stop leaking `ids.simkl_id` and Simkl URL builders into UI.
5. **Replace `simkl.markWatched/rate/addToWatchlist/...` call sites** with `traktUserState.*`.
6. **Introduce a small join helper** that merges `{ details from simklCatalog }` with `{ state from traktUserState }` keyed by IMDB ID — feeds the UI.
7. (Follow-up) Split `hydrateMissingDetails` fetch/render; containerize globals if they hurt.

## Auth flow for Trakt (decided)

**Option A — Authorization code with bundled `client_secret`.**
Same pattern the current Simkl OAuth uses (before the cleanup, the secret was in localStorage; now it's in `config.local.js`). UX: click "Connect to Trakt" → approve on trakt.tv → redirected back → done. No PIN copy-paste.

Risk: anyone can extract `client_secret` from the bundle. Consequence: abuse of your app's rate limit; you rotate. Acceptable for a personal-scale app.

Escape hatch (later, if needed): add a tiny serverless proxy for token exchange so secrets live server-side.

## Rate-limit note

Simkl's public API is 1000 calls/day **per `client_id`**. Bundled key = shared pool. With aggressive per-item caching (metadata rarely changes) and the trending CDN not counting against quota:
- First-visit new user: ~200-300 calls (burst).
- Returning user: ~5-20 calls/day.

Fine for small audiences (<30 daily actives). For growth, add a "bring your own client_id" fallback triggered on 429 — cheap insurance.

## Out of scope

- TypeScript: only if it earns its keep during the refactor; not mandated.
- Formal `Provider` interface class: not needed. Duck-typed modules are the contract.
- Bidirectional Simkl↔Trakt sync of writes: explicitly out of scope. User state lives in Trakt only.
