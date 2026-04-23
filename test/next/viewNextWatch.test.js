import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  test("filters out completed shows from the watching list", async ({ page, simkl }) => {
    await simkl.oauthToken()
    await simkl.trendingTv({})
    await simkl.trendingMovies({})
    await simkl.syncActivities()
    await simkl.syncShows([
      {
        show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
        status: "watching", next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62,
      },
      {
        show: { title: "Chernobyl", ids: { simkl_id: 22000 } },
        status: "completed",
      },
    ])
    await simkl.syncMovies([])
    await simkl.syncAnime([])
    await simkl.tvEpisodes("11121", [])
    await simkl.authorize()
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with simkl/i }).click()

    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Chernobyl" })).toHaveCount(0)
  })

  test("watchlist hides unreleased shows and movies", async ({ page, simkl, tmdb }) => {
    await simkl.oauthToken()
    await simkl.trendingTv({})
    await simkl.trendingMovies({})
    await tmdb.posters(2)
    await simkl.syncActivities()
    await simkl.syncShows([
      { show: { title: "Severance", year: 2022, ids: { simkl_id: 153027 } }, status: "plantowatch" },
      { show: { title: "Unreleased Show", year: 2099, ids: { simkl_id: 99999 } }, status: "plantowatch" },
    ])
    await simkl.syncMovies([
      { movie: { title: "The Matrix", year: 1999, runtime: 136, ids: { simkl_id: 53992 } }, status: "plantowatch" },
      { movie: { title: "Avatar Fire and Ash", year: 2099, ids: { simkl_id: 90000 } }, status: "plantowatch" },
    ])
    await simkl.syncAnime([])
    await simkl.authorize()
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with simkl/i }).click()

    await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
    await expect(page.getByRole("article", { name: "The Matrix" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Unreleased Show" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "Avatar Fire and Ash" })).toHaveCount(0)
  })
})

test.describe("Trakt", () => {
  test("filters out completed and dropped shows from the watching list", async ({ page, trakt, tmdb }) => {
    await trakt.oauthToken()
    await trakt.watchedMovies([])
    await trakt.ratingsShows([])
    await trakt.ratingsMovies([])
    await trakt.watchedShowsByPeriod({})
    await trakt.watchedMoviesByPeriod({})
    await tmdb.posters()
    await trakt.lastActivities()
    await trakt.watchlistShows([])
    await trakt.watchlistMovies([])
    await trakt.watchedShows([
      {
        last_watched_at: new Date().toISOString(),
        show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
        seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
      },
      {
        last_watched_at: new Date().toISOString(),
        show: { title: "Chernobyl", year: 2019, aired_episodes: 5, ids: { trakt: 2000, slug: "chernobyl", imdb: "tt7366338" } },
        seasons: [{ number: 1, episodes: [{ number: 1 }, { number: 2 }, { number: 3 }, { number: 4 }, { number: 5 }] }],
      },
      {
        last_watched_at: new Date().toISOString(),
        show: { title: "Lost", year: 2004, aired_episodes: 121, ids: { trakt: 3000, slug: "lost", imdb: "tt0411008" } },
        seasons: [{ number: 1, episodes: [{ number: 1 }, { number: 2 }] }],
      },
    ])
    await trakt.droppedShows([
      { hidden_at: "2025-01-01T00:00:00Z", type: "show", show: { title: "Lost", year: 2004, ids: { trakt: 3000, slug: "lost", imdb: "tt0411008" } } },
    ])
    await trakt.progress("breaking-bad", { next_episode: { season: 5, number: 1, title: "Live Free or Die" } })
    await trakt.authorize()
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Chernobyl" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "Lost" })).toHaveCount(0)
  })

  test("watchlist hides unreleased shows and movies", async ({ page, trakt, tmdb }) => {
    await trakt.oauthToken()
    await trakt.watchedMovies([])
    await trakt.ratingsShows([])
    await trakt.ratingsMovies([])
    await trakt.watchedShowsByPeriod({})
    await trakt.watchedMoviesByPeriod({})
    await tmdb.posters(2)
    await trakt.lastActivities()
    await trakt.watchedShows([])
    await trakt.droppedShows([])
    await trakt.watchlistShows([
      {
        listed_at: "2025-01-01T00:00:00Z",
        show: { title: "Severance", year: 2022, first_aired: "2022-02-18", aired_episodes: 19, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
      },
      {
        listed_at: "2025-01-01T00:00:00Z",
        show: { title: "Unreleased Show", year: 2099, first_aired: "2099-01-01", aired_episodes: 0, ids: { trakt: 9999, slug: "unreleased-show", imdb: "tt9999999" } },
      },
    ])
    await trakt.watchlistMovies([
      {
        listed_at: "2025-01-01T00:00:00Z",
        movie: { title: "The Matrix", year: 1999, released: "1999-03-31", ids: { trakt: 481, slug: "the-matrix-1999", imdb: "tt0133093" } },
      },
      {
        listed_at: "2025-01-01T00:00:00Z",
        movie: { title: "Avatar Fire and Ash", year: 2099, released: "2099-12-19", ids: { trakt: 9000, slug: "avatar-fire-and-ash", imdb: "tt1757678" } },
      },
    ])
    await trakt.authorize()
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
    await expect(page.getByRole("article", { name: "The Matrix" })).toBeVisible()
    await expect(page.getByRole("article", { name: "Unreleased Show" })).toHaveCount(0)
    await expect(page.getByRole("article", { name: "Avatar Fire and Ash" })).toHaveCount(0)
  })

  test("watchlist movies show formatted runtime chips", async ({ page, trakt, tmdb }) => {
    await trakt.oauthToken()
    await trakt.watchedMovies([])
    await trakt.ratingsShows([])
    await trakt.ratingsMovies([])
    await trakt.watchedShowsByPeriod({})
    await trakt.watchedMoviesByPeriod({})
    await tmdb.posters(3)
    await trakt.lastActivities()
    await trakt.watchlistShows([])
    await trakt.watchedShows([])
    await trakt.droppedShows([])
    await trakt.watchlistMovies([
      { listed_at: "2025-01-01T00:00:00Z", movie: { title: "Short Movie", year: 2020, released: "2020-01-01", runtime: 45, ids: { trakt: 1, slug: "short-movie", imdb: "tt0000001" } } },
      { listed_at: "2025-01-01T00:00:00Z", movie: { title: "Mid Movie", year: 2020, released: "2020-01-01", runtime: 100, ids: { trakt: 2, slug: "mid-movie", imdb: "tt0000002" } } },
      { listed_at: "2025-01-01T00:00:00Z", movie: { title: "Long Movie", year: 2020, released: "2020-01-01", runtime: 125, ids: { trakt: 3, slug: "long-movie", imdb: "tt0000003" } } },
    ])
    await trakt.authorize()
    await page.goto("/")

    await page.getByRole("button", { name: /sign in with trakt/i }).click()

    await expect(page.getByRole("article", { name: "Short Movie" }).getByText("45m", { exact: true })).toBeVisible()
    await expect(page.getByRole("article", { name: "Mid Movie" }).getByText("~1.5h", { exact: true })).toBeVisible()
    await expect(page.getByRole("article", { name: "Long Movie" }).getByText("~2h", { exact: true })).toBeVisible()
  })
})
