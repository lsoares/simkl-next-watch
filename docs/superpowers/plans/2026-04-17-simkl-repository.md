# Simkl Repository Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move every Simkl network call behind a `simkl` object exposed by a new `simklRepository.js`, so call sites in `index.html` read as domain actions and a future Trakt backend can be swapped in.

**Architecture:** New top-level `simklRepository.js` loaded as a classic `<script>` before `index.html`'s inline script. It sets `window.simkl` and a globally-scoped `class ApiError`. All `apiFetch` / `apiPost` / `buildXxxPayload` / `normalizeItem` / `fetchTrending` / the raw `fetch` to `/oauth/token` move into it. `index.html` call sites flip to `simkl.foo(...)`. App-level concerns (sync cache, badge sets, rating cache) stay in `index.html` and consume the repo.

**Tech Stack:** Plain JS, classic `<script>` (no module system), Playwright for tests (network-level mocking via `page.route`, so a pure refactor is invisible to the existing suite).

**Test strategy:** This is a behavior-preserving refactor. The test is "`npm test` still passes" after each slice. Existing tests in `test/next.test.js`, `test/trending.test.js`, `test/ai-suggestions.test.js`, `test/logged-out.test.js`, `test/settings.test.js` assert URL, method, headers, query params, and body at the network boundary — which the repo does not change. If they pass, the refactor is correct.

**Important background (don't skip):**
- `index.html` currently has one inline `<script>` block (lines ~180–1500). The repo file will be loaded via `<script src="./simklRepository.js"></script>` immediately before it. Classic scripts share scope: a `function foo()` in one script is callable from another, and a `class Foo` declared at top level is reachable by bare name across scripts (not on `window`).
- The repo's `markWatched` needs `parseNextEpisode` (defined in `index.html` at line 201). Because `markWatched` only runs after user interaction (long after `index.html`'s inline script has executed), calling `parseNextEpisode` from inside the repo works at runtime. Don't inline or duplicate — let the repo reference the globally-scoped function.
- The `ApiError` class is used across the app (Simkl, AI providers, OAuth). Move the declaration into the repo file (top level, above the IIFE) so bare `ApiError` resolves there for every call site in `index.html`. No renaming needed.
- Storage keys used by the repo (copy verbatim from `index.html` line 535–538):
  - Client ID: `"next-watch-client-id"`
  - Client secret: `"next-watch-client-secret"` (only needed by `exchangeOAuthCode`)
  - Access token: `"next-watch-access-token"`
- At call sites `type` is `"tv"` or `"movie"` for writes/search; `"shows" | "movies" | "anime"` for `getAllItems` (endpoint segment).
- `getTrending(period)` returns `{ tv, movies }` (object, not array). Existing `fetchTrending` returns an array via `Promise.all`. The `loadTrendingBadgeSets` call site that destructures `[tv, movies]` needs to change to `{ tv, movies }`.
- Titles in Simkl responses contain backslash-escaped quotes (`Life\'s`). The repo decodes titles on the way out for trending and search results — so the two call sites in `index.html` that currently do `.map((item) => ({ ...item, title: decodeSimklText(item.title) }))` (lines 907 and 1258) drop the decode.

---

## File Structure

**Create:**
- `simklRepository.js` — new file at project root. Exposes `window.simkl` (the repository) and a top-level `class ApiError`. Private helpers: `apiFetch`, `apiPost`, `normalizeItem`, `normalizeStatus`, `decodeSimklText`. Storage-key constants defined inline (not extracted beyond the three key strings).

**Modify:**
- `index.html` — load the repo script, swap all call sites, delete the moved helpers (`API_BASE`, `ApiError` class, `apiFetch`, `apiPost`, `fetchAllItems`, `buildMarkWatchedPayload`, `buildRatePayload`, `buildRemovePayload`, `buildAddToWatchlistPayload`, `normalizeItem`, `normalizeStatus`, `decodeSimklText`, `fetchTrending`, raw `/oauth/token` fetch). Keep `parseNextEpisode`, `sync()`, `loadTrendingBadgeSets`, rating/episode caches.
- `build.js` — include `simklRepository.js` in the list of files copied to `dist/`.

---

## Task 1: Create `simklRepository.js`

