# Trakt.tv API — app reference

Scope: only what this app will use once Trakt is integrated. Integration is specced in [superpowers/plans/2026-04-19-trakt-support.md](superpowers/plans/2026-04-19-trakt-support.md); not yet in code. Simkl remains the catalog/metadata source; Trakt owns user state (watched, watchlist, ratings, progress).

## Bases

- API: `https://api.trakt.tv`
- OAuth authorize (browser): `https://trakt.tv/oauth/authorize`

## Auth

Two credential layers (mirrors the Simkl setup):

| Layer | Value | Storage |
|---|---|---|
| App | `client_id`, `client_secret` | `config.local.js` as `window.__TRAKT_CLIENT_ID__`, `__TRAKT_CLIENT_SECRET__`, `__TRAKT_REDIRECT_URI__` |
| User | `access_token` | `localStorage["next-watch-trakt-access-token"]` — **distinct key** from the Simkl token so both can coexist during cutover |

Every `api.trakt.tv` request must send:

```
trakt-api-version: 2
trakt-api-key: <client_id>
Authorization: Bearer <access_token>     ← user-state endpoints require it
Content-Type: application/json
```

Trakt rejects requests missing the version header or api-key — always set both, even for unauthenticated calls.

### OAuth (authorization code)

Same flow as Simkl, different URLs. One-click redirect, no PIN:

1. Browser → `https://trakt.tv/oauth/authorize?response_type=code&client_id=…&redirect_uri=…&state=…`
2. Callback URL returns with `?code=…`.
3. Exchange:

```
POST https://api.trakt.tv/oauth/token
Content-Type: application/json
{
  "code": "<code>",
  "client_id": "<client_id>",
  "client_secret": "<client_secret>",
  "redirect_uri": "<redirect_uri>",
  "grant_type": "authorization_code"
}
→ { access_token, refresh_token, expires_in, created_at, scope, token_type: "bearer" }
```

Redirect URI **must match exactly** what's registered at https://trakt.tv/oauth/applications.

Token refresh (when `created_at + expires_in` is close): same endpoint with `grant_type: "refresh_token"` and `refresh_token: <…>`.

## Endpoints used

### Reads — user state

| Method | Path | Returns (normalized shape) |
|---|---|---|
| `GET` | `/sync/watched/shows` | `[{ last_watched_at, plays, show: { ids }, seasons: [{ number, episodes: [{ number, plays, last_watched_at }] }] }]` |
| `GET` | `/sync/watched/movies` | `[{ last_watched_at, plays, movie: { ids } }]` |
| `GET` | `/sync/watchlist/shows` | `[{ listed_at, show: { ids } }]` |
| `GET` | `/sync/watchlist/movies` | `[{ listed_at, movie: { ids } }]` |
| `GET` | `/sync/ratings/shows` | `[{ rated_at, rating, show: { ids } }]` |
| `GET` | `/sync/ratings/movies` | `[{ rated_at, rating, movie: { ids } }]` |
| `GET` | `/shows/{id}/progress/watched` | `{ aired, completed, last_watched_at, seasons, next_episode: { season, number, title, ids } or null }` |

- `{id}` in `/shows/:id/progress/watched` accepts a Trakt slug **or** a numeric Trakt ID. If cross-referencing from Simkl, pass the IMDB ID — Trakt resolves it.
- Query params worth knowing:
  - `?extended=full` — include `title`, `year`, richer fields on embedded media
  - `?extended=noseasons` on `/shows/:id/progress/watched` — hide season breakdown if only `next_episode` is needed

### Writes — user state

| Method | Path | Body skeleton |
|---|---|---|
| `POST` | `/sync/history` | `{ shows: [{ ids, seasons: [{ number, episodes: [{ number, watched_at? }] }] }], movies: [{ ids, watched_at? }] }` |
| `POST` | `/sync/history/remove` | Same shape as `/sync/history` |
| `POST` | `/sync/ratings` | `{ shows: [{ ids, rating, rated_at? }], movies: [{ ids, rating, rated_at? }] }` |
| `POST` | `/sync/watchlist` | `{ shows: [{ ids }], movies: [{ ids }] }` |
| `POST` | `/sync/watchlist/remove` | Same shape as `/sync/watchlist` |

