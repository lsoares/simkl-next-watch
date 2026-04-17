# Simkl Repository — Design

## Goal

Isolate every Simkl network call behind a single `simkl` object exposed by a
new `simklRepository.js`. Call sites stop building payloads, stop knowing URL
shapes, and stop reaching for `apiFetch` / `apiPost`. A future Trakt.tv (or
other) backend can implement the same object shape and be swapped in.

Even if the swap never happens, the call sites read as domain actions
(`simkl.markWatched(item, "show")`) rather than transport details
(`apiPost("/sync/history", buildMarkWatchedPayload(item, "show"))`).

## File layout

- New: `simklRepository.js` at project root.
- `index.html` loads it via `<script src="./simklRepository.js"></script>`
  immediately before the existing inline `<script>`.
- `build.js` copies `simklRepository.js` into `dist/` alongside the other
  static assets.
- The repo sets `window.simkl` (global). No module system; matches the
  project's plain-script style.

## API

All methods live on `simkl`. `simkl.ApiError` is the shared error class thrown
on non-OK responses.

### OAuth

- `simkl.exchangeOAuthCode(code, redirectUri) → Promise<tokenResponse>`
  Posts to `/oauth/token` with `client_id` / `client_secret` read from
  `localStorage`, returns the parsed response (caller reads `access_token`).

### Library sync (raw endpoints; app keeps its cache layer)

- `simkl.getActivities() → Promise<activities>`
  POST `/sync/activities`.
- `simkl.getAllItems(type, dateFrom?) → Promise<Item[]>`
  GET `/sync/all-items/{type}/?extended=full&episode_watched_at=yes&date_from=…`.
  Items are already passed through the repo's internal `normalizeItem`. The
  app's `sync()` function continues to orchestrate cache validity / merging
  using these two methods.

### Writes

Each method builds its payload inline in its own body — no
`buildXxxPayload` helpers carried over. `type` follows the vocabulary
already used at call sites: `"tv"` or `"movie"`. The repo translates to
the `shows` / `movies` payload key internally.

- `simkl.markWatched(item, type)` — POST `/sync/history`.
  Preserves the current quirk: `"tv"` with a parseable `next_to_watch`
  posts a `shows`-shaped payload keyed to that season/episode; otherwise
  falls through to a `movies`-shaped payload. Matches today's behaviour;
  revisiting it is out of scope.
- `simkl.rate(item, type, rating)` — POST `/sync/ratings`
- `simkl.removeFromHistory(item, type)` — POST `/sync/history/remove`
- `simkl.addToWatchlist(item, type)` — POST `/sync/add-to-list`.
  Accepts `type` ("tv"/"movie") instead of today's `urlBase` string.

### Details

- `simkl.getEpisodes(showId) → Promise<Episode[]>`
  GET `/tv/episodes/:id`.
- `simkl.getShow(id) → Promise<Show>` — GET `/tv/:id?extended=full`.
- `simkl.getMovie(id) → Promise<Movie>` — GET `/movies/:id?extended=full`.

### Search

- `simkl.searchByTitle(title, year, type?) → Promise<Item | null>`
  - `type === "tv"` → GET `/search/tv`
  - `type === "movie"` → GET `/search/movie`
  - `type` omitted → both in parallel, first non-null wins (TV preferred,
    matching current `resolveSimkl` behaviour).
  - Query is `encodeURIComponent("${title} ${year || ''}".trim())`, limit=1,
    extended=full.
  - Returns the first hit or `null`. Errors are swallowed to `null` (current
    behaviour at call site).

### Trending

- `simkl.getTrending(period) → Promise<{ tv, movies }>`
  Fetches `https://data.simkl.in/discover/trending/tv/${period}_100.json` and
  `.../movies/${period}_100.json` in parallel. `period ∈ "today"|"week"|"month"`.

## Internals (not exported)

- `API_BASE = "https://api.simkl.com"`.
- `apiFetch(path, options)` / `apiPost(path, payload)` — private helpers,
  read `simkl-api-key` (client ID) and `Authorization: Bearer …` (access
  token) straight from `localStorage` using the same keys the app already
  uses.
- `normalizeItem` — moves inside; used only by `getAllItems`.
- No payload-builder helpers. Each write method (`markWatched`, `rate`,
  `removeFromHistory`, `addToWatchlist`) constructs its request body inline.
  The old `buildMarkWatchedPayload` / `buildRatePayload` /
  `buildRemovePayload` / `buildAddToWatchlistPayload` functions are deleted,
  not relocated.
