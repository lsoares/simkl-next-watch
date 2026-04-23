import { test, expect } from "../test.js"
import {
  setupAuthorize as setupSimklAuthorize,
  setupOauthToken as setupSimklOauthToken,
  setupSyncActivities,
  setupSyncShows,
  setupSyncMovies,
  setupSyncAnime,
  setupTvEpisodes,
  setupSearchTv,
  setupSearchMovie as setupSimklSearchMovie,
  setupSimklTrendingTv,
  setupSimklTrendingMovies,
} from "../_clients/simkl.js"
import {
  setupAuthorize as setupTraktAuthorize,
  setupOauthToken as setupTraktOauthToken,
  setupLastActivities,
  setupWatchedShows,
  setupWatchedMovies,
  setupWatchlistShows,
  setupWatchlistMovies,
  setupDroppedShows,
  setupRatingsShows,
  setupRatingsMovies,
  setupProgress,
  setupWatchedShowsByPeriod,
  setupWatchedMoviesByPeriod,
  setupSearchShow,
  setupSearchMovie as setupTraktSearchMovie,
} from "../_clients/trakt.js"
import { setupTmdb } from "../_clients/tmdb.js"
import { setupGeminiChat } from "../_clients/gemini.js"
import { setupOpenaiChat } from "../_clients/openai.js"
import { setupClaudeChat } from "../_clients/claude.js"
import { setupGrokChat } from "../_clients/grok.js"
import { setupGroqChat } from "../_clients/groq.js"
import { setupDeepseekChat } from "../_clients/deepseek.js"
import { setupOpenrouterChat } from "../_clients/openrouter.js"