Response shape for every write:

```jsonc
{
  "added":    { "movies": 0, "episodes": 0, "shows": 0, "seasons": 0 },
  "updated":  { ... },                // /sync/ratings only
  "existing": { "movies": 0, "episodes": 0 },
  "not_found": { "movies": [...], "shows": [...], "seasons": [...], "episodes": [...], "people": [...] }
}
```

Always inspect `not_found` — Trakt returns 200 even when nothing matched.

## ID shape

Trakt accepts any of these in `ids`:

```jsonc
{ "trakt": 12345, "slug": "breaking-bad", "tvdb": 81189, "imdb": "tt0903747", "tmdb": 1396 }
```

For this app: **always send IMDB ID** (`{ imdb: "tt…" }`). Simkl items carry IMDB under `ids.imdb`, so the join is exact and no provider-specific ID dance is needed. Fall back to TMDB/TVDB only when IMDB is absent.

## Gotchas

- **Rate limit: 1000 calls per 5 minutes** per app `client_id` (shared across all users of the deployment). GET endpoints are cheap; POST /sync/* count the same. Cache watched/watchlist/ratings pulls in memory for the session; re-fetch only after a write.
- **429 handling.** Trakt returns `Retry-After` header on throttle. Plan says a BYO `client_id` escape hatch is out of scope for the initial cutover.
- **Not-found on writes.** Status 200 + non-empty `not_found` means the IDs didn't resolve. Must be surfaced — do not treat it as success.
- **`watched_at` is optional** on `/sync/history`. Omit to use "now"; pass an ISO 8601 string for backfills. Trakt stores per-play; multiple plays accumulate.
- **Removing watched TV** is episode-granular — passing `{ shows: [{ ids }] }` without `seasons` removes **every** episode play for that show. Always include the specific `seasons/episodes` unless you really want a full wipe.
- **Anime** is not a separate bucket in Trakt — anime series are shows. Simkl's `anime_type` items should be routed through the `shows` paths here.
- **`/shows/:id/progress/watched`** is authoritative for "what's next" and richer than Simkl's `next_to_watch`. It returns `next_episode: null` when the user is caught up.
- **Version header.** Missing `trakt-api-version: 2` → `412 Precondition Failed`. Missing `trakt-api-key` → `401`. Neither is obvious from the error body.
- **Bearer vs. api-key.** Both headers are required on user-state calls; the api-key alone is not enough, and the bearer alone will be rejected.

## Error model

- `401` — missing/expired bearer, or missing `trakt-api-key`.
- `403` — bearer belongs to another app, or scope missing.
- `409` — conflict (e.g. adding a watchlist item that already has a play; rare in practice).
- `412` — missing `trakt-api-version`.
- `420` — account locked.
- `429` — rate limited; honor `Retry-After`.

Body on errors is JSON with `{ error, error_description }` — surface it via `ApiError`.

## Planned files (not yet written)

- [traktUserState.js](../traktUserState.js) (new) — `window.trakt` with `exchangeOAuthCode`, `getWatchedMap`, `getWatchlistSet`, `getProgress`, `getRatings`, `markWatched`, `undoMarkWatched`, `rate`, `addToWatchlist`, `removeFromWatchlist`. Internal `traktFetch(path, opts)` mirrors [simklRepository.js:213](../simklRepository.js) but with Trakt headers.
- [test/clients/trakt.js](../test/clients/trakt.js) (new) — MSW handler helpers named by action (`listWatchedShows`, `listWatchlist`, `showProgress`, `listRatings`, write variants). Follows [CLAUDE.md](../CLAUDE.md) testing rules: hardcode URL + method, assert headers and body inside the handler.

## References

- Cleanup & architecture decision: [docs/pre-trakt-cleanup-report.md](pre-trakt-cleanup-report.md)
- Task-by-task plan: [docs/superpowers/plans/2026-04-19-trakt-support.md](superpowers/plans/2026-04-19-trakt-support.md)
- Simkl-side reference: [docs/api-simkl.md](api-simkl.md)
