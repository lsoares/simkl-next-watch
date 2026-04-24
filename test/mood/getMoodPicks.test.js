import { test } from "../test.js"

test.describe("Simkl", () => {
  for (const name of ["gemini", "openai", "claude", "grok", "groq", "deepseek", "openrouter"]) {
    test(`shows poster recommendations with ${name}`, async ({ page, simkl, tmdb, ai, intro, mood, aiPicks }) => {
      await tmdb.usePosters(6)
      await simkl.useTvEpisodes("11121")
      await signInToSimkl(page, simkl, intro, {
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
      await ai[name].useChat(
        '[{"title":"Parasite","year":2019},{"title":"Oldboy","year":2003},{"title":"The Handmaiden","year":2016},{"title":"Inception","year":2010},{"title":"The Matrix","year":1999}]',
        ["Breaking Bad (2008):9", "Inception (2010):8", "The Matrix (1999):7"],
      )
      await simkl.useSearchTv("", [])
      await simkl.useSearchMovie("Parasite", [{ title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, type: "movie", ratings: { imdb: { rating: 8.5 } } }])
      await simkl.useSearchMovie("Oldboy", [{ title: "Oldboy", year: 2003, ids: { simkl_id: 33002 }, type: "movie", ratings: { imdb: { rating: 8.4 } } }])
      await simkl.useSearchMovie("Handmaiden", [{ title: "The Handmaiden", year: 2016, ids: { simkl_id: 33003 }, type: "movie", ratings: { imdb: { rating: 8.1 } } }])
      await simkl.useSearchMovie("Inception", [{ title: "Inception", year: 2010, ids: { simkl_id: 22222 }, type: "movie", ratings: { imdb: { rating: 8.8 } } }])
      await simkl.useSearchMovie("Matrix", [{ title: "The Matrix", year: 1999, ids: { simkl_id: 33333 }, type: "movie", ratings: { imdb: { rating: 8.7 } } }])
      await mood.open()
      await mood.pickMood("Make me laugh")
      await mood.setApiKey(name, "apiAiKey")
      await mood.expectKeySaved()

      await mood.pickMood("Make me laugh")

      await aiPicks.expectPosterIsVisible("Parasite")
      await aiPicks.expectPosterIsVisible("Oldboy")
      await aiPicks.expectPosterIsVisible("The Handmaiden")
      await aiPicks.expectPosterIsWatched("Inception")
      await aiPicks.expectPosterShowsRating("Inception", 8)
      await aiPicks.expectPosterShowsRating("The Matrix", 7)
      await aiPicks.expectPosterIsNotWatched("The Matrix")
    })
  }

  test("AI dialog posters link to the matched Simkl page", async ({ page, simkl, tmdb, ai, intro, mood, aiPicks }) => {
    await tmdb.usePosters(2)
    await simkl.useTvEpisodes("11121")
    await signInToSimkl(page, simkl, intro, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62,
      }],
    })
    await ai.gemini.useChat(
      '[{"title":"Parasite","year":2019}]',
      ["Breaking Bad (2008):9"],
    )
    await simkl.useSearchTv("", [])
    await simkl.useSearchMovie("Parasite", [{ title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, type: "movie" }])
    await mood.open()
    await mood.pickMood("Make me laugh")
    await mood.setApiKey("gemini", "apiAiKey")
    await mood.expectKeySaved()

    await mood.pickMood("Make me laugh")

    await aiPicks.expectPosterIsVisible("Parasite")
    await aiPicks.expectPosterLinksTo("Parasite", /simkl\.com\/movies\/33001/)
  })

  test("mood view shows the mood prompts on load", async ({ page, simkl, tmdb, intro, mood }) => {
    await tmdb.usePosters()
    await simkl.useTvEpisodes("11121")
    await signInToSimkl(page, simkl, intro, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62,
      }],
    })

    await mood.open()

    await mood.expectPromptIsVisible("Cozy night in")
    await mood.expectPromptIsVisible("Make me laugh")
    await mood.expectPromptIsVisible("Tear-jerker")
  })

  test("clicking a mood prompt without a key opens the key dialog", async ({ page, simkl, tmdb, intro, mood }) => {
    await tmdb.usePosters()
    await simkl.useTvEpisodes("11121")
    await signInToSimkl(page, simkl, intro, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62,
      }],
    })
    await mood.open()

    await mood.pickMood("Cozy night in")

    await mood.expectKeyDialogIsOpen()
  })
})

