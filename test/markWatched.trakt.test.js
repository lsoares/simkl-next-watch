import { test, expect } from "./test.js"
import { setupAuthorize, setupLastActivities, setupOauthToken, setupWatchlistShows, setupWatchlistMovies, setupWatchedShows, setupDroppedShows, setupProgress, setupSearchById, setupMarkWatchedMovie, setupMarkWatchedShow } from "./clients/trakt.js"

test.skip("marks the next episode of a watching TV show", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupLastActivities(page)
  await setupWatchlistShows(page, [])
  await setupWatchlistMovies(page, [])
  await setupDroppedShows(page, [])
  await setupWatchedShows(page, [{
    last_watched_at: new Date().toISOString(),
    show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
  }])
  await setupProgress(page, "breaking-bad", { next_episode: { season: 5, number: 1, title: "Live Free or Die" } })
  await setupSearchById(page, "tt0903747", { ids: { simkl: 11121 }, poster: "97/978343d5161a724", title: "Breaking Bad", year: 2008, total_episodes: 62 })
  await setupMarkWatchedShow(page, [{ ids: { trakt: 1388, imdb: "tt0903747", slug: "breaking-bad" }, seasons: [{ number: 5, episodes: [{ number: 1 }] }] }])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()
  const showCard = page.getByRole("article", { name: "Breaking Bad" })
  await expect(showCard).toBeVisible()
  await setupWatchedShows(page, [{
    last_watched_at: new Date().toISOString(),
    show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    seasons: [
      { number: 4, episodes: [{ number: 13, plays: 1 }] },
      { number: 5, episodes: [{ number: 1, plays: 1 }] },
    ],
  }])
  await setupProgress(page, "breaking-bad", { next_episode: { season: 5, number: 2, title: "Madrigal" } })

  await showCard.getByRole("button", { name: /mark as watched/i }).click()

  const toast = page.getByRole("status")
  await expect(toast).toContainText(/marked.*breaking bad.*5x1.*watched.*rate it/i)
  await expect(toast.getByRole("link", { name: "Breaking Bad 5x1" })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/1")
  await expect(showCard.getByRole("link", { name: /5x2/ })).toHaveAttribute("href", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/2")
})

test("marks a watchlist movie as watched", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupLastActivities(page)
  await setupWatchlistShows(page, [])
  await setupWatchedShows(page, [])
  await setupDroppedShows(page, [])
  await setupWatchlistMovies(page, [{
    listed_at: "2025-01-01T00:00:00Z",
    movie: { title: "The Matrix", year: 1999, released: "1999-03-31", ids: { trakt: 481, slug: "the-matrix-1999", imdb: "tt0133093" } },
  }])
  await setupMarkWatchedMovie(page, [{ ids: { trakt: 481, imdb: "tt0133093", slug: "the-matrix-1999" } }])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()
  const movieCard = page.getByRole("article", { name: "The Matrix" })
  await expect(movieCard).toBeVisible()
  await setupWatchlistMovies(page, [])

  await movieCard.getByRole("button", { name: /mark as watched/i }).click()

  const toast = page.getByRole("status")
  await expect(toast).toContainText(/marked.*matrix.*watched.*rate it/i)
  await expect(toast.getByRole("link", { name: "The Matrix" })).toHaveAttribute("href", "https://app.trakt.tv/movies/the-matrix-1999")
  await expect(page.getByRole("article", { name: "The Matrix" })).toHaveCount(0)
})
