# IMDb Ratings Cache for Next View — Design

## Goal

Show IMDb ratings (via the existing `.imdb-badge`) on unstarted posters in the
Next view. The Simkl sync endpoint (`/sync/all-items/{type}?extended=full`)
does not include `ratings.imdb.rating`, so ratings must be fetched per item
and cached client-side.

## Evidence

A live response from `/sync/all-items/shows/` with `extended=full` showed the
`show` object limited to `{ title, poster, year, runtime, ids }` — no
`ratings` field at any level. Confirmed separately that `/tv/{id}` and
`/movies/{id}` with `extended=full` do return `ratings.imdb.rating`.

## Cache

- Storage key: `next-watch-ratings-cache` (new).
- Structure: `{ schema: 1, entries: { [simklId]: { rating: number, fetchedAt: ISO8601 } } }`.
- TTL per entry: 30 days. Older entries are refetched.
- Schema-versioned so future changes auto-invalidate.

## Fetch

- New helper `fetchItemRating(type, simklId)`:
  - `GET /{tv|movies}/{simklId}?extended=full` via `apiFetch`.
  - Returns `data?.ratings?.imdb?.rating ?? null`.
  - Errors are swallowed and return `null` (decorative feature, must not break sync).
- Concurrency cap via `chunked(items, fn, 5)` — 5 requests in flight at a time.

## Integration

In `renderRow` (Next view only):

1. **Synchronous pre-render enrichment**: before building cards, walk items
   and, for any with a fresh cached rating, set `item.ratings = { imdb: { rating } }`.
   The existing `showImdb` gate in the `PosterCard` template renders the
   badge with no re-flow.
2. **Background fetch**: after rendering, collect items whose simkl ID has no
   fresh cache entry. Fire `fetchItemRating` for each (5 at a time). On each
   success: cache the rating, mutate the item, and inject an `.imdb-badge`
   element into the card's `.poster-top-text` in place (insert before any
   existing `.trending-badge` so IMDb precedes trending, matching the
   template order).

Trending and AI views already carry `ratings` in their payloads — no change
there.

## Ordering

IMDb badge must appear **before** the trending badge in the top-text stack.
Post-hoc injection uses `insertBefore(existingTrendingBadge)` when present,
else `appendChild`.

## Tests

New file `test/ratings-cache.test.js`:

1. **Happy path (movie)**: unstarted movie, no cache → background fetches
   `/movies/{id}?extended=full` → IMDb badge appears on the card.
2. **Happy path (tv)**: unstarted show → `/tv/{id}?extended=full` is hit,
   badge appears.
3. **Cache hit**: seed `next-watch-ratings-cache` with a fresh entry before
   navigation; assert badge renders immediately and no network call is made
   to `/tv/{id}`.
4. **Fetch failure**: API returns 500 — card renders with no IMDb badge, app
   does not crash, subsequent rows still render.
5. **Ordering**: when an unstarted item is also in the `today` trending list,
   both badges render and IMDb precedes trending in the DOM.

Support in `test/clients/simkl.js`:

- `setupTvSummary(page, id, data)` → handles `**/tv/{id}?**`, asserts
  `extended=full` and headers.
- `setupMovieSummary(page, id, data)` → handles `**/movies/{id}?**`, same.
- Be careful: existing `setupTvEpisodes` routes `**/tv/episodes/*`, which
  must still take precedence over `setupTvSummary`. Playwright routes are
  matched most-recently-registered first, so the test setup order matters.

## Files touched

- `index.html`: ratings cache helpers, fetch helper with concurrency cap,
  pre-render enrichment and post-render background fetch in `renderRow`.
- `test/clients/simkl.js`: two new setup helpers.
- `test/ratings-cache.test.js`: new tests.

## Out of scope

- Fetching ratings for Trending or AI items (they already have them).
- Proactively refreshing cache before TTL expires.
- UI affordance to manually refresh.
- Batching multiple item ratings in a single request (Simkl API doesn't
  expose a batch endpoint for summaries).