test.describe("Trakt", () => {
  test("sends Trakt user ratings to the AI alongside library titles", async ({ page, trakt, tmdb, ai, intro, mood, aiPicks }) => {
    await signInToTrakt(page, trakt, tmdb, intro, {
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
    await ai.gemini.useChat(
      '[{"title":"Parasite","year":2019}]',
      ["Breaking Bad (2008):9", "Inception (2010):8"],
    )
    await trakt.useSearchShow("", [])
    await trakt.useSearchMovie("Parasite", [{ type: "movie", movie: { title: "Parasite", year: 2019, released: "2019-05-30", ids: { trakt: 9999, slug: "parasite-2019", imdb: "tt6751668", tmdb: 496243 }, rating: 8.5 } }])
    await mood.open()
    await mood.pickMood("Make me laugh")
    await mood.setApiKey("gemini", "apiAiKey")
    await mood.expectKeySaved()

    await mood.pickMood("Make me laugh")

    await aiPicks.expectPosterIsVisible("Parasite")
  })

  test("AI results reflect Trakt watchlist and watched status", async ({ page, trakt, tmdb, ai, intro, mood, aiPicks }) => {
    await signInToTrakt(page, trakt, tmdb, intro, {
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
    await ai.gemini.useChat(
      '[{"title":"Inception","year":2010},{"title":"Parasite","year":2019}]',
      ["Breaking Bad (2008):9"],
    )
    await trakt.useSearchShow("", [])
    await trakt.useSearchMovie("Inception", [{ type: "movie", movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: 27205 }, rating: 8.8 } }])
    await trakt.useSearchMovie("Parasite", [{ type: "movie", movie: { title: "Parasite", year: 2019, released: "2019-05-30", ids: { trakt: 9999, slug: "parasite-2019", imdb: "tt6751668", tmdb: 496243 }, rating: 8.5 } }])
    await mood.open()
    await mood.pickMood("Make me laugh")
    await mood.setApiKey("gemini", "apiAiKey")
    await mood.expectKeySaved()

    await mood.pickMood("Make me laugh")

    await aiPicks.expectPosterIsWatchlisted("Inception")
    await aiPicks.expectPosterIsWatched("Parasite")
  })

  test("AI hits open Trakt pages on click for Trakt users", async ({ page, trakt, tmdb, ai, intro, mood, aiPicks }) => {
    await signInToTrakt(page, trakt, tmdb, intro, {
      watchedShows: [{
        last_watched_at: new Date().toISOString(),
        show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
        seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
      }],
      progressSlug: "breaking-bad",
      progressData: { next_episode: { season: 5, number: 1, title: "Live Free or Die" } },
      tmdbTimes: 4,
    })
    await ai.gemini.useChat(
      '[{"title":"Inception","year":2010}]',
      [],
    )
    await trakt.useSearchShow("", [])
    await trakt.useSearchMovie("Inception", [{ type: "movie", movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: 27205 }, rating: 8.8 } }])
    await mood.open()
    await mood.pickMood("Make me laugh")
    await mood.setApiKey("gemini", "apiAiKey")
    await mood.expectKeySaved()

    await mood.pickMood("Make me laugh")

    await aiPicks.expectPosterLinksTo("Inception", "https://app.trakt.tv/movies/inception-2010")
  })
})

async function signInToSimkl(page, simkl, intro, { shows = [], movies = [], anime = [] } = {}) {
  await simkl.useOauthToken()
  await simkl.useTrendingTv({})
  await simkl.useTrendingMovies({})
  await simkl.useSyncActivities()
  await simkl.useSyncShows(shows)
  await simkl.useSyncMovies(movies)
  await simkl.useSyncAnime(anime)
  await simkl.useAuthorize()
  await page.goto("/")
  await intro.signIn("simkl")
}

async function signInToTrakt(page, trakt, tmdb, intro, {
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
  await trakt.useOauthToken()
  await trakt.useLastActivities()
  await trakt.useWatchedShows(watchedShows)
  await trakt.useWatchedMovies(watchedMovies)
  await trakt.useWatchedShowsByPeriod({})
  await trakt.useWatchedMoviesByPeriod({})
  await tmdb.usePosters(tmdbTimes)
  await trakt.useWatchlistShows(watchlistShows)
  await trakt.useWatchlistMovies(watchlistMovies)
  await trakt.useDroppedShows(droppedShows)
  await trakt.useRatingsShows(ratingsShows)
  await trakt.useRatingsMovies(ratingsMovies)
  await trakt.useProgress(progressSlug, progressData)
  await trakt.useAuthorize()
  await page.goto("/")
  await intro.signIn("trakt")
}
