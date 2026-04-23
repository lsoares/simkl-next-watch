import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime, setupTvEpisodes, setupMarkWatchedMovie, setupMarkWatchedShow, setupSimklTrendingTv, setupSimklTrendingMovies } from "./clients/simkl.js"
import { setupTmdb } from "./clients/tmdb.js"

test("marks the next episode of a watching TV show", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSimklTrendingTv(page, [])
  await setupSimklTrendingMovies(page, [])
  await setupSyncActivities(page)
  await setupSyncShows(page, [{
    show: { title: "Breaking Bad", ids: { simkl_id: 11121 } },
    status: "watching", next_to_watch: "S05E01",
    watched_episodes_count: 46, total_episodes_count: 62,
  }])
  await setupSyncMovies(page, [])
  await setupSyncAnime(page, [])
  await setupTvEpisodes(page, "11121", [
    { season: 5, episode: 1, type: "episode", title: "Live Free or Die" },
  ])
  await setupMarkWatchedShow(page, [{ ids: { simkl: 11121 }, seasons: [{ number: 5, episodes: [{ number: 1 }] }] }])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with simkl/i }).click()
  const showCard = page.getByRole("article", { name: "Breaking Bad" })
  await expect(showCard).toBeVisible()
  await setupSyncActivities(page, "2025-02-01T00:00:00Z")
  await setupSyncShows(page, [{
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

test("marks a watchlist movie as watched", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupSimklTrendingTv(page, [])
  await setupSimklTrendingMovies(page, [])
  await setupTmdb(page)
  await setupSyncActivities(page)
  await setupSyncShows(page, [])
  await setupSyncMovies(page, [{
    movie: { title: "The Matrix", year: 1999, runtime: 136, ids: { simkl_id: 53992 } },
    status: "plantowatch",
    added_to_watchlist_at: "2025-01-01T00:00:00Z",
  }])
  await setupSyncAnime(page, [])
  await setupMarkWatchedMovie(page, [{ ids: { simkl: 53992 } }])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with simkl/i }).click()
  const movieCard = page.getByRole("article", { name: "The Matrix" })
  await expect(movieCard).toBeVisible()
  await setupSyncActivities(page, "2025-02-01T00:00:00Z")
  await setupSyncMovies(page, [{
    movie: { title: "The Matrix", year: 1999, runtime: 136, ids: { simkl_id: 53992 } },
    status: "completed",
  }])

  await movieCard.getByRole("button", { name: /mark as watched/i }).click()

  const toast = page.getByRole("status")
  await expect(toast).toContainText(/marked.*matrix.*watched/i)
  await expect(toast.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://simkl.com/movies/53992/the-matrix")
  await expect(page.getByRole("article", { name: "The Matrix" })).toHaveCount(0)
})