- `ApiError` class lives here; re-exposed as `simkl.ApiError` so call sites
  can still `throw new simkl.ApiError(...)` and `instanceof` check.

## Credentials

The repo reads `localStorage` directly using the same `STORAGE.clientId` /
`STORAGE.accessToken` key strings currently used in `index.html`. To avoid
defining the keys twice, the repo carries its own small constants for the
two keys it needs (`"nw.clientId"`, `"nw.accessToken"`) — these are protocol
identifiers (shared with the rest of the app), not code duplication to
worry about. A future Trakt repo would read its own keys.

## Changes to index.html

Remove (deleted outright, not relocated unless noted):
- `API_BASE`, `ApiError` class (moved into the repo)
- `apiFetch`, `apiPost`
- `fetchAllItems` (replaced by `simkl.getAllItems`)
- `buildMarkWatchedPayload`, `buildRatePayload`, `buildRemovePayload`,
  `buildAddToWatchlistPayload` — inlined into the repo's write methods
- `normalizeItem` (moved into the repo)
- `fetchTrending` (inside `loadTrendingBadgeSets`) — replaced by
  `simkl.getTrending`
- Raw `fetch` to `/oauth/token` inside the OAuth redirect handler

Replace call sites:

| Before                                                            | After                                              |
|-------------------------------------------------------------------|----------------------------------------------------|
| `apiPost("/sync/history", buildMarkWatchedPayload(item, type))`   | `simkl.markWatched(item, type)`                    |
| `apiPost("/sync/ratings", buildRatePayload(item, type, rating))`  | `simkl.rate(item, type, rating)`                   |
| `apiPost("/sync/history/remove", buildRemovePayload(...))`        | `simkl.removeFromHistory(item, type)`              |
| `apiPost("/sync/add-to-list", buildAddToWatchlistPayload(...))`   | `simkl.addToWatchlist(item, type)`                 |
| `apiFetch("/sync/activities", { method: "POST" })`                | `simkl.getActivities()`                            |
| `fetchAllItems(type, dateFrom)`                                   | `simkl.getAllItems(type, dateFrom)`                |
| `apiFetch(\`/tv/episodes/${id}\`)`                                | `simkl.getEpisodes(id)`                            |
| `apiFetch(\`/tv/${id}?extended=full\`)`                           | `simkl.getShow(id)`                                |
| `apiFetch(\`/movies/${id}?extended=full\`)`                       | `simkl.getMovie(id)`                               |
| `apiFetch(\`/search/tv?q=…\`)` etc in `resolveSimkl`              | `simkl.searchByTitle(title, year, type)`           |
| Both `fetch("…data.simkl.in/discover/trending/…")` calls          | `simkl.getTrending(period)`                        |
| `fetch(\`${API_BASE}/oauth/token\`, …)` in OAuth handler          | `simkl.exchangeOAuthCode(code, redirectUri)`       |
| `throw new ApiError(…)` / `instanceof ApiError`                   | `throw new simkl.ApiError(…)` / `instanceof simkl.ApiError` |

`sync()`, `loadTrendingBadgeSets`, the ratings cache, and the episode-title
cache stay in `index.html` — they're app-level concerns that happen to use
repo data.

## Testing

MSW handlers in `test/clients/simkl.js` intercept URLs. Since the repo sends
the same requests the app currently sends (same paths, same headers, same
bodies), the existing tests must pass unchanged. The implementation plan
will run the full Playwright suite as verification after each step.

## Trakt swap story (non-goal for this change)

A future `traktRepository.js` sets `window.trakt` with the same method
shape, reading its own localStorage keys. Call sites either switch to
`trakt.*` directly, or a one-line indirection at the top of `index.html`
(`const repo = useTrakt ? trakt : simkl;`) picks per user preference.
Normalization of the library item shape becomes the repo's responsibility
— Trakt's `normalizeItem` would have to produce the same fields the app
consumes today. This spec doesn't define that shape; it's captured implicitly
by what the current `normalizeItem` produces.

## Out of scope

- Extracting a formal `Repository` interface / type definition.
- Actually adding Trakt support.
- Changing item/normalization shape.
- Moving the service worker's fetch logic.
- Restructuring `sync()` cache logic.
