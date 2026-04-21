import { test, expect } from "./test.js"
import { setupTrendingTv, setupTrendingMovies } from "./clients/simkl.js"
import {
  setupAuthorize,
  setupOauthToken,
  setupLastActivities,
  setupWatchedShows,
  setupWatchlistShows,
  setupWatchlistMovies,
  setupDroppedShows,
  setupRatingsShows,
  setupRatingsMovies,
  setupWatchedShowsByPeriod,
  setupWatchedMoviesByPeriod,
} from "./clients/trakt.js"

test("trending rows list shows and movies from the watched-period feed", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupLastActivities(page)
  await setupWatchedShows(page, [])
  await setupWatchlistShows(page, [])
  await setupWatchlistMovies(page, [])
  await setupDroppedShows(page, [])
  await setupRatingsShows(page, [])
  await setupRatingsMovies(page, [])
  await setupTrendingTv(page, {})
  await setupTrendingMovies(page, {})
  await setupWatchedShowsByPeriod(page, {
    daily: [
      { watcher_count: 5000, show: { title: "Severance", year: 2022, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } } },
      { watcher_count: 3200, show: { title: "The Rookie", year: 2018, ids: { trakt: 99001, slug: "the-rookie", imdb: "tt7587890" } } },
    ],
  })
  await setupWatchedMoviesByPeriod(page, {
    daily: [
      { watcher_count: 8000, movie: { title: "Dune", year: 2021, ids: { trakt: 9999, slug: "dune-2021", imdb: "tt1160419" } } },
    ],
  })
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()

  await page.getByRole("link", { name: /trending/i }).click()

  await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Dune" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Severance" }).getByRole("link", { name: "Severance" })).toHaveAttribute("href", "https://app.trakt.tv/shows/severance")
  await expect(page.getByRole("article", { name: "Dune" }).getByRole("link", { name: "Dune" })).toHaveAttribute("href", "https://app.trakt.tv/movies/dune-2021")
  await expect(page.getByRole("link", { name: "More on Trakt" }).first()).toHaveAttribute("href", "https://app.trakt.tv/discover/trending?mode=show&ignore_watched=false")
})

test("hide-listed toggle removes library items from the trending row", async ({ page }) => {
  await setupOauthToken(page, "test-token")
  await setupLastActivities(page)
  await setupWatchedShows(page, [{
    last_watched_at: "2024-10-01T00:00:00Z",
    show: { title: "Severance", year: 2022, aired_episodes: 9, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
    seasons: [{ number: 1, episodes: Array.from({ length: 9 }, (_, i) => ({ number: i + 1, plays: 1 })) }],
  }])
  await setupWatchlistShows(page, [{
    listed_at: "2025-01-01T00:00:00Z",
    show: { title: "Breaking Bad", year: 2008, first_aired: "2008-01-20", aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
  }])
  await setupWatchlistMovies(page, [])
  await setupDroppedShows(page, [])
  await setupRatingsShows(page, [])
  await setupRatingsMovies(page, [])
  await setupTrendingTv(page, {})
  await setupTrendingMovies(page, {})
  await setupWatchedShowsByPeriod(page, {
    daily: [
      { watcher_count: 5000, show: { title: "Breaking Bad", year: 2008, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } } },
      { watcher_count: 4000, show: { title: "Severance", year: 2022, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } } },
      { watcher_count: 3000, show: { title: "The Rookie", year: 2018, ids: { trakt: 99001, slug: "the-rookie", imdb: "tt7587890" } } },
    ],
  })
  await setupWatchedMoviesByPeriod(page, {})
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(trakt\)/i }).click()
  await page.getByRole("link", { name: /trending/i }).click()
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Severance" })).toBeVisible()
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()

  await page.getByRole("checkbox", { name: /hide listed/i }).check()

  await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "Severance" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "The Rookie" })).toBeVisible()
})
