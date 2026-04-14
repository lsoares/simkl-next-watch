window.createSimklProvider = function createSimklProvider({
  storageKeys,
  GENRE_CACHE_TTL,
  STATS_CACHE_TTL,
  getClientId,
  getAccessToken,
  normalizeList,
  normalizeStatus,
  parseNextEpisode,
  buildEpisodeWatchAction,
  getItemIds,
}) {
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

  function buildHeaders(optionsHeaders = {}, credentials = {}) {
    const clientId = credentials.clientId ?? getClientId();
    const accessToken = credentials.accessToken ?? getAccessToken();
    return {
      "Content-Type": "application/json",
      "simkl-api-key": clientId,
      Authorization: `Bearer ${accessToken}`,
      ...optionsHeaders,
    };
  }

  async function fetchSimkl(url, options = {}, credentials) {
    const response = await fetch(url, {
      ...options,
      headers: buildHeaders(options.headers || {}, credentials),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || payload.message || `Simkl request failed with ${response.status}.`);
    return payload;
  }

  async function validateCredentials({ clientId, accessToken }) {
    await fetchSimkl("https://api.simkl.com/sync/activities", {}, { clientId, accessToken });
  }

  async function fetchDetail(type, simklId) {
    if (!simklId) return null;
    try {
      return await fetchSimkl(`https://api.simkl.com/${type}/${encodeURIComponent(simklId)}?client_id=${encodeURIComponent(getClientId())}`);
    } catch {
      return null;
    }
  }

  async function fetchDetails(type, items) {
    return Promise.all(items.map((item) => fetchDetail(type, getSimklId(item))));
  }

  async function buildTvCandidates(shows) {
    const aired = (s) => (s.total_episodes_count ?? 0) === 0 || (s.total_episodes_count ?? 0) > (s.not_aired_episodes_count ?? 0);
    const byTvOrder = (a, b) => {
      const aPlanning = normalizeStatus(a.status) === "plantowatch";
      const bPlanning = normalizeStatus(b.status) === "plantowatch";
      if (aPlanning !== bPlanning) return aPlanning ? 1 : -1;
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
    const [showsResponse, moviesResponse, completedShowsRes, completedMoviesRes] = await Promise.all([
      fetchSimkl("https://api.simkl.com/sync/all-items/shows/?status=watching,plantowatch&extended=full&episode_watched_at=yes"),
      fetchSimkl("https://api.simkl.com/sync/all-items/movies/?status=watching,plantowatch&extended=full"),
      fetchSimkl("https://api.simkl.com/sync/all-items/shows/?status=completed").catch(() => ({})),
      fetchSimkl("https://api.simkl.com/sync/all-items/movies/?status=completed").catch(() => ({})),
    ]);

    return {
      shows: normalizeList(showsResponse.shows),
      movies: normalizeList(moviesResponse.movies),
      completedShows: completedShowsRes.shows || [],
      completedMovies: completedMoviesRes.movies || [],
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
      return Date.now() - cached.ts > STATS_CACHE_TTL ? null : cached.data;
    } catch {
      return null;
    }
  }

  function saveStatsCache(data) {
    try { localStorage.setItem(storageKeys.statsCache, JSON.stringify({ ts: Date.now(), data })); } catch {}
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
    fetchDetail,
    fetchDetails,
    validateCredentials,
    fetchSuggestionLists,
    buildSuggestionsModel,
    enrichWithEpisodeTitle,
    fetchItemDetails,
    loadStatsCache,
    saveStatsCache,
    addToWatchlist,
    addHistory,
    removeHistory,
    rate,
  };
};
