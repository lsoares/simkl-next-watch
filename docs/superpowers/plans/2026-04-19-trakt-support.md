# Trakt.tv Support Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Background and decisions already captured in [pre-trakt-cleanup-report.md](../../pre-trakt-cleanup-report.md) — read that first.

**Goal:** Move user state (watched, watchlist, ratings, progress) from Simkl to Trakt.tv, while keeping Simkl as the metadata/catalog source. Hybrid architecture per the cleanup report: `simklCatalog` for read-only catalog + `traktUserState` for user state, joined at the UI by IMDB ID.

**Architecture (target):** Two thin modules loaded as classic `<script>` tags, plus a tiny join helper.

- `simklCatalog.js` — trims `simklRepository.js` to read-only methods (`getTrending`, `getShow`, `getMovie`, `getEpisodes`, `searchByTitle`). Drops every `/sync/*` call, `normalizeItem`, the sync cache, `exchangeOAuthCode`. `apiFetch` collapses: hardcoded `simkl-api-key`, no bearer-token branch.
- `traktUserState.js` (new) — OAuth (authorization code, bundled `client_secret`), plus `getWatchedMap`, `getWatchlistSet`, `getProgress(show)`, `markWatched(item)`, `undoMarkWatched(item)`, `rate(item, rating)`, `addToWatchlist(item)`, `removeFromHistory(item)`. Keyed by IMDB/TMDB/TVDB IDs, which Simkl items already carry.
- A small `join.js` (or inline in `next-watch.js`) that merges `{ details from simklCatalog }` with `{ state from traktUserState }` keyed by IMDB ID and emits the normalized UI shape.

**Tech Stack:** Plain JS, classic `<script>`, Playwright tests with network-level mocking. Test strategy unchanged: assertions live at the network boundary.

**Credentials:**
- `config.local.js` gains `window.__TRAKT_CLIENT_ID__`, `window.__TRAKT_CLIENT_SECRET__`, `window.__TRAKT_REDIRECT_URI__`. Bundled. Gitignored.
- Per-user Trakt `access_token` obtained via OAuth redirect at login, stored at `next-watch-trakt-access-token` (separate from Simkl key to allow coexistence during the cutover).

**Auth flow:** Authorization-code, same pattern Simkl OAuth already uses. One-click redirect on trakt.tv, no PIN paste.

**Test strategy:** Each slice passes `npm test` before landing. Playwright `page.route` mocks both `api.simkl.com` (read-only calls) and `api.trakt.tv` (user-state calls) with `onUnhandledRequest: "error"`. New handler helpers in `test/clients/trakt.js`.