**Files:**
- Create: `simklRepository.js`

- [ ] **Step 1: Write the repo file (full contents)**

Create `simklRepository.js` with the following contents:

```js
class ApiError extends Error {
  constructor(msg) { super(msg); this.name = "ApiError"; }
}

(function () {
  "use strict";

  const API_BASE = "https://api.simkl.com";
  const CLIENT_ID_KEY = "next-watch-client-id";
  const CLIENT_SECRET_KEY = "next-watch-client-secret";
  const ACCESS_TOKEN_KEY = "next-watch-access-token";

  function decodeSimklText(s) {
    return String(s || "").replace(/\\(['"\\])/g, "$1");
  }

  function normalizeStatus(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, "");
  }

  function normalizeItem(raw) {
    const media = raw.show || raw.movie || raw;
    const ids = media.ids || raw.ids || {};
    return {
      ids,
      title: decodeSimklText(media.title) || "Unknown",
      year: media.year || "",
      poster: media.poster || media.img || "",
      runtime: media.runtime || 0,
      url: media.url || "",
      ratings: media.ratings || null,
      status: normalizeStatus(raw.status),
      next_to_watch: raw.next_to_watch || "",
      added_at: raw.added_to_watchlist_at || raw.added_at || null,
      last_watched_at: raw.last_watched_at || null,
      watched_episodes_count: raw.watched_episodes_count ?? 0,
      total_episodes_count: raw.total_episodes_count ?? 0,
      not_aired_episodes_count: raw.not_aired_episodes_count ?? 0,
      user_rating: raw.user_rating ?? null,
      type: raw.show ? "tv" : raw.movie ? "movie" : (raw.anime_type ? "tv" : null),
    };
  }

  async function apiFetch(path, options = {}) {
    const headers = {
      "Content-Type": "application/json",
      "simkl-api-key": localStorage.getItem(CLIENT_ID_KEY),
      ...options.headers,
    };
    const token = localStorage.getItem(ACCESS_TOKEN_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || data.message || `API error ${res.status}`);
    return data;
  }

  function apiPost(path, payload) {
    return apiFetch(path, { method: "POST", body: JSON.stringify(payload) });
  }

  function decodeTitle(item) {
    return { ...item, title: decodeSimklText(item.title) };
  }

  window.simkl = {
    ApiError,

    async exchangeOAuthCode(code, redirectUri) {
      const res = await fetch(`${API_BASE}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          client_id: localStorage.getItem(CLIENT_ID_KEY),
          client_secret: localStorage.getItem(CLIENT_SECRET_KEY),
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.access_token) throw new ApiError(data.error || "Token exchange failed.");
      return data;
    },

    getActivities() {
      return apiFetch("/sync/activities", { method: "POST" });
    },

    async getAllItems(type, dateFrom) {
      const params = new URLSearchParams({ extended: "full", episode_watched_at: "yes" });
      if (dateFrom) params.set("date_from", dateFrom);
      const data = await apiFetch(`/sync/all-items/${type}/?${params}`);
      return (data?.[type] ?? []).map(normalizeItem);
    },

    markWatched(item, type) {
      if (type === "tv") {
        const ep = parseNextEpisode(item.next_to_watch);
        if (ep) {
          return apiPost("/sync/history", {
            shows: [{ ids: item.ids, seasons: [{ number: ep.season, episodes: [{ number: ep.episode }] }] }],
          });
        }
      }
      return apiPost("/sync/history", {
        movies: [{ ids: item.ids, watched_at: new Date().toISOString() }],
      });
    },

    rate(item, type, rating) {
      const key = type === "tv" ? "shows" : "movies";
      return apiPost("/sync/ratings", {
        [key]: [{ ids: item.ids, rating, rated_at: new Date().toISOString() }],
      });
    },

    removeFromHistory(item, type) {
      const key = type === "tv" ? "shows" : "movies";
      return apiPost("/sync/history/remove", { [key]: [{ ids: item.ids }] });
    },

    addToWatchlist(item, type) {
      const key = type === "movie" ? "movies" : "shows";
      const id = String(item.ids?.simkl_id || item.ids?.simkl || "");
      return apiPost("/sync/add-to-list", { [key]: [{ to: "plantowatch", ids: { simkl: Number(id) } }] });
    },

    getEpisodes(showId) {
      return apiFetch(`/tv/episodes/${encodeURIComponent(showId)}`);
    },

    getShow(id) {
      return apiFetch(`/tv/${id}?extended=full`);
    },

    getMovie(id) {
      return apiFetch(`/movies/${id}?extended=full`);
    },

    async searchByTitle(title, year, type) {
      const q = encodeURIComponent(`${title} ${year || ""}`.trim());
      try {
        if (type === "tv") {
          const r = await apiFetch(`/search/tv?q=${q}&limit=1&extended=full`);
          return (Array.isArray(r) && r[0]) ? decodeTitle(r[0]) : null;
        }
        if (type === "movie") {
          const r = await apiFetch(`/search/movie?q=${q}&limit=1&extended=full`);
          return (Array.isArray(r) && r[0]) ? decodeTitle(r[0]) : null;
        }
        const [tv, movie] = await Promise.all([
          apiFetch(`/search/tv?q=${q}&limit=1&extended=full`),
          apiFetch(`/search/movie?q=${q}&limit=1&extended=full`),
        ]);
        const hit = (Array.isArray(tv) && tv[0]) || (Array.isArray(movie) && movie[0]) || null;
        return hit ? decodeTitle(hit) : null;
      } catch {
        return null;
      }
    },

    async getTrending(period) {
      const [tv, movies] = await Promise.all([
        fetch(`https://data.simkl.in/discover/trending/tv/${period}_100.json`).then((r) => r.json()),
        fetch(`https://data.simkl.in/discover/trending/movies/${period}_100.json`).then((r) => r.json()),
      ]);
      return {
        tv: (tv || []).map(decodeTitle),
        movies: (movies || []).map(decodeTitle),
      };
    },
  };
})();
```

- [ ] **Step 2: Run the full test suite to confirm the baseline still passes**

Run: `npm test`
Expected: all tests pass (the new file is not yet loaded anywhere, so behavior is unchanged).

- [ ] **Step 3: Commit**

```bash
git add simklRepository.js
git commit -m "Add simklRepository.js with full Simkl API surface"
```

---

## Task 2: Load the repo script and copy it in the build

**Files:**
- Modify: `index.html` (inject `<script src>` before the existing inline `<script>`)
- Modify: `build.js` (add the file to the copy list)

- [ ] **Step 1: Inject the `<script src>` tag**

In `index.html`, find the existing inline `<script>` tag (at line 180). Insert a line immediately before it:

```html
    <script src="./simklRepository.js"></script>
    <script>
