import { test, expect } from "../test.js"

test.describe("Simkl", () => {
  for (const name of ["gemini", "openai", "claude", "grok", "groq", "deepseek", "openrouter"]) {
    test(`shows poster recommendations with ${name}`, async ({ page, simkl, tmdb, ai }) => {
      await tmdb.posters(6)
      await simkl.tvEpisodes("11121")
      await signInToSimkl(page, simkl, {
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
            status: "plantowatch", user_rating: 7,
          },
        ],
      })
      await ai[name].chat(
        '[{"title":"Parasite","year":2019},{"title":"Oldboy","year":2003},{"title":"The Handmaiden","year":2016},{"title":"Inception","year":2010},{"title":"The Matrix","year":1999}]',
        "apiAiKey",
        ["Breaking Bad (2008):9", "Inception (2010):8", "The Matrix (1999):7"],
      )
      await simkl.searchTv("", [])
      await simkl.searchMovie("Parasite", [{ title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, type: "movie", ratings: { imdb: { rating: 8.5 } } }])
      await simkl.searchMovie("Oldboy", [{ title: "Oldboy", year: 2003, ids: { simkl_id: 33002 }, type: "movie", ratings: { imdb: { rating: 8.4 } } }])
      await simkl.searchMovie("Handmaiden", [{ title: "The Handmaiden", year: 2016, ids: { simkl_id: 33003 }, type: "movie", ratings: { imdb: { rating: 8.1 } } }])
      await simkl.searchMovie("Inception", [{ title: "Inception", year: 2010, ids: { simkl_id: 22222 }, type: "movie", ratings: { imdb: { rating: 8.8 } } }])
      await simkl.searchMovie("Matrix", [{ title: "The Matrix", year: 1999, ids: { simkl_id: 33333 }, type: "movie", ratings: { imdb: { rating: 8.7 } } }])
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
      await expect(aiResults.getByRole("article", { name: "The Matrix" }).getByLabel(/rated 7 out of 10/i)).toBeVisible()
      await expect(aiResults.getByRole("article", { name: "The Matrix" }).getByLabel(/^watched /i)).toHaveCount(0)
    })
  }

  test("AI dialog posters link to the matched Simkl page", async ({ page, simkl, tmdb, ai }) => {
    await tmdb.posters(2)
    await simkl.tvEpisodes("11121")
    await signInToSimkl(page, simkl, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62,
      }],
    })
    await ai.gemini.chat(
      '[{"title":"Parasite","year":2019}]',
      "apiAiKey",
      ["Breaking Bad (2008):9"],
    )
    await simkl.searchTv("", [])
    await simkl.searchMovie("Parasite", [{ title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, type: "movie" }])
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

  test("mood view shows the mood prompts on load", async ({ page, simkl, tmdb }) => {
    await tmdb.posters()
    await simkl.tvEpisodes("11121")
    await signInToSimkl(page, simkl, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62,
      }],
    })

    await page.getByRole("link", { name: /mood/i }).click()

    await expect(page.getByRole("button", { name: "Cozy night in" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Make me laugh" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Tear-jerker" })).toBeVisible()
  })

  test("clicking a mood prompt without a key opens the key dialog", async ({ page, simkl, tmdb }) => {
    await tmdb.posters()
    await simkl.tvEpisodes("11121")
    await signInToSimkl(page, simkl, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62,
      }],
    })
    await page.getByRole("link", { name: /mood/i }).click()

    await page.getByRole("button", { name: /cozy night in/i }).click()

    await expect(page.getByRole("dialog", { name: /ai key/i })).toBeVisible()
  })
})

