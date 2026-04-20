# Trakt Integration — Open Questions

Decisions to make before filling the Trakt stubs in [src/traktUserData.js](src/traktUserData.js).

---

## 1. Token refresh

**Decision:** No refresh flow. Let the Trakt token expire; on 401 the user re-auths. Don't persist `refresh_token`, don't add proactive refresh, don't add a shared token layer. Treat expiry as a normal sign-out.

## 2. Catalog (trending, episodes, details)

**Decision:** Keep `simklCatalog.js` as the single catalog source. No `traktCatalog.js`, no `currentCatalog()` indirection. Trending, episode titles, and show details always come from Simkl regardless of signed-in provider. Watched/watching badges on trending items already cross the provider-agnostic `getLibrary()` output, so this keeps working across providers.

## 3. Anime

**Decision:** No anime/shows split. Anime items are merged into shows (or movies, for anime movies) at the normalization boundary. Matches Simkl's existing merged treatment. Provider switch clears all cache, so no mid-session inconsistency to handle.

## 4. Library granularity + `extended=full`

**Decision:** Selective `extended=full` — only on `/sync/watchlist/*`, not `/sync/watched/*`.

- Per-episode `last_watched_at` comes from the compact `/sync/watched/{shows,movies}` payload already (seasons[].episodes[]). No need for `extended=full` there — we skip the heavy metadata blob (overview, genres, translations, runtime, status, aired_episodes).
- `aired_episodes` from `extended=full` matters only on watchlist — to hide unaired shows from the "to-watch" row. Watchlist is tiny so the size cost is negligible.
- Losing `runtime` on watched (compact mode) means the watching-priority tiebreaker for "1 episode left" shows falls back to last-watched sort. Minor quality hit; accepted.
- Play count and per-play history NOT needed. Skip `/sync/history` pagination entirely.

## 5. Watchlist semantics

**Decisions:**
- Single `watchlist` concept at the normalized boundary. Both providers expose the same shape; `next-watch.js` never branches. Cache absorbs any double-call cost on the Simkl side.
- Mirror Simkl's undo-watched behavior on Trakt: for movies, undo = `POST /sync/history/remove` + `POST /sync/watchlist` in the same operation.

## 6. Activities / delta sync

**Decision:** Per-section signature sync on both providers. The library is cached as six slices (`watched_shows`, `watched_movies`, `watchlist_shows`, `watchlist_movies`, `ratings_shows`, `ratings_movies`), each tagged with the activity timestamp last observed. On load, fetch the activities endpoint once and refetch only the slices whose timestamp bumped.

- **Simkl**: `/sync/activities` returns per-section timestamps; existing `date_from` delta on `/sync/all-items/{type}` handles slices that changed. Ratings ride inline on library items — no separate ratings endpoint needed.
- **Trakt**: `/sync/last_activities` returns per-section timestamps. Six underlying endpoints, all parallelizable on a signature change:
  - `GET /sync/watched/{shows,movies}` (compact — `extended=full` not worth the size)
  - `GET /sync/watchlist/{shows,movies}?extended=full` (cheap; `aired_episodes` needed to filter unaired from the "to-watch" row)
  - `GET /sync/ratings/{shows,movies}` (only rated items; small)
- Cache stored per provider; provider switch clears the full cache.

## 6a. Mutation invalidation (selective)

Each mutation bumps only the section(s) it affects — no blanket cache clear. Optimistic in-memory patch + zero the affected section's timestamp to force reconciliation on next load:

| Mutation | Sections invalidated |
|---|---|
| `markWatched(show)` | `watched_shows` |
| `markWatched(movie)` | `watched_movies` |
| `undoMarkWatched(show)` | `watched_shows` |
| `undoMarkWatched(movie)` | `watched_movies` + `watchlist_movies` (re-add quirk, Decision 5) |
| `rate(item)` | `ratings_{type}` |
| `addToWatchlist(item)` | `watchlist_{type}` |

Simkl's existing signature-based sync achieves this implicitly via `date_from`. Trakt implements it explicitly.

## 7. Rate limits

**Decision:** On 429, silent retry with backoff (respect `Retry-After` header when present, otherwise exponential). No user-facing error. App has no bulk import flows, so POST 1/sec is rarely hit in practice.

## 8. Error + auth-key UX

**Decision:** No edge case to handle. Button stays gated on `__TRAKT_CLIENT_ID__` until Trakt is tested locally end-to-end. Until then no one can have a Trakt session, so orphan-session scenarios don't exist. Enable for all in one flip when ready.

## 9. Tests