```

- [ ] **Step 2: Add the file to `build.js`**

In `build.js`, update the copy list to include `simklRepository.js`. Change:

```js
for (const f of ["next-watch.css", "manifest.json", "favicon.ico", "icon.png", "sw.js"]) {
```

to:

```js
for (const f of ["next-watch.css", "manifest.json", "favicon.ico", "icon.png", "sw.js", "simklRepository.js"]) {
```

- [ ] **Step 3: Verify `window.simkl` exists at runtime**

Run: `npm test`
Expected: all tests pass. The repo is now loaded on every page, but nothing in `index.html` calls it yet. `window.simkl` should be defined; existing behavior unchanged.

- [ ] **Step 4: Verify the build still works**

Run: `npm run build`
Expected: completes without error; `dist/simklRepository.js` exists.

- [ ] **Step 5: Commit**

```bash
git add index.html build.js
git commit -m "Load simklRepository.js in index.html and dist build"
```

---

## Task 3: Swap library sync call sites (activities + all-items)

**Files:**
- Modify: `index.html` (the `// ── Sync ──` section near line 589)

- [ ] **Step 1: Replace `fetchAllItems` and the `/sync/activities` call in `sync()`**

In `index.html`, delete `fetchAllItems` (lines ~591–596) and update `sync()` to use the repo directly.

Before:
```js
      async function fetchAllItems(type, dateFrom) {
        const params = new URLSearchParams({ extended: "full", episode_watched_at: "yes" });
        if (dateFrom) params.set("date_from", dateFrom);
        const data = await apiFetch(`/sync/all-items/${type}/?${params}`);
        return (data?.[type] ?? []).map(normalizeItem);
      }

      const SYNC_CACHE_SCHEMA = 2;

      async function sync() {
        const activities = await apiFetch("/sync/activities", { method: "POST" });
        const sig = JSON.stringify(activities);
        const rawCache = readJsonStorage(STORAGE.syncCache);
        const cache = rawCache?.schema === SYNC_CACHE_SCHEMA ? rawCache : null;

        if (cache?.sig === sig && cache.shows && cache.movies) return cache;

        const dateFrom = cache?.lastActivity || null;
        const needsFull = !cache?.shows || !cache?.movies || !dateFrom;
        let shows, movies, anime;

        if (needsFull) {
          [shows, movies, anime] = await Promise.all([
            fetchAllItems("shows"), fetchAllItems("movies"), fetchAllItems("anime").catch(() => []),
          ]);
        } else {
          const [deltaShows, deltaMovies, deltaAnime] = await Promise.all([
            fetchAllItems("shows", dateFrom), fetchAllItems("movies", dateFrom), fetchAllItems("anime", dateFrom).catch(() => []),
          ]);
          shows = mergeItems(cache.shows, deltaShows);
          movies = mergeItems(cache.movies, deltaMovies);
          anime = mergeItems(cache.anime || [], deltaAnime);
        }

        const next = { schema: SYNC_CACHE_SCHEMA, sig, lastActivity: latestTimestamp(activities), shows, movies, anime };
        writeStorage(STORAGE.syncCache, next);
        return next;
      }
```

After:
```js
      const SYNC_CACHE_SCHEMA = 2;

      async function sync() {
        const activities = await simkl.getActivities();
        const sig = JSON.stringify(activities);
        const rawCache = readJsonStorage(STORAGE.syncCache);
        const cache = rawCache?.schema === SYNC_CACHE_SCHEMA ? rawCache : null;

        if (cache?.sig === sig && cache.shows && cache.movies) return cache;

        const dateFrom = cache?.lastActivity || null;
        const needsFull = !cache?.shows || !cache?.movies || !dateFrom;
        let shows, movies, anime;

        if (needsFull) {
          [shows, movies, anime] = await Promise.all([
            simkl.getAllItems("shows"), simkl.getAllItems("movies"), simkl.getAllItems("anime").catch(() => []),
          ]);
        } else {
          const [deltaShows, deltaMovies, deltaAnime] = await Promise.all([
            simkl.getAllItems("shows", dateFrom), simkl.getAllItems("movies", dateFrom), simkl.getAllItems("anime", dateFrom).catch(() => []),
          ]);
          shows = mergeItems(cache.shows, deltaShows);
          movies = mergeItems(cache.movies, deltaMovies);
          anime = mergeItems(cache.anime || [], deltaAnime);
        }

        const next = { schema: SYNC_CACHE_SCHEMA, sig, lastActivity: latestTimestamp(activities), shows, movies, anime };
        writeStorage(STORAGE.syncCache, next);
        return next;
      }
```

- [ ] **Step 2: Delete `normalizeItem` and `normalizeStatus` from `index.html`**

Both are now only referenced inside the repo. Delete the function declarations at lines ~216–237 (`normalizeItem`) and ~192–194 (`normalizeStatus`). Do NOT delete `decodeSimklText` yet — it's still called at lines 907 and 1258; it goes in Task 7.

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: all tests pass. The `next.test.js` and `trending.test.js` suites exercise the full sync flow and will break if anything regressed.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Route library sync through simklRepository"
```

---

## Task 4: Swap write call sites (markWatched, rate, remove, addToWatchlist)

**Files:**
- Modify: `index.html` (the watch/rate/remove handlers near lines 778–846 and the add-to-watchlist handler near line 921)

- [ ] **Step 1: Replace `apiPost("/sync/history", buildMarkWatchedPayload(...))`**

Three sites call this. Update each.

Near line 782 in `markWatched`:
```js
await apiPost("/sync/history", buildMarkWatchedPayload(item, type));
```
→
```js
await simkl.markWatched(item, type);
```

Near line 811 in `rateAndMarkWatched`:
```js
await Promise.all([
  apiPost("/sync/ratings", buildRatePayload(item, type, rating)),
  apiPost("/sync/history", buildMarkWatchedPayload(item, type)),
]);
```
→
```js
await Promise.all([
  simkl.rate(item, type, rating),
  simkl.markWatched(item, type),
]);
```

Near line 826 in `markMovieWatched`:
```js
await apiPost("/sync/history", buildMarkWatchedPayload(item, "movie"));
```
→
```js
await simkl.markWatched(item, "movie");
```

- [ ] **Step 2: Replace `apiPost("/sync/history/remove", buildRemovePayload(...))`**

Near line 842 in `removeFromWatchlist`:
```js
await apiPost("/sync/history/remove", buildRemovePayload(item, type));
```
→
```js
await simkl.removeFromHistory(item, type);
```

- [ ] **Step 3: Replace `apiPost("/sync/add-to-list", buildAddToWatchlistPayload(...))`**

Near line 921 in `addToWatchlist`. Before:
```js
async function addToWatchlist(card) {
  const item = card.item;
  const id = String(item.ids?.simkl_id || item.ids?.simkl || "");
  const urlBase = card.type === "movie" ? "movies" : "tv";
  const btn = card.cardEl?.querySelector(".add-watchlist-btn");
  if (!id || !btn) return;
  btn.disabled = true;
  try {
    await apiPost("/sync/add-to-list", buildAddToWatchlistPayload(urlBase, id));
    ...
```

After (note: `urlBase` is no longer needed; the repo derives it):
```js
async function addToWatchlist(card) {
  const item = card.item;
  const id = String(item.ids?.simkl_id || item.ids?.simkl || "");
  const btn = card.cardEl?.querySelector(".add-watchlist-btn");
  if (!id || !btn) return;
  btn.disabled = true;
  try {
    await simkl.addToWatchlist(item, card.type);
    ...
```

- [ ] **Step 4: Delete the four `buildXxxPayload` helpers**

Delete `buildMarkWatchedPayload`, `buildRatePayload`, `buildRemovePayload`, `buildAddToWatchlistPayload` from `index.html` (lines ~337–358).

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all tests pass. `next.test.js` exercises `markWatched` and `removeFromWatchlist`; `trending.test.js` exercises `addToWatchlist`; rating flows covered in `next.test.js` / `trending.test.js`.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Route library writes through simklRepository"
```

---

## Task 5: Swap details call sites (episodes, show, movie)

**Files:**
- Modify: `index.html` (the `enrichEpisodeTitles` function near line 851 and `fetchItemRating` near line 959)

- [ ] **Step 1: Replace the `/tv/episodes/:id` call**

Near line 859 in `enrichEpisodeTitles`. Before:
```js
const episodes = await apiFetch(`/tv/episodes/${encodeURIComponent(id)}`);
```

After:
```js
const episodes = await simkl.getEpisodes(id);
```

- [ ] **Step 2: Replace `/tv/:id` and `/movies/:id` in `fetchItemRating`**

Near line 961. Before:
```js
const path = type === "movie" ? `/movies/${id}?extended=full` : `/tv/${id}?extended=full`;
const data = await apiFetch(path);
```

After:
```js
const data = await (type === "movie" ? simkl.getMovie(id) : simkl.getShow(id));
```

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: all tests pass. `trending.test.js` covers `fetchItemRating` via the `setupMovieSummary`/`setupTvSummary` handlers; `next.test.js` covers `enrichEpisodeTitles` via `setupTvEpisodes`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Route detail lookups through simklRepository"
```

---

## Task 6: Swap search call sites (resolveSimkl)

**Files:**
- Modify: `index.html` (`resolveSimkl` near line 1193 and the AI-suggestion title-decode at line 1258)

- [ ] **Step 1: Rewrite `resolveSimkl` to use `simkl.searchByTitle`**

Before:
```js
async function resolveSimkl(suggestions, mediaType) {
  const results = await Promise.all(suggestions.map(async (s) => {
    try {
      const q = encodeURIComponent(`${s.title} ${s.year || ""}`.trim());
      if (mediaType === "tv") { const r = await apiFetch(`/search/tv?q=${q}&limit=1&extended=full`); return Array.isArray(r) && r[0] || null; }
      if (mediaType === "movie") { const r = await apiFetch(`/search/movie?q=${q}&limit=1&extended=full`); return Array.isArray(r) && r[0] || null; }
      const [tv, movie] = await Promise.all([
        apiFetch(`/search/tv?q=${q}&limit=1&extended=full`),
        apiFetch(`/search/movie?q=${q}&limit=1&extended=full`),
      ]);
      return (Array.isArray(tv) && tv[0]) || (Array.isArray(movie) && movie[0]) || null;
    } catch {
      return null;
    }
  }));
  return results.filter(Boolean);
}
```

After:
```js
async function resolveSimkl(suggestions, mediaType) {
  const results = await Promise.all(
    suggestions.map((s) => simkl.searchByTitle(s.title, s.year, mediaType))
  );
  return results.filter(Boolean);
}
```

- [ ] **Step 2: Drop the AI-suggestion title re-decode**

At line 1258 in the AI-suggestions flow, the items now come from `simkl.searchByTitle` which already decodes titles. Before:
```js
const typed = items.map((item) => ({ item: { ...item, title: decodeSimklText(item.title) }, type: item.type === "movie" ? "movie" : "tv" }));
```

After:
```js
const typed = items.map((item) => ({ item, type: item.type === "movie" ? "movie" : "tv" }));
```

- [ ] **Step 3: Run the tests**

Run: `npm test`
Expected: all tests pass. `ai-suggestions.test.js` exercises this flow end-to-end.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "Route search through simklRepository"
```

---

## Task 7: Swap trending call sites and drop `decodeSimklText`

**Files:**
- Modify: `index.html` (`loadTrendingBadgeSets` near line 1035, `renderDiscoveryRow` near line 904)

- [ ] **Step 1: Delete `fetchTrending` and swap `loadTrendingBadgeSets`**

Delete `fetchTrending` (lines ~1027–1032). Then update `loadTrendingBadgeSets` to use `simkl.getTrending` and destructure the `{ tv, movies }` object shape.

Before:
```js
async function fetchTrending(period) {
  return Promise.all([
    fetch(`https://data.simkl.in/discover/trending/tv/${period}_100.json`).then((r) => r.json()),
    fetch(`https://data.simkl.in/discover/trending/movies/${period}_100.json`).then((r) => r.json()),
  ]);
}

let trendingBadgeSetsPromise = null;
function loadTrendingBadgeSets() {
  if (trendingBadgeSetsPromise) return trendingBadgeSetsPromise;
  const periods = ["today", "week", "month"];
  trendingBadgeSetsPromise = Promise.all(periods.map(fetchTrending))
    .then((results) => {
      const sets = { today: new Set(), week: new Set(), month: new Set() };
      results.forEach(([tv, movies], i) => {
        const period = periods[i];
        for (const item of [...(tv || []), ...(movies || [])]) {
          const id = String(item?.ids?.simkl_id || item?.ids?.simkl || "");
          if (id) sets[period].add(id);
        }
      });
      return sets;
    })
    .catch(() => ({ today: new Set(), week: new Set(), month: new Set() }));
  return trendingBadgeSetsPromise;
}
```

After:
```js
let trendingBadgeSetsPromise = null;
function loadTrendingBadgeSets() {
  if (trendingBadgeSetsPromise) return trendingBadgeSetsPromise;
  const periods = ["today", "week", "month"];
  trendingBadgeSetsPromise = Promise.all(periods.map((p) => simkl.getTrending(p)))
    .then((results) => {
      const sets = { today: new Set(), week: new Set(), month: new Set() };
      results.forEach(({ tv, movies }, i) => {
        const period = periods[i];
        for (const item of [...(tv || []), ...(movies || [])]) {
          const id = String(item?.ids?.simkl_id || item?.ids?.simkl || "");
          if (id) sets[period].add(id);
        }
      });
      return sets;
    })
    .catch(() => ({ today: new Set(), week: new Set(), month: new Set() }));
  return trendingBadgeSetsPromise;
}
```

- [ ] **Step 2: Check for any other `fetchTrending` / raw `data.simkl.in` callers**

Run: `grep -n "fetchTrending\|data\.simkl\.in" index.html`
Expected: no matches (both were consolidated into the repo; if the Trending view has its own call to `simkl.getTrending`, it also needs to use the object shape — check and fix if so).

If the Trending view's row-render calls `simkl.getTrending` and destructures, update accordingly. (Inspect the Trending view render code around line 1035–1075 to confirm shape usage.)

- [ ] **Step 3: Drop the title re-decode in `renderDiscoveryRow`**

At line 907. Before:
```js
items.map((item) => ({ ...item, title: decodeSimklText(item.title) })).forEach((item) => {
```

After:
```js
items.forEach((item) => {
```

- [ ] **Step 4: Delete `decodeSimklText` from `index.html`**

With call sites at lines 221 (inside the already-deleted `normalizeItem`), 907, and 1258 all gone, run:

`grep -n "decodeSimklText" index.html`
Expected: only the definition at line ~188. Delete it.

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: all tests pass. `trending.test.js` exercises the trending flow and badge rendering.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Route trending through simklRepository"
```

---

## Task 8: Swap OAuth exchange and delete the last remnants

**Files:**
- Modify: `index.html` (OAuth redirect handler near lines 1345–1377 and the API section near lines 573–587)

- [ ] **Step 1: Replace the raw `/oauth/token` fetch**

Near line 1360 in the OAuth redirect handler. Before:
```js
const token = await fetch(`${API_BASE}/oauth/token`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ code, client_id: getClientId(), client_secret: getClientSecret(), redirect_uri: redirectUri, grant_type: "authorization_code" }),
}).then((r) => r.json());
if (!token.access_token) throw new ApiError(token.error || "Token exchange failed.");
writeStorage(STORAGE.accessToken, token.access_token);
```

After:
```js
const token = await simkl.exchangeOAuthCode(code, redirectUri);
writeStorage(STORAGE.accessToken, token.access_token);
```

The repo throws `ApiError` on failure, so the explicit check is unnecessary — the surrounding `try/catch` still handles it.

- [ ] **Step 2: Delete `API_BASE`, `apiFetch`, `apiPost`, and the `ApiError` class from `index.html`, and alias `ApiError` to the repo's**

Classic `<script>` tags don't share top-level `class` bindings, so the repo's `ApiError` lives inside its IIFE and is exposed as `simkl.ApiError`. Keep all existing `throw new ApiError(...)` / `instanceof ApiError` sites in `index.html` by introducing a single alias at the top of the inline script.

Near lines 573–587, delete:

```js
      const API_BASE = "https://api.simkl.com";
      class ApiError extends Error { constructor(msg) { super(msg); this.name = "ApiError"; } }

      async function apiFetch(path, options = {}) { ... }

      function apiPost(path, payload) { ... }
```

At the very top of the inline `<script>` block (just after the opening tag, before any domain helpers), add:

```js
      const ApiError = simkl.ApiError;
```

Now every remaining `throw new ApiError(...)` and `instanceof ApiError` in `index.html` resolves to the repo's class.

- [ ] **Step 3: Final sweep — confirm nothing in `index.html` still references the removed helpers**

Run: `grep -nE "apiFetch|apiPost|API_BASE|fetchAllItems|buildMarkWatchedPayload|buildRatePayload|buildRemovePayload|buildAddToWatchlistPayload|fetchTrending|normalizeItem|normalizeStatus|decodeSimklText" index.html`
Expected: no matches.

If any line matches, something was missed — trace the specific call site and route it through `simkl.*` before proceeding.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: all tests pass. This is the final gate for the refactor.

- [ ] **Step 5: Build the dist and verify**

Run: `npm run build`
Expected: succeeds; `dist/index.html` and `dist/simklRepository.js` both exist.

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Route OAuth token exchange through simklRepository and remove dead helpers"
```

---

## Post-implementation sanity check

- `grep -c "simkl\." index.html` should show a small, consistent count of repo call sites.
- `grep -n "fetch(" index.html` should only show fetches that are genuinely non-Simkl (AI providers, etc.) — no `api.simkl.com` / `data.simkl.in` URLs.
- `simklRepository.js` should be the only place `api.simkl.com` or `data.simkl.in` appears in the source tree.
