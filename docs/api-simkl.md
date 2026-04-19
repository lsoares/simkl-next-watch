# Simkl API — app reference

Scope: only what this app uses. Source of truth is [simklRepository.js](../simklRepository.js). When in doubt, read it — not the upstream docs.

## Bases

- API: `https://api.simkl.com`
- Static CDN (no auth): `https://data.simkl.in`
- OAuth authorize (browser): `https://simkl.com/oauth/authorize`

## Auth

Two credential layers:

| Layer | Value | Storage |
|---|---|---|
| App | `client_id`, `client_secret` | `config.local.js` (gitignored) as `window.__SIMKL_CLIENT_ID__`, `__SIMKL_CLIENT_SECRET__` |
| User | `access_token` | `localStorage["next-watch-access-token"]` |

Every `api.simkl.com` request sends:

```
simkl-api-key: <client_id>        ← always
Authorization: Bearer <token>     ← only if token present
Content-Type: application/json
```

See `apiFetch` at [simklRepository.js:213](../simklRepository.js).

Public/metadata endpoints (`/tv/*`, `/movies/*`, `/search/*`, `data.simkl.in/*`) work with `simkl-api-key` only — no user OAuth, no `client_secret`. `/sync/*` needs the bearer token.

### OAuth (authorization code)

1. Browser → `https://simkl.com/oauth/authorize?response_type=code&client_id=…&redirect_uri=…&state=…`
2. Callback hits the redirect URI with `?code=…`.
3. `exchangeOAuthCode(code, redirectUri)` at [simklRepository.js:11](../simklRepository.js):

```
POST https://api.simkl.com/oauth/token
Content-Type: application/json
{ code, client_id, client_secret, redirect_uri, grant_type: "authorization_code" }
→ { access_token, ... }
```

Caller writes the token to localStorage (the repo does not).

## Endpoints used

All paths joined onto `https://api.simkl.com` unless noted.

### Sync (user state) — needs bearer

| Method | Path | Purpose | Body / Query |
|---|---|---|---|
| `POST` | `/sync/activities` | Timestamp tree, used as cache signature | empty |
| `GET`  | `/sync/all-items/{shows\|movies\|anime}/` | Library | `extended=full&episode_watched_at=yes[&date_from=ISO]` |
| `POST` | `/sync/history` | Mark watched | see below |
| `POST` | `/sync/history/remove` | Mark unwatched | see below |
| `POST` | `/sync/ratings` | Rate (1–10) | `{ shows\|movies: [{ ids, rating, rated_at }] }` |
| `POST` | `/sync/add-to-list` | Add to `plantowatch` | `{ shows\|movies: [{ to: "plantowatch", ids: { simkl: <int> } }] }` |

`/sync/history` body shape (episode-level for TV, whole-movie for films):

```jsonc
// TV episode
{ "shows": [{ "ids": {...}, "seasons": [{ "number": 1, "episodes": [{ "number": 2 }] }] }] }
// Movie
{ "movies": [{ "ids": {...}, "watched_at": "2026-04-19T12:00:00.000Z" }] }
```

`undoMarkWatched` on a movie also re-adds it to `plantowatch` so unwatching does not silently drop the item from the library ([simklRepository.js:111–113](../simklRepository.js)).

### Catalog (metadata) — public

| Method | Path | Notes |
|---|---|---|
| `GET` | `/tv/{id}?extended=full` | |
| `GET` | `/movies/{id}?extended=full` | |
| `GET` | `/tv/episodes/{showId}` | Array of `{ season, episode, type, title }` |
| `GET` | `/search/tv?q=<title+year>&limit=1&extended=full` | Returns `[…]` (array, not `{results}`) |
| `GET` | `/search/movie?q=<title+year>&limit=1&extended=full` | Same shape |

### Trending (static CDN) — public, no API key

```
GET https://data.simkl.in/discover/trending/tv/{today|week|month}_100.json
GET https://data.simkl.in/discover/trending/movies/{today|week|month}_100.json
```

Plain JSON array of 100 items. Cache-first in [sw.js](../sw.js).

## Response fields the app actually reads

From `normalizeItem` at [simklRepository.js:243](../simklRepository.js):

- Media: `show | movie | <root>` (anime comes under the same shape)
- IDs: `ids.simkl` or `ids.simkl_id` → integer; `ids.imdb` → string; `ids.tmdb`, `ids.tvdb` also present
- Card: `title`, `year`, `poster` or `img`, `runtime`, `ratings.imdb.rating`
- List state: `status` (normalized to lowercase, no whitespace: `watching`, `plantowatch`, `completed`, `dropped`, `hold`)
- TV progress: `next_to_watch` (string `"S05E01"` **or** object `{ season, episode }`), `watched_episodes_count`, `total_episodes_count`, `not_aired_episodes_count`
- Timestamps: `added_at` / `added_to_watchlist_at`, `last_watched_at`
- User: `user_rating`

Type is inferred: `raw.show → "tv"`, `raw.movie → "movie"`, `raw.anime_type → "tv"`.

## Gotchas

- **Titles are backslash-escaped.** `decodeSimklText` at [simklRepository.js:231](../simklRepository.js) strips `\'`, `\"`, `\\`. Do this before rendering or searching.
- **`next_to_watch` shape varies.** Can be a string (`"S05E01"`) or an object. Parser needed.
- **`ids.simkl` vs `ids.simkl_id`.** Both exist in responses. Always check both.
- **Anime bucket is separate** (`/sync/all-items/anime/`) but normalizes to `type: "tv"`. Failure of that single call is swallowed with `.catch(() => [])` ([simklRepository.js:66](../simklRepository.js)).
- **Poster field** may be a bare path (`"ab/abc123"`) or full URL; UI composes the CDN URL itself.
- **Delta sync key:** pass `date_from=<latest ISO timestamp seen in /sync/activities>` to `/sync/all-items/*`. Items with `status: "deleted"` in the delta must be removed from the cached list.
- **Errors.** `apiFetch` throws `ApiError` on non-2xx, using `data.error || data.message || "API error <status>"`. Non-JSON responses become empty objects.

## Caching

| Key | Shape | Purpose |
|---|---|---|
| `simkl-cache-v3` | gzip+base64 of `{ sig, lastActivity, shows, movies, anime }` | Full library; re-fetched delta-only when `sig` matches | 
| `next-watch-ratings-cache` | `{ schema: 3, entries: { [simklId]: { rating, imdb, total, fetchedAt } } }` | 30-day TTL per entry |
| `next-watch-episode-cache` | `{ "<simklId>:<season>:<episode>": title }` | Episode titles |
| `next-watch-access-token` | string | User bearer token |

The signature comparison means any write that bumps `/sync/activities` invalidates the cache and forces a delta fetch.

Service worker [sw.js:26](../sw.js) explicitly excludes `api.simkl.com` from caching; only `data.simkl.in` is cached.

## Rate limits

~1000 req/day per bundled `client_id` on public endpoints (shared by all users of the deployment). Aggressive local caching is the mitigation — do not add new per-item API calls without caching them.
