(function () {
  "use strict";

  class ApiError extends Error {
    constructor(msg) { super(msg); this.name = "ApiError"; }
  }

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