**Important background (don't skip):**
- Cross-reference uses IMDB/TMDB/TVDB IDs. Simkl items already carry them under `ids.imdb` etc. No fuzzy matching.
- Rate-limit: Simkl public CDN + 1000/day per bundled `client_id`; Trakt 1000/5min per app. Cache aggressively — details rarely change.
- Bidirectional Simkl↔Trakt sync of writes is explicitly out of scope.
- Items coming out of the catalog layer should carry a single `id` field (IMDB ID) so the UI never reads `ids.simkl`/`ids.simkl_id` again. Today that pattern is repeated 12+ times in [next-watch.js](../../../next-watch.js) — the join is the right place to normalize it.

---

## Status

- [x] **Step 0 done — Simkl credentials bundled.** Per-user app registration removed; `config.local.js` holds the app credentials; tests seed them via Playwright fixture. See commit `88135e7`.

Everything below is remaining work.

---

## Task 1: Scaffold Trakt credentials

**Files:**
- Modify: `config.local.example.js`
- Modify: `.gitignore` (verify `config.local.js` stays ignored — no change expected)
- Modify: `test/test.js` or equivalent Playwright fixture (seed `__TRAKT_*` test values the same way `__SIMKL_*` are seeded today)

- [ ] **Step 1: Register a Trakt API app** at https://trakt.tv/oauth/applications and record `client_id`, `client_secret`, and the redirect URI. Add them to your local `config.local.js`.

- [ ] **Step 2: Add placeholders to `config.local.example.js`** matching the Simkl shape:
  ```js
  window.__TRAKT_CLIENT_ID__ ??= ""
  window.__TRAKT_CLIENT_SECRET__ ??= ""
  window.__TRAKT_REDIRECT_URI__ ??= ""
  ```

- [ ] **Step 3: Extend the Playwright fixture** that currently seeds `__SIMKL_*` to also seed `__TRAKT_*` test values.

- [ ] **Step 4: Commit.** `npm test` should still pass — no code consumes the new globals yet.

---

## Task 2: Add `traktUserState.js` (stub + OAuth)

**Files:**
- Create: `traktUserState.js`
- Modify: `index.html` (load the new script; no call-site changes yet)
- Modify: `build.js` (add to copy list)

- [ ] **Step 1: Create `traktUserState.js`** with `window.trakt = {}` and an `exchangeOAuthCode(code, redirectUri)` that POSTs to `https://api.trakt.tv/oauth/token` with the bundled credentials. Stores token at `next-watch-trakt-access-token` (caller writes, not the repo, so the token is never implicit).
- [ ] **Step 2: Add an internal `traktFetch(path, options)` helper** that sets `trakt-api-version: 2`, `trakt-api-key: __TRAKT_CLIENT_ID__`, `Authorization: Bearer <token>` when present, `Content-Type: application/json`. Throws `ApiError` on non-2xx.
- [ ] **Step 3: Load `traktUserState.js` in `index.html`** right after `simklRepository.js`. Add to `build.js` copy list.
- [ ] **Step 4: Verify `window.trakt.exchangeOAuthCode` is defined.** `npm test` passes — no call sites yet.
- [ ] **Step 5: Commit.**

---

## Task 3: Implement Trakt user-state reads

**Files:**
- Modify: `traktUserState.js`
- Create: `test/clients/trakt.js` (MSW-style handler helpers)

Trakt endpoints to wire up (fill in exact shapes during implementation; all require a bearer token):

| Method | Trakt endpoint | Returns |
|---|---|---|
| `getWatchedMap(type)` | `GET /sync/watched/{shows,movies}` | `Map<imdbId, { watchedAt, episodesWatched?, totalEpisodes? }>` |
| `getWatchlistSet(type)` | `GET /sync/watchlist/{shows,movies}` | `Set<imdbId>` |
| `getProgress(showId)` | `GET /shows/:id/progress/watched` | `{ nextEpisode, aired, completed }` |
| `getRatings(type)` | `GET /sync/ratings/{shows,movies}` | `Map<imdbId, rating>` |

- [ ] **Step 1: Implement the four read methods** above. Cache the full watched/watchlist/ratings pulls in memory for the session; re-fetch only when a write runs.
- [ ] **Step 2: Add handler helpers** in `test/clients/trakt.js` named by action (`listWatchedShows`, `listWatchlist`, `showProgress`, `listRatings`) that hardcode URL + verify headers.
- [ ] **Step 3: Write a unit-level Playwright test** that boots the page, stubs the four endpoints, and verifies the four repo methods resolve to the expected shapes.
- [ ] **Step 4: Commit.**

---

## Task 4: Implement Trakt user-state writes

**Files:**
- Modify: `traktUserState.js`
- Modify: `test/clients/trakt.js`

| Method | Trakt endpoint |
|---|---|
| `markWatched(item)` | `POST /sync/history` |
| `undoMarkWatched(item)` | `POST /sync/history/remove` |
| `rate(item, rating)` | `POST /sync/ratings` |
| `addToWatchlist(item)` | `POST /sync/watchlist` |
| `removeFromWatchlist(item)` | `POST /sync/watchlist/remove` |

- [ ] **Step 1: Implement the five write methods.** Payload builders must accept the normalized UI item shape (see Task 6) and key by IMDB ID; no Simkl fields in the payload.
- [ ] **Step 2: Extend `test/clients/trakt.js`** with write handlers that assert the outgoing body.
- [ ] **Step 3: Commit.**

---

## Task 5: Swap OAuth at login from Simkl to Trakt

**Files:**
- Modify: `next-watch.js` (OAuth redirect handler near line 1079)
- Modify: `index.html` ("Get Started" button — update label + href)

- [ ] **Step 1: Update the "Get Started" CTA** to point at Trakt's OAuth authorize URL using `__TRAKT_CLIENT_ID__` + `__TRAKT_REDIRECT_URI__`.
- [ ] **Step 2: In the redirect handler**, replace `simkl.exchangeOAuthCode(code, ...)` with `trakt.exchangeOAuthCode(code, window.__TRAKT_REDIRECT_URI__)` and store the returned token at `next-watch-trakt-access-token`.
- [ ] **Step 3: Update `test/logged-out.test.js` and `test/loginViaOAuth.js`** to point at the Trakt token endpoint instead of Simkl.
- [ ] **Step 4: Commit.** At this point the user signs in with Trakt; the app still calls `simkl.*` for sync — the next tasks cut those over.

---

## Task 6: Normalize items at the catalog boundary

**Files:**
- Modify: `simklRepository.js`
- Modify: `next-watch.js` (drop `simklId()` reads of `ids.simkl_id`/`ids.simkl`; the new `item.id` is the IMDB ID)

- [ ] **Step 1: Change every catalog-returning method** (`getTrending`, `getShow`, `getMovie`, `searchByTitle`, `getEpisodes`) to emit:
  ```js
  { id, type, title, year, posterUrl, url, ratings, runtime }
  ```
  where `id` is the IMDB ID (fall back to `tmdb:` / `tvdb:` prefixed strings only when IMDB is absent). `posterUrl` and `url` are fully built — no UI-side string construction.
- [ ] **Step 2: Delete `posterUrl`, `trendingPosterUrl`, `buildSimklUrl`, `buildTrendingUrl`, `simklId`** from `next-watch.js`. Update the 12+ call sites to read `item.id` and `item.posterUrl` / `item.url` directly.
- [ ] **Step 3: Update `test/clients/simkl.js`** handlers — the request contract is unchanged; only the shape returned from mocks may need to align with what the catalog emits to the UI.
- [ ] **Step 4: Commit.**

---

## Task 7: Swap user-state call sites from `simkl.*` to `trakt.*`

**Files:**
- Modify: `next-watch.js` (all sites listed below)

Sites (line numbers as of `b9a4a1b`):

| Line | Current | New |
|---|---|---|
| 457 | `simkl.markWatched(item, type)` | `trakt.markWatched(item)` |
| 469 | `simkl.undoMarkWatched(item, type)` | `trakt.undoMarkWatched(item)` |
| 505–506 | `simkl.rate(...)`, `simkl.markWatched(...)` | `trakt.rate(...)`, `trakt.markWatched(...)` |
| 521 | `simkl.markWatched(item, "movie")` | `trakt.markWatched(item)` |
| 563 | `const data = await simkl.getLibrary()` | Join helper: `trakt.getWatchedMap()` ∪ `trakt.getWatchlistSet()` + `trakt.getRatings()`, details lazy-fetched from `simklCatalog.getShow/getMovie` for unknowns |
| 616 | `simkl.addToWatchlist(item, card.type)` | `trakt.addToWatchlist(item)` |
| 949 | `await simkl.getLibrary()` | Same join as line 563 |

- [ ] **Step 1: Introduce the join helper** (inline function or tiny `join.js`) and replace the two `simkl.getLibrary()` call sites first. This is the hardest part — the rest of the swap rests on it.
- [ ] **Step 2: Swap the write call sites** in order listed. Each swap is one-line and followed by `npm test`.
- [ ] **Step 3: Commit each logical group.**

---

## Task 8: Rename `simklRepository.js` → `simklCatalog.js`, drop `/sync/*`

**Files:**
- Rename: `simklRepository.js` → `simklCatalog.js`
- Modify: `simklCatalog.js` (delete `/sync/*` methods, `normalizeItem`, `readSyncCache`/`writeSyncCache`, `compressJson`/`decompressJson`, the `next-watch-access-token` bearer branch)
- Modify: `index.html`, `build.js` (update the filename)
- Modify: test handler imports (`test/clients/simkl.js` — probably no changes, since endpoints are unchanged)

- [ ] **Step 1: Rename file** and update `<script src>` in `index.html` + copy list in `build.js`.
- [ ] **Step 2: Delete from the new file**: `exchangeOAuthCode`, `getLibrary`, `markWatched`, `undoMarkWatched`, `rate`, `addToWatchlist`, `normalizeItem`, the sync cache, and the token-bearer branch of `apiFetch`. Also rename `window.simkl` → `window.simklCatalog`.
- [ ] **Step 3: Update call sites** (`next-watch.js`) from `simkl.getShow` etc. to `simklCatalog.getShow` etc.
- [ ] **Step 4: Remove `next-watch-access-token`** and `next-watch-client-secret` from storage key usage anywhere in the tree — they're Simkl-era artifacts.
- [ ] **Step 5: Commit.**

---

## Task 9: Cleanup + release gate

- [ ] **Step 1:** `grep -n "simkl\.\(markWatched\|rate\|addToWatchlist\|getLibrary\|undoMarkWatched\|exchangeOAuthCode\)" next-watch.js` — expect no matches.
- [ ] **Step 2:** `grep -n "ids\.simkl" next-watch.js` — expect no matches.
- [ ] **Step 3:** `npm test` + `npm run build` both clean.
- [ ] **Step 4:** Manually test end-to-end: fresh login via Trakt, mark watched, undo, rate, add to watchlist, remove, AI suggestions, trending.
- [ ] **Step 5:** Update `README.md` with the Trakt app-registration step; delete the Simkl app-registration section.
- [ ] **Step 6:** Commit.

---

## Open questions (resolve during implementation)

1. **Metadata for items that exist on Trakt but not Simkl** (e.g. user added a title on Trakt that Simkl's search can't resolve). Fall back to showing Trakt's own title/poster? Hide it? Decide when the join helper lands — Task 7 Step 1.
2. **Anime.** Simkl splits anime out as a third bucket; Trakt treats it as shows. Plan assumes anime rolls into shows for user-state; verify with a test show that carries `anime_type` on Simkl.
3. **Episode-level progress.** Trakt's `/shows/:id/progress/watched` is richer than Simkl's `next_to_watch`. Map carefully so the "Next" list ordering logic in `buildTvSuggestions` still gets what it needs.
4. **Rate-limit fallback.** Cleanup report mentions a "bring your own client_id" escape hatch on 429. Not in scope here; flag for follow-up.