test.describe("Simkl", () => {
  for (const { name, setupAiChat } of [
    { name: "gemini", setupAiChat: setupGeminiChat },
    { name: "openai", setupAiChat: setupOpenaiChat },
    { name: "claude", setupAiChat: setupClaudeChat },
    { name: "grok", setupAiChat: setupGrokChat },
    { name: "groq", setupAiChat: setupGroqChat },
    { name: "deepseek", setupAiChat: setupDeepseekChat },
    { name: "openrouter", setupAiChat: setupOpenrouterChat },
  ]) {
    test(`shows poster recommendations with ${name}`, async ({ page }) => {
      await setupTmdb(page, 5)
      await setupTvEpisodes(page, "11121")
      await signInToSimkl(page, {
        shows: [{
          show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
          status: "watching", user_rating: 9, next_to_watch: "S05E01",
          watched_episodes_count: 46, total_episodes_count: 62,
        }],
        movies: [
          {
            movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 } },
            status: "completed", user_rating: 8, last_watched_at: "2024-01-01T00:00:00Z",
          },
          {
            movie: { title: "The Matrix", year: 1999, ids: { simkl_id: 33333 } },
            status: "completed",
          },
        ],
      })
      await setupAiChat(page,
        '[{"title":"Parasite","year":2019},{"title":"Oldboy","year":2003},{"title":"The Handmaiden","year":2016},{"title":"Inception","year":2010}]',
        "apiAiKey",
        ["Breaking Bad (2008):9", "Inception (2010):8", "The Matrix (1999)"],
      )
      await setupSearchTv(page, "", [])
      await setupSimklSearchMovie(page, "Parasite", [{ title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, type: "movie", ratings: { imdb: { rating: 8.5 } } }])
      await setupSimklSearchMovie(page, "Oldboy", [{ title: "Oldboy", year: 2003, ids: { simkl_id: 33002 }, type: "movie", ratings: { imdb: { rating: 8.4 } } }])
      await setupSimklSearchMovie(page, "Handmaiden", [{ title: "The Handmaiden", year: 2016, ids: { simkl_id: 33003 }, type: "movie", ratings: { imdb: { rating: 8.1 } } }])
      await setupSimklSearchMovie(page, "Inception", [{ title: "Inception", year: 2010, ids: { simkl_id: 22222 }, type: "movie", ratings: { imdb: { rating: 8.8 } } }])
      await page.getByRole("link", { name: /mood/i }).click()
      await page.getByRole("button", { name: /make me laugh/i }).click()
      await page.getByRole("combobox", { name: /provider/i }).selectOption(name)
      await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
      await page.getByRole("button", { name: /save.*key/i }).click()
      await expect(page.getByRole("status")).toContainText(/key saved/i)

      await page.getByRole("button", { name: /make me laugh/i }).click()

      const aiResults = page.getByRole("dialog", { name: /ai picks/i })
      await expect(aiResults.getByRole("article", { name: "Parasite" })).toBeVisible()
      await expect(aiResults.getByRole("article", { name: "Oldboy" })).toBeVisible()
      await expect(aiResults.getByRole("article", { name: "The Handmaiden" })).toBeVisible()
      await expect(aiResults.getByRole("article", { name: "Inception" })).toHaveClass(/trending-watched/)
      await expect(aiResults.getByRole("article", { name: "Inception" }).getByLabel(/rated 8 out of 10/i)).toBeVisible()
      await expect(aiResults.getByRole("article", { name: "Inception" }).getByLabel(/^watched /i)).toBeVisible()
    })
  }

  test("AI results show the user rating on rated items even when not watched", async ({ page }) => {
    await setupTmdb(page, 2)
    await setupTvEpisodes(page, "11121")
    await signInToSimkl(page, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62,
      }],
      movies: [{
        movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 } },
        status: "plantowatch", user_rating: 7,
      }],
    })
    await setupGeminiChat(page,
      '[{"title":"Inception","year":2010}]',
      "apiAiKey",
      ["Breaking Bad (2008):9", "Inception (2010):7"],
    )
    await setupSearchTv(page, "", [])
    await setupSimklSearchMovie(page, "Inception", [{ title: "Inception", year: 2010, ids: { simkl_id: 22222 }, type: "movie", ratings: { imdb: { rating: 8.8 } } }])
    await page.getByRole("link", { name: /mood/i }).click()
    await page.getByRole("button", { name: /make me laugh/i }).click()
    await page.getByRole("combobox", { name: /provider/i }).selectOption("gemini")
    await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
    await page.getByRole("button", { name: /save.*key/i }).click()
    await expect(page.getByRole("status")).toContainText(/key saved/i)

    await page.getByRole("button", { name: /make me laugh/i }).click()

    await expect(page.getByRole("dialog", { name: /ai picks/i }).getByRole("article", { name: "Inception" }).getByLabel(/rated 7 out of 10/i)).toBeVisible()
  })

  test("AI dialog posters link to the matched Simkl page", async ({ page }) => {
    await setupTmdb(page, 2)
    await setupTvEpisodes(page, "11121")
    await signInToSimkl(page, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62,
      }],
    })
    await setupGeminiChat(page,
      '[{"title":"Parasite","year":2019}]',
      "apiAiKey",
      ["Breaking Bad (2008):9"],
    )
    await setupSearchTv(page, "", [])
    await setupSimklSearchMovie(page, "Parasite", [{ title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, type: "movie" }])
    await page.getByRole("link", { name: /mood/i }).click()
    await page.getByRole("button", { name: /make me laugh/i }).click()
    await page.getByRole("combobox", { name: /provider/i }).selectOption("gemini")
    await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
    await page.getByRole("button", { name: /save.*key/i }).click()
    await expect(page.getByRole("status")).toContainText(/key saved/i)

    await page.getByRole("button", { name: /make me laugh/i }).click()

    const dialog = page.getByRole("dialog", { name: /ai picks/i })
    await expect(dialog.getByRole("article", { name: "Parasite" })).toBeVisible()
    await expect(dialog.getByRole("link", { name: "Parasite" })).toHaveAttribute("href", /simkl\.com\/movies\/33001/)
  })
})

