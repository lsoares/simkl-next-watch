import { test, expect } from "../test.js"

test("first periodic check records baseline counts without notifying", async ({ page, simkl, tmdb, intro }) => {
  await simkl.useOauthToken()
  await simkl.useTrendingTv()
  await simkl.useTrendingMovies()
  await tmdb.useDetails("tv", "1396")
  await tmdb.useSeason("1396", 5)
  await simkl.useSyncActivities()
  await simkl.useSyncShows([{
    show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
    status: "watching", next_to_watch: "S05E01",
    watched_episodes_count: 46, total_episodes_count: 62,
  }])
  await simkl.useSyncMovies()
  await simkl.useSyncAnime()
  await simkl.useAuthorize()
  await page.goto("/")
  await intro.signIn("simkl")

  const notifs = await runCheckNewEpisodes(page)

  expect(notifs).toEqual([])
})

test("subsequent check notifies for each watching show that gained a new episode", async ({ page, simkl, tmdb, intro }) => {
  await simkl.useOauthToken()
  await simkl.useTrendingTv()
  await simkl.useTrendingMovies()
  await tmdb.useDetails("tv", "1396")
  await tmdb.useSeason("1396", 5)
  await simkl.useSyncActivities()
  await simkl.useSyncShows([{
    show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
    status: "watching", next_to_watch: "S05E01",
    watched_episodes_count: 46, total_episodes_count: 62,
  }])
  await simkl.useSyncMovies()
  await simkl.useSyncAnime()
  await simkl.useAuthorize()
  await page.goto("/")
  await intro.signIn("simkl")
  await runCheckNewEpisodes(page)
  await simkl.useSyncActivities("2025-02-01T00:00:00Z")
  await simkl.useSyncShows([{
    show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121, tmdb: "1396" } },
    status: "watching", next_to_watch: "S05E01",
    watched_episodes_count: 46, total_episodes_count: 63,
  }])

  const notifs = await runCheckNewEpisodes(page)

  expect(notifs).toEqual([{
    title: "Breaking Bad",
    body: "New episode S05E01 aired",
    tag: "next-watch-show-11121",
    icon: "https://image.tmdb.org/t/p/w342/t.jpg",
    image: "https://image.tmdb.org/t/p/w342/t.jpg",
  }])
})

function runCheckNewEpisodes(page) {
  return page.evaluate(async () => {
    const recorded = []
    const m = await import("./src/notifications.js")
    await m.checkNewEpisodes((notif) => { recorded.push(notif) })
    return recorded
  })
}