test.describe("Trakt", () => {
  test("sends Trakt user ratings to the AI alongside library titles", async ({ page, trakt, tmdb, ai }) => {
    await signInToTrakt(page, trakt, tmdb, {
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
    await ai.gemini.chat(
      '[{"title":"Parasite","year":2019}]',
      "apiAiKey",
      ["Breaking Bad (2008):9", "Inception (2010):8"],
    )
    await trakt.searchShow("", [])
    await trakt.searchMovie("Parasite", [{ type: "movie", movie: { title: "Parasite", year: 2019, released: "2019-05-30", ids: { trakt: 9999, slug: "parasite-2019", imdb: "tt6751668", tmdb: 496243 }, rating: 8.5 } }])
    await page.getByRole("link", { name: /mood/i }).click()
    await page.getByRole("button", { name: /make me laugh/i }).click()
    await page.getByRole("combobox", { name: /provider/i }).selectOption("gemini")
    await page.getByRole("textbox", { name: /api key/i }).fill("apiAiKey")
    await page.getByRole("button", { name: /save.*key/i }).click()
    await expect(page.getByRole("status")).toContainText(/key saved/i)

    await page.getByRole("button", { name: /make me laugh/i }).click()

    await expect(page.getByRole("dialog", { name: /ai picks/i }).getByRole("article", { name: "Parasite" })).toBeVisible()
  })

  test("AI results reflect Trakt watchlist and watched status", async ({ page, trakt, tmdb, ai }) => {
    await signInToTrakt(page, trakt, tmdb, {
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
    await ai.gemini.chat(
      '[{"title":"Inception","year":2010},{"title":"Parasite","year":2019}]',
      "apiAiKey",
      ["Breaking Bad (2008):9"],
    )
    await trakt.searchShow("", [])
    await trakt.searchMovie("Inception", [{ type: "movie", movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: 27205 }, rating: 8.8 } }])
    await trakt.searchMovie("Parasite", [{ type: "movie", movie: { title: "Parasite", year: 2019, released: "2019-05-30", ids: { trakt: 9999, slug: "parasite-2019", imdb: "tt6751668", tmdb: 496243 }, rating: 8.5 } }])
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

  test("AI hits open Trakt pages on click for Trakt users", async ({ page, trakt, tmdb, ai }) => {
    await signInToTrakt(page, trakt, tmdb, {
      watchedShows: [{
        last_watched_at: new Date().toISOString(),
        show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
        seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
      }],
      progressSlug: "breaking-bad",
      progressData: { next_episode: { season: 5, number: 1, title: "Live Free or Die" } },
      tmdbTimes: 4,
    })
    await ai.gemini.chat(
      '[{"title":"Inception","year":2010}]',
      "apiAiKey",
      [],
    )
    await trakt.searchShow("", [])
    await trakt.searchMovie("Inception", [{ type: "movie", movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: 27205 }, rating: 8.8 } }])
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

async function signInToSimkl(page, simkl, { shows = [], movies = [], anime = [] } = {}) {
  await simkl.oauthToken()
  await simkl.trendingTv({})
  await simkl.trendingMovies({})
  await simkl.syncActivities()
  await simkl.syncShows(shows)
  await simkl.syncMovies(movies)
  await simkl.syncAnime(anime)
  await simkl.authorize()
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with simkl/i }).click()
  await expect(page.getByRole("article", { name: shows[0].show.title })).toBeVisible()
}

async function signInToTrakt(page, trakt, tmdb, {
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
  await trakt.oauthToken()
  await trakt.lastActivities()
  await trakt.watchedShows(watchedShows)
  await trakt.watchedMovies(watchedMovies)
  await trakt.watchedShowsByPeriod({})
  await trakt.watchedMoviesByPeriod({})
  await tmdb.posters(tmdbTimes)
  await trakt.watchlistShows(watchlistShows)
  await trakt.watchlistMovies(watchlistMovies)
  await trakt.droppedShows(droppedShows)
  await trakt.ratingsShows(ratingsShows)
  await trakt.ratingsMovies(ratingsMovies)
  await trakt.progress(progressSlug, progressData)
  await trakt.authorize()
  await page.goto("/")
  await page.getByRole("button", { name: /sign in with trakt/i }).click()
  await expect(page.getByRole("article", { name: watchedShows[0].show.title })).toBeVisible()
}