test.describe("Trakt", () => {
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
      progressSlug: "breaking-bad",
      progressData: { next_episode: { season: 5, number: 1, title: "Live Free or Die" } },
      tmdbTimes: 5,
    })
    await setupGeminiChat(page,
      '[{"title":"Parasite","year":2019}]',
      "apiAiKey",
      ["Breaking Bad (2008):9", "Inception (2010):8"],
    )
    await setupSearchShow(page, "", [])
    await setupTraktSearchMovie(page, "Parasite", [{ type: "movie", movie: { title: "Parasite", year: 2019, released: "2019-05-30", ids: { trakt: 9999, slug: "parasite-2019", imdb: "tt6751668", tmdb: 496243 }, rating: 8.5 } }])
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
      progressSlug: "breaking-bad",
      progressData: { next_episode: { season: 5, number: 1, title: "Live Free or Die" } },
      tmdbTimes: 7,
    })
    await setupGeminiChat(page,
      '[{"title":"Inception","year":2010},{"title":"Parasite","year":2019}]',
      "apiAiKey",
      ["Breaking Bad (2008):9"],
    )
    await setupSearchShow(page, "", [])
    await setupTraktSearchMovie(page, "Inception", [{ type: "movie", movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: 27205 }, rating: 8.8 } }])
    await setupTraktSearchMovie(page, "Parasite", [{ type: "movie", movie: { title: "Parasite", year: 2019, released: "2019-05-30", ids: { trakt: 9999, slug: "parasite-2019", imdb: "tt6751668", tmdb: 496243 }, rating: 8.5 } }])
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
      progressSlug: "breaking-bad",
      progressData: { next_episode: { season: 5, number: 1, title: "Live Free or Die" } },
      tmdbTimes: 4,
    })
    await setupGeminiChat(page,
      '[{"title":"Inception","year":2010}]',
      "apiAiKey",
      [],
    )
    await setupSearchShow(page, "", [])
    await setupTraktSearchMovie(page, "Inception", [{ type: "movie", movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: 27205 }, rating: 8.8 } }])
    await page.getByRole("link", { name: /mood/i }).click()
    await page.getByRole("button", { name: /make me laugh/i }).click()
    await page.getByRole("combobox", { name: /provider/i }).selectOption("gemini")
    await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
    await page.getByRole("button", { name: /save.*key/i }).click()
    await expect(page.getByRole("status")).toContainText(/key saved/i)

    await page.getByRole("button", { name: /make me laugh/i }).click()

    await expect(page.getByRole("dialog", { name: /ai picks/i }).getByRole("link", { name: "Inception" })).toHaveAttribute("href", "https://app.trakt.tv/movies/inception-2010")
  })
})

async function signInToSimkl(page, { shows = [], movies = [], anime = [] } = {}) {
  await setupSimklOauthToken(page, "test-token")
  await setupSimklTrendingTv(page, [])
  await setupSimklTrendingMovies(page, [])
  await setupSyncActivities(page)
  await setupSyncShows(page, shows)
  await setupSyncMovies(page, movies)
  await setupSyncAnime(page, anime)
  await setupSimklAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with simkl/i }).click()
  await expect(page.getByRole("article", { name: shows[0].show.title })).toBeVisible()
}

async function signInToTrakt(page, {
  watchedShows = [],
  watchedMovies = [],
  watchlistShows = [],
  watchlistMovies = [],
  droppedShows = [],
  ratingsShows = [],
  ratingsMovies = [],
  progressSlug,
  progressData,
  tmdbTimes,
} = {}) {
  await setupTraktOauthToken(page, "test-token")
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
  await setupProgress(page, progressSlug, progressData)
  await setupTraktAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with trakt/i }).click()
  await expect(page.getByRole("article", { name: watchedShows[0].show.title })).toBeVisible()
}
