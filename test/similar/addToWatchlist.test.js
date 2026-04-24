import { test } from "../test.js"

test.describe("Simkl", () => {
  test("adds an unwatched similar pick to the watchlist from the similar dialog", async ({ page, simkl, tmdb, ai, intro, similar, aiPicks }) => {
    await page.addInitScript(() => {
      localStorage.setItem("next-watch-ai-provider", "gemini")
      localStorage.setItem("next-watch-ai-key-gemini", "apiAiKey")
    })
    await simkl.useOauthToken()
    await simkl.useTrendingTv()
    await simkl.useTrendingMovies()
    await tmdb.usePosters(2)
    await simkl.useSyncActivities()
    await simkl.useSyncShows()
    await simkl.useSyncMovies([{
      movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 } },
      status: "completed", user_rating: 8,
    }])
    await simkl.useSyncAnime()
    await simkl.useAuthorize()
    await ai.gemini.useSimilar('[{"title":"The Prestige","year":2006}]', "Inception (2010)")
    await simkl.useSearchTv("", [])
    await simkl.useSearchMovie("Prestige", [{ title: "The Prestige", year: 2006, ids: { simkl_id: 44444 }, type: "movie", ratings: { imdb: { rating: 8.5 } } }])
    await simkl.useAddToWatchlist({ movies: [{ to: "plantowatch", ids: { simkl: 44444 } }] })
    await page.goto("/")
    await intro.signIn("simkl")
    await intro.expectLogoutIsVisible()
    await similar.open()
    await similar.openMoreLikeThis("Inception")
    await aiPicks.expectPosterIsVisible("The Prestige")

    await aiPicks.addToWatchlist("The Prestige")

    await aiPicks.expectToastMessage(/added.*prestige.*watchlist/i)
  })
})
