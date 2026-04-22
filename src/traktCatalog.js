export const traktCatalog = {
  async searchByTitle(title, year, type) {
    const q = encodeURIComponent(`${title} ${year || ""}`.trim())
    try {
      if (type === "tv") {
        const r = await apiFetch(`/search/show?query=${q}&limit=1&extended=full`)
        return r[0]?.show ? enrich(r[0].show, "tv") : null
      }
      if (type === "movie") {
        const r = await apiFetch(`/search/movie?query=${q}&limit=1&extended=full`)
        return r[0]?.movie ? enrich(r[0].movie, "movie") : null
      }
      const [shows, movies] = await Promise.all([
        apiFetch(`/search/show?query=${q}&limit=1&extended=full`),
        apiFetch(`/search/movie?query=${q}&limit=1&extended=full`),
      ])
      if (shows[0]?.show) return enrich(shows[0].show, "tv")
      if (movies[0]?.movie) return enrich(movies[0].movie, "movie")
      return null
    } catch {
      return null
    }
  },
}

async function apiFetch(path) {
  const res = await fetch(`https://api.trakt.tv${path}`, {
    headers: {
      "Content-Type": "application/json",
      "trakt-api-key": window.__TRAKT_CLIENT_ID__,
      "trakt-api-version": "2",
    },
  })
  const data = await res.json().catch(() => ([]))
  if (!res.ok) throw new Error(data.error || data.message || `Trakt API error ${res.status}`)
  return data
}

function enrich(media, type) {
  const rawIds = media.ids || {}
  const ids = {
    ...(rawIds.trakt != null && { trakt: rawIds.trakt }),
    ...(rawIds.imdb && { imdb: rawIds.imdb }),
    ...(rawIds.tmdb != null && { tmdb: rawIds.tmdb }),
    ...(rawIds.slug && { slug: rawIds.slug }),
  }
  const releaseDate = type === "movie" ? media.released : media.first_aired
  return {
    ids,
    id: String(rawIds.imdb || rawIds.trakt || ""),
    title: media.title || "",
    year: media.year || "",
    type,
    posterUrl: "",
    url: rawIds.slug ? `https://app.trakt.tv/${type === "movie" ? "movies" : "shows"}/${encodeURIComponent(rawIds.slug)}` : "",
    runtime: media.runtime || 0,
    rating: typeof media.rating === "number" ? Math.round(media.rating * 10) / 10 : null,
    release_status: releaseDate && new Date(releaseDate).getTime() > Date.now() ? "unreleased" : undefined,
  }
}
