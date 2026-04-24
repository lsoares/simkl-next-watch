import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  test("marks the next episode of a watching TV show", async ({ page, simkl }) => {
    await simkl.useOauthToken()
    await simkl.useTrendingTv({})
    await simkl.useTrendingMovies({})
    await simkl.useSyncActivities()
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "watching", next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62,
    }])
    await simkl.useSyncMovies([])
    await simkl.useSyncAnime([])
    await simkl.useTvEpisodes("11121", [
      { season: 5, episode: 1, type: "episode", title: "Live Free or Die" },
    ])
    await simkl.useMarkWatchedShow([{ ids: { simkl: 11121 }, seasons: [{ number: 5, episodes: [{ number: 1 }] }] }])
    await simkl.useAuthorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with simkl/i }).click()
    const showCard = page.getByRole("article", { name: "Breaking Bad" })
    await expect(showCard.getByRole("link", { name: "Breaking Bad" })).toHaveAttribute("href", "https://simkl.com/tv/11121/breaking-bad")
    await expect(showCard.getByRole("link", { name: "5x1: Live Free or Die" })).toHaveAttribute("href", "https://simkl.com/tv/11121/breaking-bad/season-5/episode-1/")
    await expect(page.getByRole("link", { name: "Add series" })).toHaveAttribute("href", "https://simkl.com/search/?type=tv")
    await simkl.useSyncActivities("2025-02-01T00:00:00Z")
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
      status: "watching", next_to_watch: "S05E02",
      watched_episodes_count: 47, total_episodes_count: 62,
    }])

    await showCard.getByRole("button", { name: /mark as watched/i }).click()

    const toast = page.getByRole("status")
    await expect(toast).toContainText(/marked.*breaking bad.*5x1.*watched/i)
    await expect(toast.getByRole("link", { name: "Breaking Bad 5x1" })).toHaveAttribute("href", "https://simkl.com/tv/11121/breaking-bad/season-5/episode-1/")
    await expect(showCard.getByRole("link", { name: /5x2/ })).toHaveAttribute("href", "https://simkl.com/tv/11121/breaking-bad/season-5/episode-2/")
  })
})

test.describe("Trakt", () => {
  test("marks the next episode of a watching TV show", async ({ page, trakt, tmdb }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchedMovies([])
    await trakt.useRatingsShows([])
    await trakt.useRatingsMovies([])
    await trakt.useWatchedShowsByPeriod({})
    await trakt.useWatchedMoviesByPeriod({})
    await tmdb.usePosters()
    await trakt.useWatchlistShows([])
    await trakt.useWatchlistMovies([])
    await trakt.useDroppedShows([])
    await trakt.useWatchedShows([{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }])
    await trakt.useProgress("breaking-bad", { next_episode: { season: 5, number: 1, title: "Live Free or Die" } })
    await trakt.useMarkWatchedShow([{ ids: { trakt: 1388, imdb: "tt0903747", slug: "breaking-bad" }, seasons: [{ number: 5, episodes: [{ number: 1 }] }] }])
    await trakt.useAuthorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()
    const showCard = page.getByRole("article", { name: "Breaking Bad" })
    await expect(showCard.getByRole("link", { name: "Breaking Bad" })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad")
    await expect(showCard.getByRole("link", { name: "5x1: Live Free or Die" })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/1")
    await expect(page.getByRole("link", { name: "Add series" })).toHaveAttribute("href", "https://app.trakt.tv/search?m=show")
    await trakt.useWatchedShows([{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [
        { number: 4, episodes: [{ number: 13, plays: 1 }] },
        { number: 5, episodes: [{ number: 1, plays: 1 }] },
      ],
    }])
    await trakt.useProgress("breaking-bad", { next_episode: { season: 5, number: 2 } })

    await showCard.getByRole("button", { name: /mark as watched/i }).click()

    const toast = page.getByRole("status")
    await expect(toast).toContainText(/marked.*breaking bad.*5x1.*watched/i)
    await expect(toast.getByRole("link", { name: "Breaking Bad 5x1" })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/1")
    await expect(showCard.getByRole("link", { name: /5x2/ })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/2")
  })

  test("marks the first episode of a plantowatch show (starting it)", async ({ page, trakt, tmdb }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchedMovies([])
    await trakt.useRatingsShows([])
    await trakt.useRatingsMovies([])
    await trakt.useWatchedShowsByPeriod({})
    await trakt.useWatchedMoviesByPeriod({})
    await tmdb.usePosters()
    await trakt.useWatchedShows([])
    await trakt.useDroppedShows([])
    await trakt.useWatchlistMovies([])
    await trakt.useWatchlistShows([{
      listed_at: "2025-01-01T00:00:00Z",
      show: { title: "Severance", year: 2022, first_aired: "2022-02-18", aired_episodes: 19, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
    }])
    await trakt.useMarkWatchedShow([{ ids: { trakt: 153027, imdb: "tt11280740", slug: "severance" }, seasons: [{ number: 1, episodes: [{ number: 1 }] }] }])
    await trakt.useRemoveFromWatchlistShow([{ ids: { trakt: 153027, imdb: "tt11280740", slug: "severance" } }])
    await trakt.useAuthorize()
    await page.goto("/")
    await page.getByRole("button", { name: /sign in with trakt/i }).click()
    const showCard = page.getByRole("article", { name: "Severance" })
    await expect(showCard).toBeVisible()
    await trakt.useWatchlistShows([])
    await trakt.useWatchedShows([{
      last_watched_at: new Date().toISOString(),
      show: { title: "Severance", year: 2022, aired_episodes: 19, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
      seasons: [{ number: 1, episodes: [{ number: 1, plays: 1 }] }],
    }])
    await trakt.useProgress("severance", { next_episode: { season: 1, number: 2 } })

    await showCard.getByRole("button", { name: /mark as watched/i }).click()

    const toast = page.getByRole("status")
    await expect(toast).toContainText(/marked.*severance.*1x1.*watched/i)
    await expect(toast.getByRole("link", { name: "Severance 1x1" })).toHaveAttribute("href", "https://app.trakt.tv/shows/severance/seasons/1/episodes/1")
    await expect(showCard.getByRole("link", { name: /1x2/ })).toHaveAttribute("href", "https://app.trakt.tv/shows/severance/seasons/1/episodes/2")
  })
})
