import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupLastActivities, setupWatchedShows, setupWatchedMovies, setupWatchlistShows, setupWatchlistMovies, setupDroppedShows, setupRatingsShows, setupRatingsMovies, setupProgress, setupWatchedShowsByPeriod, setupWatchedMoviesByPeriod, setupSearchShow, setupSearchMovie } from "./clients/trakt.js"
import { setupTmdb } from "./clients/tmdb.js"
import { setupGeminiChat } from "./clients/gemini.js"

test("sends Trakt user ratings to the AI alongside library titles", async ({ page }) => {
  await signInToTrakt(page, {
    watchedShows: [{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }],
    watchlistMovies: [{
      listed_at: "2025-01-01T00:00:00Z",
      movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666" } },
    }],
    ratingsShows: [{
      rated_at: "2024-09-12T10:57:24.000Z",
      rating: 9,
      type: "show",
      show: { title: "Breaking Bad", year: 2008, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    }],
    ratingsMovies: [{
      rated_at: "2024-09-12T10:57:24.000Z",
      rating: 8,
      type: "movie",
      movie: { title: "Inception", year: 2010, ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666" } },
    }],
    progressByShow: { "breaking-bad": { next_episode: { season: 5, number: 1, title: "Live Free or Die" } } },
    tmdbTimes: 5,
  })
  await setupGeminiChat(page,
    '[{"title":"Parasite","year":2019}]',
    "apiAiKey",
    ["Breaking Bad (2008):9", "Inception (2010):8"],
  )
  await setupSearchShow(page, "", [])
  await setupSearchMovie(page, "Parasite", [{ type: "movie", movie: { title: "Parasite", year: 2019, released: "2019-05-30", ids: { trakt: 9999, slug: "parasite-2019", imdb: "tt6751668", tmdb: 496243 }, rating: 8.5 } }])
  await page.getByRole("link", { name: /mood/i }).click()
  await page.getByRole("button", { name: /make me laugh/i }).click()
  await page.getByRole("combobox", { name: /provider/i }).selectOption("gemini")
  await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
  await page.getByRole("button", { name: /save.*key/i }).click()
  await expect(page.getByRole("status")).toContainText(/key saved/i)

  await page.getByRole("button", { name: /make me laugh/i }).click()

  await expect(page.getByRole("dialog", { name: /ai picks/i }).getByRole("article", { name: "Parasite" })).toBeVisible()
})

test("AI results reflect Trakt watchlist and watched status", async ({ page }) => {
  await signInToTrakt(page, {
    watchedShows: [{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }],
    watchedMovies: [{
      plays: 1,
      last_watched_at: "2024-05-10T20:00:00.000Z",
      movie: { title: "Parasite", year: 2019, ids: { trakt: 9999, slug: "parasite-2019", imdb: "tt6751668", tmdb: 496243 } },
    }],
    watchlistMovies: [{
      listed_at: "2025-01-01T00:00:00Z",
      movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: 27205 } },
    }],
    ratingsShows: [{
      rated_at: "2024-09-12T10:57:24.000Z",
      rating: 9,
      type: "show",
      show: { title: "Breaking Bad", year: 2008, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
    }],
    progressByShow: { "breaking-bad": { next_episode: { season: 5, number: 1, title: "Live Free or Die" } } },
    tmdbTimes: 7,
  })
  await setupGeminiChat(page,
    '[{"title":"Inception","year":2010},{"title":"Parasite","year":2019}]',
    "apiAiKey",
    ["Breaking Bad (2008):9"],
  )
  await setupSearchShow(page, "", [])
  await setupSearchMovie(page, "Inception", [{ type: "movie", movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: 27205 }, rating: 8.8 } }])
  await setupSearchMovie(page, "Parasite", [{ type: "movie", movie: { title: "Parasite", year: 2019, released: "2019-05-30", ids: { trakt: 9999, slug: "parasite-2019", imdb: "tt6751668", tmdb: 496243 }, rating: 8.5 } }])
  await page.getByRole("link", { name: /mood/i }).click()
  await page.getByRole("button", { name: /make me laugh/i }).click()
  await page.getByRole("combobox", { name: /provider/i }).selectOption("gemini")
  await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
  await page.getByRole("button", { name: /save.*key/i }).click()
  await expect(page.getByRole("status")).toContainText(/key saved/i)

  await page.getByRole("button", { name: /make me laugh/i }).click()

  await expect(page.getByRole("dialog", { name: /ai picks/i }).getByRole("article", { name: "Inception" })).toHaveClass(/trending-watchlisted/)
  await expect(page.getByRole("dialog", { name: /ai picks/i }).getByRole("article", { name: "Parasite" })).toHaveClass(/trending-watched/)
})

test("AI hits open Trakt pages on click for Trakt users", async ({ page }) => {
  await signInToTrakt(page, {
    watchedShows: [{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }],
    progressByShow: { "breaking-bad": { next_episode: { season: 5, number: 1, title: "Live Free or Die" } } },
    tmdbTimes: 4,
  })
  await setupGeminiChat(page,
    '[{"title":"Inception","year":2010}]',
    "apiAiKey",
    [],
  )
  await setupSearchShow(page, "", [])
  await setupSearchMovie(page, "Inception", [{ type: "movie", movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: 27205 }, rating: 8.8 } }])
  await page.getByRole("link", { name: /mood/i }).click()
  await page.getByRole("button", { name: /make me laugh/i }).click()
  await page.getByRole("combobox", { name: /provider/i }).selectOption("gemini")
  await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
  await page.getByRole("button", { name: /save.*key/i }).click()
  await expect(page.getByRole("status")).toContainText(/key saved/i)

  await page.getByRole("button", { name: /make me laugh/i }).click()

  await expect(page.getByRole("dialog", { name: /ai picks/i }).getByRole("link", { name: "Inception" })).toHaveAttribute("href", "https://app.trakt.tv/movies/inception-2010")
})

async function signInToTrakt(page, {
  watchedShows = [],
  watchedMovies = [],
  watchlistShows = [],
  watchlistMovies = [],
  droppedShows = [],
  ratingsShows = [],
  ratingsMovies = [],
  progressByShow = {},
  tmdbTimes,
} = {}) {
  await setupOauthToken(page, "test-token")
  await setupLastActivities(page)
  await setupWatchedShows(page, watchedShows)
  await setupWatchedMovies(page, watchedMovies)
  await setupWatchedShowsByPeriod(page, {})
  await setupWatchedMoviesByPeriod(page, {})
  await setupTmdb(page, tmdbTimes)
  await setupWatchlistShows(page, watchlistShows)
  await setupWatchlistMovies(page, watchlistMovies)
  await setupDroppedShows(page, droppedShows)
  await setupRatingsShows(page, ratingsShows)
  await setupRatingsMovies(page, ratingsMovies)
  for (const [slug, data] of Object.entries(progressByShow)) await setupProgress(page, slug, data)
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with trakt/i }).click()
  await expect(page.getByRole("article", { name: watchedShows[0].show.title })).toBeVisible()
}
