# TMDB as the poster source

## Goal

Move all poster URL production out of the Simkl and Trakt repositories and into a
new `tmdbRepository.js`. Everything else — auth, library reads/writes, trending,
search result metadata, URL construction, episode titles, "more like this" —
stays on the provider repos exactly as today.

## Why

Current state: each provider builds its own poster URLs from provider-specific
poster codes (Simkl `_c.webp` / `_m.webp`, Trakt's resolution-via-Simkl
fallback). Posters are inconsistent across logins, often missing for AI picks,
and the Simkl-by-IMDb fallback (`lookupByImdb`) has low hit-rate. TMDB has near-
universal coverage, a single consistent URL scheme, and is free.

## Scope

**In scope**
- New `src/tmdbRepository.js` — the single source of poster URLs.
- Provider repos stop populating `posterUrl` and drop their poster helpers.
- Existing lazy-hydration paths switch to TMDB.

**Out of scope**
- No change to trending, search metadata, URLs, episode titles, badges, auth,
  library data, or any user-facing navigation target.
- No batch/pre-hydration of the library; posters remain lazy.

## `src/tmdbRepository.js`

```
export const tmdbRepository = {
  getPosterByIds({ tmdb, imdb, type }) -> Promise<string>   // "" if no match
  getPosterByTitle(title, year, type)  -> Promise<string>   // "" if no match
}
```

- API key read from `window.__TMDB_API_KEY__`. Throws at call time if missing
  (same pattern as `__SIMKL_CLIENT_ID__`).
- Image base: `https://image.tmdb.org/t/p/w342` — one size everywhere, served
  directly by TMDB's CDN (no wsrv.nl proxy; the current Simkl proxying exists
  because Simkl's poster host is occasionally slow, which does not apply here). Covers
  retina mobile cards (~130–170 CSS px × DPR 2) and is acceptable on desktop
  cards (≤250 CSS px). Smaller than `w500` by 30–50% on the wire.
- Endpoints:
  - `GET /3/{tv|movie}/{tmdb_id}` → `poster_path` (preferred when we have a TMDB id)
  - `GET /3/find/{imdb_id}?external_source=imdb_id` → first match's `poster_path`
  - `GET /3/search/{tv|movie}?query=<title>&year=<year>` → first result's `poster_path`
- Resolution order in `getPosterByIds`: tmdb → imdb → return "".
- Persistent localStorage cache (same shape as
  `next-watch-simkl-imdb-lookup-v0`), keyed by:
  - `tmdb:{type}:{id}`
  - `imdb:{id}`
  - `title:{slug}:{year}:{type}`
  Value is the full `https://image.tmdb.org/t/p/w342/...` URL or `""`.
  Cache key: `next-watch-tmdb-poster-v0`.
- In-flight dedup map so simultaneous calls for the same key share one request.
- On any network error: cache `""` and return `""`. No retries, no toasts.

## Integration points

### Provider repos (simkl + trakt)

- `normalizeItem`, `enrichSearch`, `enrichTrending` stop emitting `posterUrl`.
  Item shape keeps every other field. Cards already handle missing posters via
  the gradient placeholder shipped in the previous step.
- Delete: `posterThumb`, `buildLibraryPosterUrl` (simkl), Trakt equivalents.
- Delete: `lookupByImdb` from simkl (only fed the poster fallback).
- `ids` on each item must include `tmdb` (when available) and `imdb`. Both
  providers already surface these — verified in
  [simklRepository.js:363](../../../src/simklRepository.js#L363) and
  [traktRepository.js:330](../../../src/traktRepository.js#L330). No provider
  changes needed here.

### `next-watch.js`

- `hydratePoster(card)` — rewritten to call
  `tmdbRepository.getPosterByIds({ tmdb, imdb, type })`, falling through to
  `getPosterByTitle` when no ids. The previous Simkl-by-IMDb path is removed.
- `observeLazyHydration` / `observeAiLazyHydration` — no change in plumbing;
  they just end up calling the new TMDB-backed `hydratePoster`.
- `hydrateAiCard` — still calls provider `searchByTitle` for URL / provider ids /
  release_status. Ignores whatever poster the provider returned (it won't return
  one anymore, but the code path tolerates either). Poster is fetched
  separately by `hydratePoster` after resolution, using TMDB ids when the
  provider surfaced them, else title+year.

## Card rendering

Already gradient-safe ([posterCard.js:74-80](../../../src/posterCard.js#L74-L80)).
When TMDB returns "" the card keeps showing the title-hashed gradient — no
regression from today's "no poster available" state.

## Tests

All existing tests that stub Simkl/Trakt poster endpoints must be updated to
stub TMDB endpoints instead.

## Rollout / cleanup order

1. Add `tmdbRepository.js` + cache + helpers. No callers yet.
2. Wire `hydratePoster` to use TMDB. Provider repos still emit `posterUrl` —
   harmless overlap during this step.
3. Strip `posterUrl` from provider enrichers. Delete dead helpers.
4. Delete `lookupByImdb` (Simkl) once no caller remains.

Each step compiles and runs independently; easy to revert if something is off.
