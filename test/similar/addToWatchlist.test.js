import { test } from "../test.js"

test.describe("Simkl", () => {
  test("adds an unwatched similar pick to the watchlist from the similar dialog", async ({ page, simkl, tmdb, ai, intro, similar, aiPicks }) => {
    await page.addInitScript(() => new Promise((resolve, reject) => {
      const open = indexedDB.open("next-watch", 1)
      open.onupgradeneeded = () => open.result.createObjectStore("kv")
      open.onerror = () => reject(open.error)
      open.onsuccess = () => {
        const tx = open.result.transaction("kv", "readwrite")
        tx.objectStore("kv").put("gemini", "aiProvider")
        tx.objectStore("kv").put("apiAiKey", "aiKey:gemini")
        tx.oncomplete = resolve
        tx.onerror = () => reject(tx.error)
      }
    }))
    await simkl.useOauthToken()
    await simkl.useTrendingTv()
    await simkl.useTrendingMovies()
    await tmdb.useDetails("movie", "27205")
    await tmdb.useDetails("movie", "1124")
    await simkl.useSyncActivities()
    await simkl.useSyncShows()
    await simkl.useSyncMovies([{
      movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222, tmdb: "27205" } },
      status: "completed", user_rating: 8,
    }])
    await simkl.useSyncAnime()
    await simkl.useAuthorize()
    await ai.gemini.useSimilar('[{"title":"The Prestige","year":2006}]', "Inception (2010)")
    await simkl.useSearchMovie("Prestige", [{ title: "The Prestige", year: 2006, ids: { simkl_id: 44444, tmdb: "1124" }, type: "movie", ratings: { imdb: { rating: 8.5 } } }])
    await simkl.useAddToWatchlist({ movies: [{ to: "plantowatch", ids: { simkl: 44444 } }] })
    await page.goto("/")
    await intro.signIn("simkl")
    await intro.expectIsLoggedIn()
    await similar.open()
    await similar.openMoreLikeThis("Inception")
    await aiPicks.expectPosterIsVisible("The Prestige")

    await aiPicks.addToWatchlist("The Prestige")

    await aiPicks.expectToastMessage(/added.*prestige.*watchlist/i)
  })
})
