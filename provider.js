window.createSimklProvider = function createSimklProvider({
  storageKeys,
  GENRE_CACHE_TTL,
  STATS_CACHE_TTL,
  getClientId,
  getClientSecret,
  getAccessToken,
  normalizeList,
  normalizeStatus,
  parseNextEpisode,
  buildEpisodeWatchAction,
  getItemIds,
}) {
  const APP_NAME = "next-watch";
  const APP_VERSION = "1.0";

  function getSimklId(item) {
    const ids = getItemIds(item);
    return ids.simkl || ids.simkl_id || null;
  }

  function getAllSimklIds(item) {
    const ids = getItemIds(item);
    return [ids.simkl, ids.simkl_id].filter(Boolean).map(String);
  }

  function mergeSimklDetail(item, detail, { includeRatings = true, includeIds = true } = {}) {
    if (!detail) return item;
    return {
      ...item,
      ...(includeRatings && detail.ratings ? { ratings: detail.ratings } : {}),
      ...(includeIds && detail.ids ? { ids: { ...item.ids, ...detail.ids } } : {}),
    };
  }

  function appendRequiredParams(rawUrl, credentials = {}) {
    const clientId = credentials.clientId ?? getClientId();
    const url = new URL(rawUrl);
    if (clientId && !url.searchParams.has("client_id")) url.searchParams.set("client_id", clientId);
    if (!url.searchParams.has("app-name")) url.searchParams.set("app-name", APP_NAME);
    if (!url.searchParams.has("app-version")) url.searchParams.set("app-version", APP_VERSION);
    return url.toString();
  }

  function buildHeaders(optionsHeaders = {}, credentials = {}) {
    const clientId = credentials.clientId ?? getClientId();
    const accessToken = credentials.accessToken ?? getAccessToken();
    const headers = {
      "Content-Type": "application/json",
      "simkl-api-key": clientId,
      ...optionsHeaders,
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return headers;
  }

  async function fetchSimkl(rawUrl, options = {}, credentials = {}) {
    const response = await fetch(appendRequiredParams(rawUrl, credentials), {
      ...options,
      headers: buildHeaders(options.headers || {}, credentials),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || `Simkl request failed with ${response.status}.`);
    return payload;
  }

  function buildAuthorizeUrl({ clientId, redirectUri, state = "" }) {
    const url = new URL("https://simkl.com/oauth/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    if (state) url.searchParams.set("state", state);
    return url.toString();
  }

  async function exchangeAuthorizationCode({ clientId, clientSecret, code, redirectUri }) {
    const response = await fetch(appendRequiredParams("https://api.simkl.com/oauth/token", { clientId, accessToken: "" }), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.access_token) {
      throw new Error(payload.error || payload.message || `Simkl token exchange failed with ${response.status}.`);
    }
    return payload;
  }

  async function validateCredentials({ clientId, accessToken }) {
    await fetchSimkl("https://api.simkl.com/sync/activities", {}, { clientId, accessToken });
  }

  function getAuthErrorMessage(error) {
    const raw = String(error?.message || "").trim();
    if (raw === "user_token_failed") {
      return "Simkl rejected the stored user access token. Reconnect this app to fetch a fresh token.";
    }
    if (raw === "api_key_failed") {
      return "Simkl rejected that client ID. Check that the app client ID is correct.";
    }
    if (raw === "auth_failed") {
      return "Simkl rejected those credentials. Check the client ID and app secret, then reconnect.";
    }
    return raw || "That client ID or app secret didn’t work. Check both values and try again.";
  }

  function loadSyncCache() {
    try { return JSON.parse(localStorage.getItem(storageKeys.syncCache) || "null"); } catch { return null; }
  }

  function saveSyncCache(data) {
    try { localStorage.setItem(storageKeys.syncCache, JSON.stringify(data)); } catch {}
  }

  function projectCachedItem(item) {
    return {
      ids: item.ids || {},
      title: item.title || "Unknown title",
      year: item.year || "",
      overview: item.overview || "",
      poster: item.poster || "",
      next_to_watch: item.next_to_watch || "",
      url: item.url || "",
      status: item.status || "",
      added_at: item.added_at || null,
      last_watched_at: item.last_watched_at || null,
      total_episodes_count: item.total_episodes_count ?? 0,
      not_aired_episodes_count: item.not_aired_episodes_count ?? 0,
      watched_episodes_count: item.watched_episodes_count ?? 0,
      runtime: item.runtime ?? 0,
      user_rating: item.user_rating ?? null,
      release_date: item.release_date || null,
      nextSeasonImg: item.nextSeasonImg || null,
      type: item.type || null,
    };
  }

  function mergeCachedItems(existingItems, nextItems) {
    const merged = new Map();
    for (const item of existingItems || []) {
      const id = getSimklId(item);
      if (!id) continue;
      merged.set(String(id), item);
    }
    for (const item of nextItems || []) {
      const id = getSimklId(item);
      if (!id) continue;
      merged.set(String(id), item);
    }
    return [...merged.values()];
  }

  function removeItemsMissingFromDelta(existingItems, deltaItems) {
    const removals = new Set(
      (deltaItems || [])
        .filter((item) => normalizeStatus(item.status) === "deleted")
        .map((item) => String(getSimklId(item)))
        .filter(Boolean)
    );
    if (!removals.size) return existingItems || [];
    return (existingItems || []).filter((item) => !removals.has(String(getSimklId(item))));
  }

  async function fetchActivities() {
    return fetchSimkl("https://api.simkl.com/sync/activities");
  }

  function getActivitiesSignature(activities) {
    try { return JSON.stringify(activities || {}); } catch { return ""; }
  }

  function extractLatestActivityTimestamp(value) {
    let latest = "";
    (function walk(node) {
      if (!node) return;
      if (typeof node === "string" && /^\d{4}-\d{2}-\d{2}T/.test(node)) {
        if (!latest || node > latest) latest = node;
        return;
      }
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      if (typeof node === "object") {
        for (const entry of Object.values(node)) walk(entry);
      }
    })(value);
    return latest;
  }

  async function fetchInitialLibrary(type) {
    const response = await fetchSimkl(`https://api.simkl.com/sync/all-items/${type}/?extended=full&episode_watched_at=yes`);
    return normalizeList(response?.[type] || response || []).map(projectCachedItem);
  }

  async function performInitialSync(activities) {
    const shows = await fetchInitialLibrary("shows");
    const movies = await fetchInitialLibrary("movies");
    const anime = await fetchInitialLibrary("anime").catch(() => []);
    const cache = {
      activitiesSignature: getActivitiesSignature(activities),
      lastActivityAt: extractLatestActivityTimestamp(activities),
      syncedAt: new Date().toISOString(),
      shows: { items: shows },
      movies: { items: movies },
      anime: { items: anime },
    };
    saveSyncCache(cache);
    return cache;
  }

  async function performDeltaSync(cache, activities) {
    const dateFrom = cache?.lastActivityAt;
    if (!dateFrom) return performInitialSync(activities);
    const response = await fetchSimkl(`https://api.simkl.com/sync/all-items/?date_from=${encodeURIComponent(dateFrom)}`);
    const deltaShows = normalizeList(response?.shows || []).map(projectCachedItem);
    const deltaMovies = normalizeList(response?.movies || []).map(projectCachedItem);
    const deltaAnime = normalizeList(response?.anime || []).map(projectCachedItem);
    const nextCache = {
      activitiesSignature: getActivitiesSignature(activities),
      lastActivityAt: extractLatestActivityTimestamp(activities) || dateFrom,
      syncedAt: new Date().toISOString(),
      shows: {
        items: mergeCachedItems(removeItemsMissingFromDelta(cache?.shows?.items, deltaShows), deltaShows),
      },
      movies: {
        items: mergeCachedItems(removeItemsMissingFromDelta(cache?.movies?.items, deltaMovies), deltaMovies),
      },
      anime: {
        items: mergeCachedItems(removeItemsMissingFromDelta(cache?.anime?.items, deltaAnime), deltaAnime),
      },
    };
    saveSyncCache(nextCache);
    return nextCache;
  }

  async function getSyncedMasterData({ forceFull = false } = {}) {
    const activities = await fetchActivities();
    const activitiesSignature = getActivitiesSignature(activities);
    const cache = loadSyncCache();
    if (!forceFull && cache?.activitiesSignature && cache.activitiesSignature === activitiesSignature) {
      return cache;
    }
    if (forceFull || !cache?.shows?.items || !cache?.movies?.items || !cache?.lastActivityAt) {
      return performInitialSync(activities);
    }
    return performDeltaSync(cache, activities);
  }

  async function fetchDetail(type, simklId) {
    if (!simklId) return null;
    try {
      return await fetchSimkl(`https://api.simkl.com/${type}/${encodeURIComponent(simklId)}`);
    } catch {
      return null;
    }
  }

  async function fetchDetails(type, items) {
    return Promise.all(items.map((item) => fetchDetail(type, getSimklId(item))));
  }

  async function buildTvCandidates(shows) {
    const aired = (s) => (s.total_episodes_count ?? 0) === 0 || (s.total_episodes_count ?? 0) > (s.not_aired_episodes_count ?? 0);
    const availableEpisodesLeft = (show) => {
      const total = Number(show?.total_episodes_count ?? 0);
      const notAired = Number(show?.not_aired_episodes_count ?? 0);
      const watched = Number(show?.watched_episodes_count ?? 0);
      if (!Number.isFinite(total) || total <= 0) return Number.POSITIVE_INFINITY;
      return Math.max(0, total - notAired - watched);
    };
    const hasOnlyOneEpisodeToWatch = (show) => {
      if (normalizeStatus(show.status) !== "watching") return false;
      return availableEpisodesLeft(show) === 1;
    };
    const byTvOrder = (a, b) => {
      const aPlanning = normalizeStatus(a.status) === "plantowatch";
      const bPlanning = normalizeStatus(b.status) === "plantowatch";
      if (aPlanning !== bPlanning) return aPlanning ? 1 : -1;
      const aOneLeft = hasOnlyOneEpisodeToWatch(a);
      const bOneLeft = hasOnlyOneEpisodeToWatch(b);
      if (aOneLeft !== bOneLeft) return aOneLeft ? -1 : 1;
      if (aPlanning) return new Date(a.added_at || 0) - new Date(b.added_at || 0);
      return new Date(b.last_watched_at || 0) - new Date(a.last_watched_at || 0);
    };
    const queued = [
      ...shows
        .filter((s) => normalizeStatus(s.status) === "watching" && Boolean(parseNextEpisode(s.next_to_watch)) && aired(s))
        .map((show) => ({ ...show, watchAction: buildEpisodeWatchAction(show) })),
      ...shows
        .filter((s) => normalizeStatus(s.status) === "plantowatch" && aired(s))
        .map((show) => ({ ...show, watchAction: buildEpisodeWatchAction(show, true) })),
    ];
    const details = await fetchDetails("tv", queued);
    return queued
      .map((show, i) => mergeSimklDetail(show, details[i]))
      .sort(byTvOrder);
  }

  async function buildMovieCandidates(movies) {
    const today = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const queued = movies.filter((m) => ["plantowatch", "watching"].includes(normalizeStatus(m.status)));
    const details = await fetchDetails("movies", queued);
    const releasedIds = new Set();
    const detailBySimkl = {};
    queued.forEach((m, i) => {
      const simklId = getSimklId(m);
      const detail = details[i];
      if (detail && simklId) detailBySimkl[simklId] = detail;
      if (m.year < currentYear || !detail || !detail.released || detail.released <= today) releasedIds.add(simklId);
    });
    return queued
      .filter((m) => releasedIds.has(getSimklId(m)))
      .sort((a, b) => new Date(a.added_at || 0) - new Date(b.added_at || 0))
      .map((movie) => {
        const detail = detailBySimkl[getSimklId(movie)];
        return {
          ...mergeSimklDetail(movie, detail, { includeIds: false }),
          watchAction: {
            payload: { movies: [{ title: movie.title, year: movie.year, ids: movie.ids, watched_at: new Date().toISOString() }] },
            label: "Mark movie watched",
          },
        };
      });
  }

  async function fetchSuggestionLists() {
    const synced = await getSyncedMasterData();
    const shows = synced.shows?.items || [];
    const movies = synced.movies?.items || [];
    const anime = synced.anime?.items || [];
    const activeShows = shows.filter((item) => ["watching", "plantowatch"].includes(normalizeStatus(item.status)));
    const activeMovies = movies.filter((item) => ["watching", "plantowatch"].includes(normalizeStatus(item.status)));
    const activeAnime = anime.filter((item) => ["watching", "plantowatch"].includes(normalizeStatus(item.status)));
    return {
      shows: activeShows.concat(activeAnime),
      movies: activeMovies,
      completedShows: shows.filter((item) => normalizeStatus(item.status) === "completed")
        .concat(anime.filter((item) => normalizeStatus(item.status) === "completed")),
      completedMovies: movies.filter((item) => normalizeStatus(item.status) === "completed"),
    };
  }

  async function buildSuggestionsModel() {
    const { shows, movies, completedShows, completedMovies } = await fetchSuggestionLists();
    const libraryIds = new Set([
      ...shows.flatMap(getAllSimklIds),
      ...movies.flatMap(getAllSimklIds),
      ...completedShows.flatMap(getAllSimklIds),
      ...completedMovies.flatMap(getAllSimklIds),
    ]);

    const [tvItems, movieItems] = await Promise.all([
      buildTvCandidates(shows),
      buildMovieCandidates(movies),
    ]);

    return { libraryIds, tvItems, movieItems };
  }

  async function enrichWithEpisodeTitle(item) {
    const nextEpisode = parseNextEpisode(item?.next_to_watch);
    const simklId = getSimklId(item);
    if (!nextEpisode || !simklId) return item;
    try {
      const episodes = await fetchSimkl(`https://api.simkl.com/tv/episodes/${encodeURIComponent(simklId)}`);
      if (!Array.isArray(episodes)) return item;
      const match = episodes.find((e) => Number(e?.season) === nextEpisode.season && Number(e?.episode) === nextEpisode.episode && e?.type === "episode");
      const seasonImg = episodes.find((e) => Number(e?.season) === nextEpisode.season && e?.type === "season")?.img || null;
      return { ...item, nextEpisodeTitle: match?.title || null, nextSeasonImg: seasonImg };
    } catch {
      return item;
    }
  }

  function loadGenreCache() {
    try { return JSON.parse(localStorage.getItem(storageKeys.genreCache) || "{}"); } catch { return {}; }
  }

  function loadStatsCache() {
    try {
      const raw = localStorage.getItem(storageKeys.statsCache);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      return Date.now() - cached.ts > STATS_CACHE_TTL ? null : cached;
    } catch {
      return null;
    }
  }

  function saveStatsCache(data, activitiesSignature = "") {
    try { localStorage.setItem(storageKeys.statsCache, JSON.stringify({ ts: Date.now(), activitiesSignature, data })); } catch {}
  }

  async function fetchItemDetails(items, type) {
    const cache = loadGenreCache();
    const now = Date.now();
    const subset = [...items]
      .sort((a, b) => new Date(b.last_watched_at || 0) - new Date(a.last_watched_at || 0))
      .slice(0, 50);
    const settled = await Promise.allSettled(subset.map((item) => {
      const id = getSimklId(item);
      if (!id) return Promise.resolve(null);
      const key = `${type}:${id}`;
      const cached = cache[key];
      if (cached && now - cached.ts < GENRE_CACHE_TTL) return Promise.resolve(cached);
      return fetchDetail(type, id).then((data) => {
        if (!data) return null;
        const entry = { genres: data?.genres || [], network: data?.network || null, ts: now };
        cache[key] = entry;
        return entry;
      });
    }));
    try { localStorage.setItem(storageKeys.genreCache, JSON.stringify(cache)); } catch {}
    const genres = {}, networks = {};
    for (const r of settled) {
      const val = r.status === "fulfilled" ? r.value : null;
      for (const g of val?.genres || []) genres[g] = (genres[g] || 0) + 1;
      if (val?.network) networks[val.network] = (networks[val.network] || 0) + 1;
    }
    return { genres, networks };
  }

  async function fetchStatsSourceData() {
    const syncCache = await getSyncedMasterData();
    const statsCache = loadStatsCache();
    if (statsCache?.activitiesSignature && statsCache.activitiesSignature === syncCache.activitiesSignature) return statsCache.data;

    const settings = await fetchSimkl("https://api.simkl.com/users/settings");
    const userId = settings?.account?.id;
    if (!userId) throw new Error("Could not determine user ID.");
    const shows = (syncCache.shows?.items || []).concat(syncCache.anime?.items || [])
      .filter((item) => ["watching", "completed", "hold", "dropped"].includes(normalizeStatus(item.status)));
    const movies = (syncCache.movies?.items || [])
      .filter((item) => ["watching", "completed", "hold", "dropped"].includes(normalizeStatus(item.status)));
    const watched = (item) => normalizeStatus(item.status) !== "plantowatch";
    const [apiStats, tvDetails, movieDetails] = await Promise.all([
      fetchSimkl(`https://api.simkl.com/users/${encodeURIComponent(userId)}/stats`, { method: "POST" }),
      fetchItemDetails(shows.filter(watched), "tv"),
      fetchItemDetails(movies.filter(watched), "movies"),
    ]);
    const data = { shows, movies, tvDetails, movieDetails, apiStats };
    saveStatsCache(data, syncCache.activitiesSignature || "");
    return data;
  }

  function addToWatchlist(type, simklId) {
    const key = type === "movie" ? "movies" : "shows";
    return fetchSimkl("https://api.simkl.com/sync/add-to-list", {
      method: "POST",
      body: JSON.stringify({ [key]: [{ to: "plantowatch", ids: { simkl: Number(simklId) } }] }),
    });
  }

  function addHistory(payload) {
    return fetchSimkl("https://api.simkl.com/sync/history", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  function removeHistory(payload) {
    return fetchSimkl("https://api.simkl.com/sync/history/remove", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  function rate(type, simklId, rating, ratedAt) {
    const key = type === "tv" ? "shows" : "movies";
    return fetchSimkl("https://api.simkl.com/ratings", {
      method: "POST",
      body: JSON.stringify({ [key]: [{ ids: { simkl: simklId }, rating, rated_at: ratedAt }] }),
    });
  }

  return {
    id: "simkl",
    getClientId,
    getAccessToken,
    getSimklId,
    getAllIds: getAllSimklIds,
    fetch: fetchSimkl,
    fetchActivities,
    getSyncedMasterData,
    buildAuthorizeUrl,
    exchangeAuthorizationCode,
    fetchDetail,
    fetchDetails,
    validateCredentials,
    getAuthErrorMessage,
    fetchSuggestionLists,
    buildSuggestionsModel,
    enrichWithEpisodeTitle,
    fetchItemDetails,
    fetchStatsSourceData,
    loadStatsCache,
    saveStatsCache,
    addToWatchlist,
    addHistory,
    removeHistory,
    rate,
  };
};
