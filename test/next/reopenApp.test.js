import { test } from "../test.js"

test.describe("Simkl", () => {
  test("reopening reflects status changes, removals, and additions made on Simkl", async ({ page, simkl, tmdb, intro, next }) => {
    await tmdb.useDetails("tv", "1396")
    await tmdb.useDetails("tv", "4607")
    await tmdb.useDetails("movie", "603")
    await tmdb.useDetails("movie", "27205")
    await tmdb.useDetails("tv", "87108")
    await tmdb.useDetails("movie", "438631")
    await signInWithSimklLibrary(page, simkl, intro, {
      shows: [
        { title: "Breaking Bad", year: 2008, id: 11121, tmdb: "1396", status: "plantowatch" },
        { title: "Lost", year: 2004, id: 33000, tmdb: "4607", status: "plantowatch" },
      ],
      movies: [
        { title: "The Matrix", year: 1999, id: 53992, tmdb: "603", status: "plantowatch" },
        { title: "Inception", year: 2010, id: 22222, tmdb: "27205", status: "plantowatch" },
      ],
    })
    await next.expectShowIsPresent("Breaking Bad")
    await next.expectShowIsPresent("Lost")
    await next.expectShowIsPresent("The Matrix")
    await next.expectShowIsPresent("Inception")
    await publishSimklLibraryDelta(simkl, {
      shows: [
        { title: "Breaking Bad", year: 2008, id: 11121, tmdb: "1396", status: "completed" },
        { title: "Chernobyl", year: 2019, id: 22000, tmdb: "87108", status: "plantowatch" },
      ],
      movies: [
        { title: "The Matrix", year: 1999, id: 53992, tmdb: "603", status: "completed" },
        { title: "Dune", year: 2021, id: 99003, tmdb: "438631", status: "plantowatch" },
      ],
    }, "2025-02-01T00:00:00Z")
    await simkl.useSyncLibraryIds({
      shows: [{ show: { ids: { simkl: 11121 } } }, { show: { ids: { simkl: 22000 } } }],
      movies: [{ movie: { ids: { simkl: 53992 } } }, { movie: { ids: { simkl: 99003 } } }],
    })

    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))

    await next.expectShowIsAbsent("Breaking Bad")
    await next.expectShowIsAbsent("The Matrix")
    await next.expectShowIsAbsent("Lost")
    await next.expectShowIsAbsent("Inception")
    await next.expectShowIsPresent("Chernobyl")
    await next.expectShowIsPresent("Dune")
  })
})

test.describe("Trakt", () => {
  test("reopening the app pulls changes made on Trakt's site since last visit", async ({ page, trakt, tmdb, intro, next }) => {
    await tmdb.useDetails("tv", "1396")
    await tmdb.useDetails("movie", "603")
    await tmdb.useDetails("tv", "87108")
    await tmdb.useDetails("movie", "438631")
    await signInWithTraktLibrary(page, trakt, intro, {
      watchlistShows: [{ title: "Breaking Bad", trakt: 1388, imdb: "tt0903747", tmdb: "1396", slug: "breaking-bad" }],
      watchlistMovies: [{ title: "The Matrix", trakt: 481, imdb: "tt0133093", tmdb: "603", slug: "the-matrix-1999" }],
    })
    await next.expectShowIsPresent("Breaking Bad")
    await next.expectShowIsPresent("The Matrix")
    await publishTraktLibrary(trakt, {
      watchedShows: [{ title: "Breaking Bad", trakt: 1388, imdb: "tt0903747", tmdb: "1396", slug: "breaking-bad" }],
      watchlistShows: [{ title: "Chernobyl", trakt: 2000, imdb: "tt7366338", tmdb: "87108", slug: "chernobyl" }],
      watchlistMovies: [{ title: "Dune", trakt: 9999, imdb: "tt1160419", tmdb: "438631", slug: "dune-2021" }],
    }, "2025-02-01T00:00:00Z")

    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))

    await next.expectShowIsAbsent("Breaking Bad")
    await next.expectShowIsAbsent("The Matrix")
    await next.expectShowIsPresent("Chernobyl")
    await next.expectShowIsPresent("Dune")
  })
})

async function signInWithSimklLibrary(page, simkl, intro, library) {
  await simkl.useOauthToken()
  await simkl.useTrendingTv()
  await simkl.useTrendingMovies()
  await simkl.useSyncActivities("2025-01-01T00:00:00Z")
  const { shows, movies } = toLibraryPayload(library)
  await simkl.useSyncShows(shows)
  await simkl.useSyncMovies(movies)
  await simkl.useSyncAnime()
  await simkl.useAuthorize()
  await page.goto("/")
  await intro.signIn("simkl")
}

async function publishSimklLibraryDelta(simkl, library, activityAt) {
  await simkl.useSyncActivities(activityAt)
  const { shows, movies } = toLibraryPayload(library)
  await simkl.useSyncShows(shows, "2025-01-01T00:00:00Z")
  await simkl.useSyncMovies(movies, "2025-01-01T00:00:00Z")
  await simkl.useSyncAnime([], "2025-01-01T00:00:00Z")
}

function toLibraryPayload({ shows, movies }) {
  return {
    shows: shows.map(({ title, year, id, tmdb, status }) => ({ show: { title, year, ids: { simkl_id: id, tmdb } }, status })),
    movies: movies.map(({ title, year, id, tmdb, status }) => ({ movie: { title, year, ids: { simkl_id: id, tmdb }, runtime: 120 }, status })),
  }
}

async function signInWithTraktLibrary(page, trakt, intro, library) {
  await trakt.useOauthToken()
  await trakt.useWatchedMovies()
  await trakt.useRatingsShows()
  await trakt.useRatingsMovies()
  await trakt.useWatchedShowsByPeriod()
  await trakt.useWatchedMoviesByPeriod()
  await trakt.useDroppedShows()
  await publishTraktLibrary(trakt, library, "2025-01-01T00:00:00Z")
  await trakt.useAuthorize()
  await page.goto("/")
  await intro.signIn("trakt")
}

async function publishTraktLibrary(trakt, { watchlistShows = [], watchlistMovies = [], watchedShows = [] }, activityAt) {
  await trakt.useLastActivities({ showsWatchlistedAt: activityAt, moviesWatchlistedAt: activityAt, episodesWatchedAt: activityAt })
  await trakt.useWatchlistShows(watchlistShows.map(({ title, trakt, imdb, tmdb, slug }) => ({
    listed_at: "2025-01-01T00:00:00Z",
    show: { title, year: 2020, first_aired: "2020-01-01", aired_episodes: 1, ids: { trakt, slug, imdb, tmdb } },
  })))
  await trakt.useWatchlistMovies(watchlistMovies.map(({ title, trakt, imdb, tmdb, slug }) => ({
    listed_at: "2025-01-01T00:00:00Z",
    movie: { title, year: 2020, released: "2020-01-01", ids: { trakt, slug, imdb, tmdb } },
  })))
  await trakt.useWatchedShows(watchedShows.map(({ title, trakt, imdb, tmdb, slug }) => ({
    last_watched_at: "2025-01-01T00:00:00Z",
    show: { title, year: 2020, aired_episodes: 1, ids: { trakt, slug, imdb, tmdb } },
    seasons: [{ number: 1, episodes: [{ number: 1 }] }],
  })))
}