**Decisions:**
- Add `test/clients/trakt.js` mirroring the `simkl.js` handler-helper shape (named by action, file name identifies provider — per CLAUDE.md).
- Duplicate each feature test for Trakt with provider in the filename (e.g. `next-simkl.spec.js` / `next-trakt.spec.js`). No parameterization.
- **Act and assert must match across provider test pairs.** Only the Arrange section (MSW handlers, fixture shape) may differ — it reflects each provider's API. Keeping act/assert identical enforces that the normalized boundary actually normalizes: if a Trakt test needs a different assertion than its Simkl twin, that's a leak and should be fixed in the provider layer, not accommodated in the test.

## 10. Provider switching UX

**Decisions:**
- One provider at a time. Never simultaneous.
- Switching providers = start from scratch: clear cache, clear the previous provider's token, reset UI state.
- Sign-out returns to logged-out state. No fallback to the other provider.

---

# Incremental roadmap

Each step ships something a user can see or use. Tests land with each step.

## Step 1 — Trakt OAuth ✅

Already done: sign-in flow, token storage, sign-out, 401 → auto re-auth. Paired spec [test/logged-out.test.js](test/logged-out.test.js).

## Step 2 — Unified Trakt library sync

Replace the current per-method ad-hoc caches [traktUserData.js:7-16](src/traktUserData.js#L7-L16) with one signature-gated pipeline (`loadRawLibrary`), mirroring [simklUserData.js:10-62](src/simklUserData.js#L10-L62):

- `GET /sync/last_activities` → per-section timestamps, used as the cache signature.
- Cache shape: `{ sig, sections: { watched_shows: { data, ts }, watched_movies, watchlist_shows, watchlist_movies, ratings_shows, ratings_movies } }`.
- On load: compare each section's `ts` to `sig[section]`; refetch only bumped sections, in parallel:
  - `/sync/watched/{shows,movies}` — compact (no `extended=full`; see Decision 4)
  - `/sync/watchlist/{shows,movies}?extended=full` — needs `aired_episodes` to gate the "to-watch" row
  - `/sync/ratings/{shows,movies}` — small, only rated items
- Expose `getWatchingShows` / `getWatchlistShows` / `getWatchlistMovies` off the unified cache.
- **User value:** all three rows populate for Trakt sessions.
- **Tests:** `test/clients/trakt.js` handlers for `/sync/last_activities` + six slice endpoints; next-watch spec already duplicated as `next.trakt.test.js`.

## Step 3 — New contract: by-id lookups + rated pool (both providers)

The `getCompletedShows` / `getCompletedMovies` methods die — no consumer needs "give me every completed item" anymore.

- Add `getShowById(id)` / `getMovieById(id)` on both providers. Returns the normalized item (with `status`, `user_rating`, `last_watched_at`, …) or `null`. Both implementations are Map lookups over the library cache.
- Add `getRatedPool({type})` on both providers. Returns items with `user_rating != null`.
- Migrate callers:
  - Trending watched/watching badges [next-watch.js:516](src/next-watch.js#L516) → `getShowById` / `getMovieById`.
  - AI suggestions [next-watch.js:975-981](src/next-watch.js#L975-L981) → `getRatedPool`.
- Delete `getCompletedShows` / `getCompletedMovies` from both provider files.
- **User value:** trending watched-badges work for Trakt; AI suggestions ingest Trakt ratings.
- **Tests:** paired spec for badge cross-ref; AI-suggestions spec duplicated for Trakt.

## Step 4 — Posters for Trakt items (Simkl cross-ref)

Trakt removed images from its API in 2017 and officially points clients at TMDB. Chosen approach: **start with Simkl cross-ref, evolve to TMDB later** if coverage becomes a problem.

**Critical constraint: lazy, per-item lookup — never bulk-hydrate the library.** The UI only renders a handful of items at a time. Posters are fetched only for those.

- Each normalized Trakt item carries `ids.imdb`. When the UI is about to render an item without a cached poster, look up `GET https://api.simkl.com/search/id?imdb={ttid}` to get `poster` (plus `title`, `year`, `status`, `total_episodes`, `ids.simkl`, and the IMDb rating for the badge).
- Cache per-item on first lookup (stash `poster` / `ids.simkl` alongside the item in the library cache). Subsequent renders are free.
- Items Simkl doesn't index render with a placeholder — acceptable for v1.
- **Evolution path:** if coverage gaps show up, swap to TMDB (`ids.tmdb` already on every Trakt item; `__TMDB_API_KEY__` already in `config.local.js`). Interface unchanged.
- **User value:** Trakt cards render with posters and IMDb-rating badges.
- **Tests:** handler in `test/clients/simkl.js` for the id-lookup endpoint; assert the lookup fires only for rendered items.

## Step 5 — Mutations (with selective invalidation)

One step for all four since they share the per-section invalidation pattern (Decision 6a):

- `markWatched(item)` → `POST /sync/history` (`{episodes}` for TV, `{movies, watched_at}` for movies; explicit `watched_at`, default is release date).
- `undoMarkWatched(item)` → `POST /sync/history/remove`; movies also `POST /sync/watchlist` (Decision 5 re-add quirk).
- `rate(item, rating)` → `POST /sync/ratings` with `rated_at`.
- `addToWatchlist(item)` → `POST /sync/watchlist`.
- Each mutation: optimistic in-memory patch of the affected slice + zero that slice's `ts` so the next load reconciles.
- **User value:** full mutation parity.
- **Tests:** paired spec per mutation; assert the right sections get refetched on next load (not all six).

## Step 6 — Progressive rendering (optional, both providers)

Refactor `loadSuggestions` to render per-slice as each resolves instead of awaiting all. Simkl gets this for free (single underlying fetch). Trakt gets a real first-paint win since its slices are distinct network calls.

## Step 7 — Rate-limit resilience

Silent 429 retry with `Retry-After` backoff in Trakt's `apiFetch`. **Tests:** MSW handler returns 429 once, 200 on retry.

## Step 8 — Flip the switch

Unset the `__TRAKT_CLIENT_ID__` gate on the sign-in button in prod config. Trakt is live.

---

# Feature parity matrix

Columns: **Simkl** (state today) / **Trakt** (state today) / **Importance** (user-visible impact) / **Easiness** (implementation cost). Rows ordered roughly by shipping order.

## Read path

| Feature | Simkl | Trakt | Importance | Easiness |
|---|---|---|---|---|
| **Unified `loadRawLibrary()`** (signature-gated, per-section refetch) | ✅ [simklUserData.js:10](src/simklUserData.js#L10) | ❌ ad-hoc per-method caches today [traktUserData.js:7-16](src/traktUserData.js#L7-L16) | High — foundation for everything below | Medium — Step 2 |
| `getWatchlistMovies` | ✅ | ✅ [traktUserData.js](src/traktUserData.js) (`/sync/watchlist/movies?extended=full`, cached as `-v0`, filters unreleased by `movie.released` date) | High — movies row blank | Done |
| `getShowById` / `getMovieById` (Map lookup) | new on both | new on both | High — replaces `getCompleted*` for trending badges | Easy — Step 3 |
| `getRatedPool({type})` (filter cache to `user_rating != null`) | new on both | new on both | High — AI-suggestions input | Easy — Step 3 |
| **Poster image** (`posterUrl`) | native | ❌ always `""` | High — Trakt cards blank otherwise | Medium — lazy `GET /search/id?imdb=…` at render, Step 4 |
| **IMDb rating badge** (`ratings.imdb.rating`) | inline in `/sync/all-items` | ❌ not in Trakt API | Medium — badge [next-watch.js:164](src/next-watch.js#L164) + AI sort fallback [next-watch.js:1005](src/next-watch.js#L1005) | Free — piggybacks on the Step 4 id-lookup |

## Write path

| Feature | Simkl | Trakt | Importance | Easiness |
|---|---|---|---|---|
| `markWatched` | ✅ | ❌ throws [traktUserData.js:104](src/traktUserData.js#L104) | High — core interaction | Easy — `POST /sync/history` (explicit `watched_at`: default is release date) |
| `undoMarkWatched` | ✅ (movie→re-watchlist quirk [simklUserData.js:174-176](src/simklUserData.js#L174-L176)) | ❌ throws | Medium | Medium — remove + re-add-to-watchlist for movies |
| `rate` | ✅ | ❌ throws | Medium — feeds AI | Easy — `POST /sync/ratings` |
| `addToWatchlist` | ✅ | ❌ throws | Medium | Easy — `POST /sync/watchlist` |
| **Selective section invalidation** on mutate (Decision 6a) | implicit via `/sync/activities` + `date_from` | explicit per-section `ts` reset | High — avoids nuking 5 warm slices for one change | Medium — Step 5 (bakes in with mutations) |

## Operational

| Feature | Simkl | Trakt | Importance | Easiness |
|---|---|---|---|---|
| **Progressive rendering** (row-by-row, not `Promise.all`) | free | real first-paint win | Medium | Medium — Step 6 |
| **429 retry with `Retry-After`** | n/a | ❌ | Low | Easy — Step 7 |
| **Sign-in gate** | always on | `__TRAKT_CLIENT_ID__` env-gated [traktUserData.js:4](src/traktUserData.js#L4) | Final | Trivial — Step 8 |

## Tests

| Feature | Simkl | Trakt | Importance | Easiness |
|---|---|---|---|---|
| Paired spec per feature (`*.simkl.test.js` / `*.trakt.test.js`) | ✅ | partial — only `next.trakt.test.js` lives so far; mutation + badges + AI-suggestions pairs pending | High — act/assert match across pairs proves normalization | Easy per feature |
