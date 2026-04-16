const assert = require("node:assert/strict")
const { http, HttpResponse } = require("msw")

function syncActivities() {
  return http.post("https://api.simkl.com/sync/activities", ({ request }) => {
    assert.equal(request.headers.get("simkl-api-key"), "test-client-id")
    assert.equal(request.headers.get("authorization"), "Bearer test-token")
    return HttpResponse.json({ all: "2025-01-01T00:00:00Z" })
  })
}

function syncShows(shows) {
  return http.get("https://api.simkl.com/sync/all-items/shows/", ({ request }) => {
    assert.equal(request.headers.get("simkl-api-key"), "test-client-id")
    assert.equal(request.headers.get("authorization"), "Bearer test-token")
    const params = new URL(request.url).searchParams
    assert.equal(params.get("extended"), "full")
    assert.equal(params.get("episode_watched_at"), "yes")
    return HttpResponse.json({ shows })
  })
}

function syncMovies(movies) {
  return http.get("https://api.simkl.com/sync/all-items/movies/", ({ request }) => {
    assert.equal(request.headers.get("simkl-api-key"), "test-client-id")
    assert.equal(request.headers.get("authorization"), "Bearer test-token")
    const params = new URL(request.url).searchParams
    assert.equal(params.get("extended"), "full")
    assert.equal(params.get("episode_watched_at"), "yes")
    return HttpResponse.json({ movies })
  })
}

function syncAnime(anime) {
  return http.get("https://api.simkl.com/sync/all-items/anime/", ({ request }) => {
    assert.equal(request.headers.get("simkl-api-key"), "test-client-id")
    assert.equal(request.headers.get("authorization"), "Bearer test-token")
    const params = new URL(request.url).searchParams
    assert.equal(params.get("extended"), "full")
    assert.equal(params.get("episode_watched_at"), "yes")
    return HttpResponse.json({ anime })
  })
}

function tvEpisodes(expectedId) {
  return http.get("https://api.simkl.com/tv/episodes/:id", ({ request, params }) => {
    assert.equal(request.headers.get("simkl-api-key"), "test-client-id")
    if (expectedId) assert.equal(params.id, expectedId)
    return HttpResponse.json([])
  })
}

function searchTv() {
  return http.get("https://api.simkl.com/search/tv", ({ request }) => {
    assert.equal(request.headers.get("simkl-api-key"), "test-client-id")
    assert.equal(request.headers.get("authorization"), "Bearer test-token")
    const params = new URL(request.url).searchParams
    assert.ok(params.get("q"))
    assert.equal(params.get("limit"), "1")
    return HttpResponse.json([])
  })
}

function searchMovie(results) {
  return http.get("https://api.simkl.com/search/movie", ({ request }) => {
    assert.equal(request.headers.get("simkl-api-key"), "test-client-id")
    assert.equal(request.headers.get("authorization"), "Bearer test-token")
    const params = new URL(request.url).searchParams
    assert.ok(params.get("q"))
    assert.equal(params.get("limit"), "1")
    const q = params.get("q")
    for (const [keyword, item] of Object.entries(results)) {
      if (q.includes(keyword)) return HttpResponse.json([item])
    }
    return HttpResponse.json([])
  })
}

function trendingTv(items) {
  return http.get("https://data.simkl.in/discover/trending/tv/:period", () =>
    HttpResponse.json(items)
  )
}

function trendingMovies(items) {
  return http.get("https://data.simkl.in/discover/trending/movies/:period", () =>
    HttpResponse.json(items)
  )
}

module.exports = { syncActivities, syncShows, syncMovies, syncAnime, tvEpisodes, searchTv, searchMovie, trendingTv, trendingMovies }
