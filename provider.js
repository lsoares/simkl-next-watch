window.createSimklProvider = function createSimklProvider({
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

  function buildIdPayload(id) {
    return { simkl: Number(id) };
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

  function getAuthErrorMessage(error) {
    const raw = String(error?.message || "").trim();
    if (raw === "user_token_failed") {
      return "Simkl rejected that access token. Use a valid user access token for this app.";
    }
    if (raw === "api_key_failed") {
      return "Simkl rejected that client ID. Check that the app client ID is correct.";
    }
    if (raw === "auth_failed") {
      return "Simkl rejected those credentials. Check the client ID and access token.";
    }
    return raw || "That client ID or token didn’t work. Check both values and try again.";
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

  async function fetchItemDetails(items, type) {
    const subset = [...items]
      .sort((a, b) => new Date(b.last_watched_at || 0) - new Date(a.last_watched_at || 0))
      .slice(0, 50);
    const settled = await Promise.allSettled(subset.map((item) => {
      const id = getSimklId(item);
      if (!id) return Promise.resolve(null);
      return fetchDetail(type, id).then((data) => {
        if (!data) return null;
        return { genres: data?.genres || [], network: data?.network || null };
      });
    }));
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
      body: JSON.stringify({ [key]: [{ to: "plantowatch", ids: buildIdPayload(simklId) }] }),
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
      body: JSON.stringify({ [key]: [{ ids: buildIdPayload(simklId), rating, rated_at: ratedAt }] }),
    });
  }

  return {
    id: "simkl",
    getClientId,
    getAccessToken,
    getPrimaryId: getSimklId,
    getSimklId,
    getAllIds: getAllSimklIds,
    buildIdPayload,
    fetch: fetchSimkl,
    fetchDetail,
    fetchDetails,
    validateCredentials,
    getAuthErrorMessage,
    fetchSuggestionLists,
    buildSuggestionsModel,
    enrichWithEpisodeTitle,
    fetchItemDetails,
    addToWatchlist,
    addHistory,
    removeHistory,
    rate,
  };
};

window.createTraktProvider = function createTraktProvider({
  getClientId,
  getAccessToken,
  getItemIds,
}) {
  const NOT_READY_MESSAGE = "Trakt login works, but library sync is not implemented yet.";

  function buildHeaders(optionsHeaders = {}, credentials = {}) {
    const clientId = credentials.clientId ?? getClientId();
    const accessToken = credentials.accessToken ?? getAccessToken();
    return {
      "Content-Type": "application/json",
      "trakt-api-key": clientId,
      "trakt-api-version": "2",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...optionsHeaders,
    };
  }

  async function fetchTrakt(url, options = {}, credentials) {
    const response = await fetch(url, {
      ...options,
      headers: buildHeaders(options.headers || {}, credentials),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || payload.message || `Trakt request failed with ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  async function validateCredentials({ clientId, accessToken }) {
    await fetchTrakt("https://api.trakt.tv/users/settings", {}, { clientId, accessToken });
  }

  function getAuthErrorMessage(error) {
    if (error?.status === 401) return "Trakt rejected that access token. Use a valid user access token for this app.";
    if (error?.status === 403) return "Trakt rejected that client ID or token scope. Check the app client ID and token.";
    const raw = String(error?.message || "").trim();
    return raw || "That client ID or token didn’t work. Check both values and try again.";
  }

  function getPrimaryId(item) {
    const ids = getItemIds(item);
    return ids.trakt || ids.slug || ids.imdb || null;
  }

  function getAllIds(item) {
    const ids = getItemIds(item);
    return [ids.trakt, ids.slug, ids.imdb].filter(Boolean).map(String);
  }

  function buildIdPayload(id) {
    const numericId = Number(id);
    return Number.isFinite(numericId) ? { trakt: numericId } : { slug: String(id) };
  }

  function buildPosterUrl(ids = {}) {
    if (ids.imdb) return `https://images.metahub.space/poster/medium/${encodeURIComponent(ids.imdb)}/img`;
    return "";
  }

  async function exchangeCodeForToken(code, clientId, clientSecret, redirectUri) {
    const response = await fetch("https://api.trakt.tv/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error_description || data.error || `Token exchange failed (${response.status}).`);
    return data; // { access_token, refresh_token, ... }
  }

  async function fetchWatchedShows() {
    return fetchTrakt("https://api.trakt.tv/sync/watched/shows?extended=noseasons");
  }

  async function fetchWatchlistMovies() {
    return fetchTrakt("https://api.trakt.tv/sync/watchlist/movies");
  }

  async function fetchShowProgress(showId) {
    try {
      return await fetchTrakt(`https://api.trakt.tv/shows/${encodeURIComponent(showId)}/progress/watched`);
    } catch {
      return null;
    }
  }

  async function buildSuggestionsModel() {
    const [watched, watchlistMovies] = await Promise.all([
      fetchWatchedShows(),
      fetchWatchlistMovies().catch(() => []),
    ]);

    const sorted = [...watched]
      .sort((a, b) => new Date(b.last_watched_at || 0) - new Date(a.last_watched_at || 0))
      .slice(0, 20);

    const progresses = await Promise.all(sorted.map(w => fetchShowProgress(w.show.ids.trakt)));

    const tvItems = sorted
      .map((w, i) => {
        const progress = progresses[i];
        if (!progress?.next_episode) return null;
        const { show } = w;
        const nextEp = progress.next_episode;
        return {
          title: show.title,
          year: show.year,
          ids: show.ids,
          status: "watching",
          last_watched_at: w.last_watched_at,
          next_to_watch: { season: nextEp.season, episode: nextEp.number },
          url: `https://trakt.tv/shows/${show.ids.slug}`,
          poster: buildPosterUrl(show.ids),
          watchAction: {
            payload: {
              shows: [{ ids: show.ids, seasons: [{ number: nextEp.season, episodes: [{ number: nextEp.number, watched_at: new Date().toISOString() }] }] }],
            },
            label: "Mark episode watched",
          },
        };
      })
      .filter(Boolean);

    const movieItems = [...watchlistMovies]
      .sort((a, b) => new Date(a.listed_at || 0) - new Date(b.listed_at || 0))
      .slice(0, 20)
      .map((entry) => {
        const movie = entry.movie || {};
        return {
          title: movie.title,
          year: movie.year,
          ids: movie.ids || {},
          status: "plantowatch",
          added_at: entry.listed_at || null,
          url: movie.ids?.slug ? `https://trakt.tv/movies/${movie.ids.slug}` : "",
          poster: buildPosterUrl(movie.ids || {}),
          watchAction: {
            payload: {
              movies: [{ ids: movie.ids, watched_at: new Date().toISOString() }],
            },
            label: "Mark movie watched",
          },
        };
      })
      .filter((movie) => movie.title && (movie.ids?.trakt || movie.ids?.slug || movie.ids?.imdb));

    const libraryIds = new Set([
      ...watched.flatMap(w => getAllIds({ ids: w.show.ids })),
      ...movieItems.flatMap(getAllIds),
    ]);

    return { libraryIds, tvItems, movieItems };
  }

  async function enrichWithEpisodeTitle(item) {
    const next = item?.next_to_watch;
    if (!next || typeof next !== "object") return item;
    const season = Number(next.season);
    const episode = Number(next.episode ?? next.number);
    if (!Number.isFinite(season) || !Number.isFinite(episode)) return item;
    const traktId = item.ids?.trakt;
    if (!traktId) return item;
    try {
      const ep = await fetchTrakt(`https://api.trakt.tv/shows/${encodeURIComponent(traktId)}/seasons/${season}/episodes/${episode}?extended=full`);
      return { ...item, nextEpisodeTitle: ep?.title || null };
    } catch {
      return item;
    }
  }

  function addHistory(payload) {
    return fetchTrakt("https://api.trakt.tv/sync/history", { method: "POST", body: JSON.stringify(payload) });
  }

  function removeHistory(payload) {
    return fetchTrakt("https://api.trakt.tv/sync/history/remove", { method: "POST", body: JSON.stringify(payload) });
  }

  function rate(type, id, rating, ratedAt) {
    const key = type === "tv" ? "shows" : "movies";
    return fetchTrakt("https://api.trakt.tv/sync/ratings", {
      method: "POST",
      body: JSON.stringify({ [key]: [{ ids: buildIdPayload(id), rating, rated_at: ratedAt }] }),
    });
  }

  function notReady() {
    throw new Error(NOT_READY_MESSAGE);
  }

  return {
    id: "trakt",
    supportsTrending: false,
    supportsStats: false,
    getClientId,
    getAccessToken,
    getPrimaryId,
    getAllIds,
    buildIdPayload,
    fetch: fetchTrakt,
    exchangeCodeForToken,
    validateCredentials,
    getAuthErrorMessage,
    fetchDetail: notReady,
    fetchDetails: notReady,
    fetchSuggestionLists: notReady,
    buildSuggestionsModel,
    enrichWithEpisodeTitle,
    fetchItemDetails: notReady,
    addToWatchlist: notReady,
    addHistory,
    removeHistory,
    rate,
  };
};
