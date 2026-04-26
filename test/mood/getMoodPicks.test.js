import { test } from "../test.js"

test.describe("Simkl", () => {
  for (const name of ["gemini", "openai", "claude", "grok", "groq", "deepseek", "openrouter"]) {
    test(`shows poster recommendations with ${name}`, async ({ page, simkl, tmdb, ai, intro, mood, aiPicks }) => {
      await tmdb.useDetails("tv", "1396")
      await tmdb.useDetails("movie", "27205")
      await tmdb.useDetails("movie", "603")
      await tmdb.useDetails("movie", "496243")
      await tmdb.useDetails("movie", "670")
      await tmdb.useDetails("movie", "290098")
      await simkl.useTvEpisodes("11121")
      await signInToSimkl(page, simkl, intro, {
        shows: [{
          show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
          status: "watching", user_rating: 9, next_to_watch: "S05E01",
          watched_episodes_count: 46, total_episodes_count: 62,
        }],
        movies: [
          {
            movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222, tmdb: "27205" } },
            status: "completed", user_rating: 8, last_watched_at: "2024-01-01T00:00:00Z",
          },
          {
            movie: { title: "The Matrix", year: 1999, ids: { simkl_id: 33333, tmdb: "603" } },
            status: "plantowatch", user_rating: 7,
          },
        ],
      })
      await ai[name].useChat(
        '[{"title":"Parasite","year":2019},{"title":"Oldboy","year":2003},{"title":"The Handmaiden","year":2016},{"title":"Inception","year":2010},{"title":"The Matrix","year":1999}]',
        ["Breaking Bad (2008):9", "Inception (2010):8", "The Matrix (1999):7"],
      )
      await simkl.useSearchMovie("Parasite", [{ title: "Parasite", year: 2019, ids: { simkl_id: 33001, tmdb: "496243" }, type: "movie", ratings: { imdb: { rating: 8.5 } } }])
      await simkl.useSearchMovie("Oldboy", [{ title: "Oldboy", year: 2003, ids: { simkl_id: 33002, tmdb: "670" }, type: "movie", ratings: { imdb: { rating: 8.4 } } }])
      await simkl.useSearchMovie("Handmaiden", [{ title: "The Handmaiden", year: 2016, ids: { simkl_id: 33003, tmdb: "290098" }, type: "movie", ratings: { imdb: { rating: 8.1 } } }])
      await simkl.useSearchMovie("Inception", [{ title: "Inception", year: 2010, ids: { simkl_id: 22222, tmdb: "27205" }, type: "movie", ratings: { imdb: { rating: 8.8 } } }])
      await simkl.useSearchMovie("Matrix", [{ title: "The Matrix", year: 1999, ids: { simkl_id: 33333, tmdb: "603" }, type: "movie", ratings: { imdb: { rating: 8.7 } } }])
      await mood.open()
      await mood.pickMood("Make me laugh")

      await mood.setApiKey(name, "apiAiKey")

      await aiPicks.expectPosterIsVisible("Parasite")
      await aiPicks.expectPosterIsVisible("Oldboy")
      await aiPicks.expectPosterIsVisible("The Handmaiden")
      await aiPicks.expectPosterIsWatched("Inception")
      await aiPicks.expectPosterShowsRating("Inception", 8)
      await aiPicks.expectPosterShowsRating("The Matrix", 7)
      await aiPicks.expectPosterIsNotWatched("The Matrix")
    })
  }

  test("AI dialog posters link to the matched Simkl page, or to Simkl search when unmatched", async ({ page, simkl, tmdb, ai, intro, mood, aiPicks }) => {
    await tmdb.useDetails("tv", "1396")
    await tmdb.useDetails("movie", "496243")
    await tmdb.useSearch("movie", "UnknownFilm")
    await simkl.useTvEpisodes("11121")
    await signInToSimkl(page, simkl, intro, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62,
      }],
    })
    await ai.gemini.useChat(
      '[{"title":"Parasite","year":2019},{"title":"UnknownFilm","year":2020}]',
      ["Breaking Bad (2008):9"],
    )
    await simkl.useSearchTv("", [])
    await simkl.useSearchMovie("Parasite", [{ title: "Parasite", year: 2019, ids: { simkl_id: 33001, tmdb: "496243" }, type: "movie" }])
    await simkl.useSearchMovie("UnknownFilm", [])
    await mood.open()
    await mood.pickMood("Make me laugh")

    await mood.setApiKey("gemini", "apiAiKey")

    await aiPicks.expectPosterLinksTo("Parasite", /simkl\.com\/movies\/33001/)
    await aiPicks.expectPosterLinksTo("UnknownFilm", "https://simkl.com/search/?q=UnknownFilm")
  })

  test("mood view shows the mood prompts on load", async ({ page, simkl, tmdb, intro, mood }) => {
    await tmdb.useDetails("tv", "1396")
    await simkl.useTvEpisodes("11121")
    await signInToSimkl(page, simkl, intro, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
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
    await tmdb.useDetails("tv", "1396")
    await simkl.useTvEpisodes("11121")
    await signInToSimkl(page, simkl, intro, {
      shows: [{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
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
  test("AI Picks sends Trakt ratings in the prompt and reflects library status on posters", async ({ page, trakt, tmdb, ai, intro, mood, aiPicks }) => {
    await tmdb.useDetails("movie", "27205")
    await tmdb.useDetails("movie", "496243")
    await signInToTrakt(page, trakt, intro, {
      watchedShows: [{
        last_watched_at: new Date().toISOString(),
        show: { title: "Breaking Bad", year: 2008, aired_episodes: 1, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747", tmdb: "1396" } },
        seasons: [{ number: 1, episodes: [{ number: 1, plays: 1 }] }],
      }],
      watchedMovies: [{
        plays: 1,
        last_watched_at: "2024-05-10T20:00:00.000Z",
        movie: { title: "Parasite", year: 2019, ids: { trakt: 9999, slug: "parasite-2019", imdb: "tt6751668", tmdb: "496243" } },
      }],
      watchlistMovies: [{
        listed_at: "2025-01-01T00:00:00Z",
        movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: "27205" } },
      }],
      ratingsShows: [{
        rated_at: "2024-09-12T10:57:24.000Z",
        rating: 9,
        type: "show",
        show: { title: "Breaking Bad", year: 2008, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747", tmdb: "1396" } },
      }],
      ratingsMovies: [{
        rated_at: "2024-09-12T10:57:24.000Z",
        rating: 8,
        type: "movie",
        movie: { title: "Inception", year: 2010, ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: "27205" } },
      }],
    })
    await ai.gemini.useChat(
      '[{"title":"Inception","year":2010},{"title":"Parasite","year":2019}]',
      ["Breaking Bad (2008):9", "Inception (2010):8"],
    )
    await trakt.useSearchMovie("Inception", [{ type: "movie", movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: "27205" }, rating: 8.8 } }])
    await trakt.useSearchMovie("Parasite", [{ type: "movie", movie: { title: "Parasite", year: 2019, released: "2019-05-30", ids: { trakt: 9999, slug: "parasite-2019", imdb: "tt6751668", tmdb: "496243" }, rating: 8.5 } }])
    await mood.open()
    await mood.pickMood("Make me laugh")

    await mood.setApiKey("gemini", "apiAiKey")

    await aiPicks.expectPosterIsWatchlisted("Inception")
    await aiPicks.expectPosterIsWatched("Parasite")
  })

  test("AI hits open Trakt pages on click, or Trakt search when unmatched", async ({ page, trakt, tmdb, ai, intro, mood, aiPicks }) => {
    await tmdb.useDetails("movie", "27205")
    await tmdb.useSearch("movie", "UnknownFilm")
    await signInToTrakt(page, trakt, intro, {
      watchedShows: [{
        last_watched_at: new Date().toISOString(),
        show: { title: "Breaking Bad", year: 2008, aired_episodes: 1, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747", tmdb: "1396" } },
        seasons: [{ number: 1, episodes: [{ number: 1, plays: 1 }] }],
      }],
    })
    await ai.gemini.useChat(
      '[{"title":"Inception","year":2010},{"title":"UnknownFilm","year":2020}]',
      [],
    )
    await trakt.useSearchShow("", [])
    await trakt.useSearchMovie("Inception", [{ type: "movie", movie: { title: "Inception", year: 2010, released: "2010-07-16", ids: { trakt: 481, slug: "inception-2010", imdb: "tt1375666", tmdb: "27205" }, rating: 8.8 } }])
    await trakt.useSearchMovie("UnknownFilm", [])
    await mood.open()
    await mood.pickMood("Make me laugh")

    await mood.setApiKey("gemini", "apiAiKey")

    await aiPicks.expectPosterLinksTo("Inception", "https://app.trakt.tv/movies/inception-2010")
    await aiPicks.expectPosterLinksTo("UnknownFilm", "https://trakt.tv/search?query=UnknownFilm")
  })
})

async function signInToSimkl(page, simkl, intro, { shows = [], movies = [], anime = [] } = {}) {
  await simkl.useOauthToken()
  await simkl.useTrendingTv()
  await simkl.useTrendingMovies()
  await simkl.useSyncActivities()
  await simkl.useSyncShows(shows)
  await simkl.useSyncMovies(movies)
  await simkl.useSyncAnime(anime)
  await simkl.useAuthorize()
  await page.goto("/")
  await intro.signIn("simkl")
}

async function signInToTrakt(page, trakt, intro, {
  watchedShows = [],
  watchedMovies = [],
  watchlistShows = [],
  watchlistMovies = [],
  droppedShows = [],
  ratingsShows = [],
  ratingsMovies = [],
} = {}) {
  await trakt.useOauthToken()
  await trakt.useLastActivities()
  await trakt.useWatchedShows(watchedShows)
  await trakt.useWatchedMovies(watchedMovies)
  await trakt.useWatchedShowsByPeriod()
  await trakt.useWatchedMoviesByPeriod()
  await trakt.useWatchlistShows(watchlistShows)
  await trakt.useWatchlistMovies(watchlistMovies)
  await trakt.useDroppedShows(droppedShows)
  await trakt.useRatingsShows(ratingsShows)
  await trakt.useRatingsMovies(ratingsMovies)
  await trakt.useAuthorize()
  await page.goto("/")
  await intro.signIn("trakt")
}
