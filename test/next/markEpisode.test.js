import { test } from "../test.js"

test.describe("Simkl", () => {
  test("marks the next episode of a watching TV show", async ({ page, simkl, tmdb, intro, next }) => {
    await simkl.useOauthToken()
    await simkl.useTrendingTv()
    await simkl.useTrendingMovies()
    await tmdb.usePosters(1)
    await simkl.useSyncActivities()
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "watching", next_to_watch: "S05E01",
      watched_episodes_count: 46, total_episodes_count: 62,
    }])
    await simkl.useSyncMovies()
    await simkl.useSyncAnime()
    await simkl.useTvEpisodes("11121", [
      { season: 5, episode: 1, type: "episode", title: "Live Free or Die" },
    ])
    await simkl.useMarkWatchedShow([{ ids: { simkl: 11121 }, seasons: [{ number: 5, episodes: [{ number: 1 }] }] }])
    await simkl.useAuthorize()
    await page.goto("/")
    await intro.signIn("simkl")
    await next.expectTitleLinksTo("Breaking Bad", "https://simkl.com/tv/11121/breaking-bad")
    await next.expectNextEpisodeIs("Breaking Bad", "5x1: Live Free or Die", "https://simkl.com/tv/11121/breaking-bad/season-5/episode-1/")
    await next.expectAddSeriesLinksTo("https://simkl.com/search/?type=tv")
    await simkl.useSyncActivities("2025-02-01T00:00:00Z")
    await simkl.useSyncShows([{
      show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 } },
      status: "watching", next_to_watch: "S05E02",
      watched_episodes_count: 47, total_episodes_count: 62,
    }])

    await next.markWatched("Breaking Bad")

    await next.expectToastMessage(/marked.*breaking bad.*5x1.*watched/i)
    await next.expectToastLinksTo("Breaking Bad 5x1", "https://simkl.com/tv/11121/breaking-bad/season-5/episode-1/")
    await next.expectNextEpisodeIs("Breaking Bad", /^5x2/, "https://simkl.com/tv/11121/breaking-bad/season-5/episode-2/")
  })
})

test.describe("Trakt", () => {
  test("marks the next episode of a watching TV show", async ({ page, trakt, tmdb, intro, next }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchedMovies()
    await trakt.useRatingsShows()
    await trakt.useRatingsMovies()
    await trakt.useWatchedShowsByPeriod()
    await trakt.useWatchedMoviesByPeriod()
    await tmdb.usePosters(1)
    await trakt.useWatchlistShows()
    await trakt.useWatchlistMovies()
    await trakt.useDroppedShows()
    await trakt.useWatchedShows([{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [{ number: 4, episodes: [{ number: 13, plays: 1 }] }],
    }])
    await trakt.useProgress("breaking-bad", { next_episode: { season: 5, number: 1, title: "Live Free or Die" } })
    await trakt.useMarkWatchedShow([{ ids: { trakt: 1388, imdb: "tt0903747", slug: "breaking-bad" }, seasons: [{ number: 5, episodes: [{ number: 1 }] }] }])
    await trakt.useAuthorize()
    await page.goto("/")
    await intro.signIn("trakt")
    await next.expectTitleLinksTo("Breaking Bad", "https://app.trakt.tv/shows/breaking-bad")
    await next.expectNextEpisodeIs("Breaking Bad", "5x1: Live Free or Die", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/1")
    await next.expectAddSeriesLinksTo("https://app.trakt.tv/search?m=show")
    await trakt.useWatchedShows([{
      last_watched_at: new Date().toISOString(),
      show: { title: "Breaking Bad", year: 2008, aired_episodes: 62, ids: { trakt: 1388, slug: "breaking-bad", imdb: "tt0903747" } },
      seasons: [
        { number: 4, episodes: [{ number: 13, plays: 1 }] },
        { number: 5, episodes: [{ number: 1, plays: 1 }] },
      ],
    }])
    await trakt.useProgress("breaking-bad", { next_episode: { season: 5, number: 2 } })

    await next.markWatched("Breaking Bad")

    await next.expectToastMessage(/marked.*breaking bad.*5x1.*watched/i)
    await next.expectToastLinksTo("Breaking Bad 5x1", "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/1")
    await next.expectNextEpisodeIs("Breaking Bad", /^5x2/, "https://app.trakt.tv/shows/breaking-bad/seasons/5/episodes/2")
  })

  test("marks the first episode of a plantowatch show (starting it)", async ({ page, trakt, tmdb, intro, next }) => {
    await trakt.useOauthToken()
    await trakt.useLastActivities()
    await trakt.useWatchedMovies()
    await trakt.useRatingsShows()
    await trakt.useRatingsMovies()
    await trakt.useWatchedShowsByPeriod()
    await trakt.useWatchedMoviesByPeriod()
    await tmdb.usePosters(1)
    await trakt.useWatchedShows()
    await trakt.useDroppedShows()
    await trakt.useWatchlistMovies()
    await trakt.useWatchlistShows([{
      listed_at: "2025-01-01T00:00:00Z",
      show: { title: "Severance", year: 2022, first_aired: "2022-02-18", aired_episodes: 19, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
    }])
    await trakt.useMarkWatchedShow([{ ids: { trakt: 153027, imdb: "tt11280740", slug: "severance" }, seasons: [{ number: 1, episodes: [{ number: 1 }] }] }])
    await trakt.useRemoveFromWatchlistShow([{ ids: { trakt: 153027, imdb: "tt11280740", slug: "severance" } }])
    await trakt.useAuthorize()
    await page.goto("/")
    await intro.signIn("trakt")
    await next.expectShowIsPresent("Severance")
    await trakt.useWatchlistShows()
    await trakt.useWatchedShows([{
      last_watched_at: new Date().toISOString(),
      show: { title: "Severance", year: 2022, aired_episodes: 19, ids: { trakt: 153027, slug: "severance", imdb: "tt11280740" } },
      seasons: [{ number: 1, episodes: [{ number: 1, plays: 1 }] }],
    }])
    await trakt.useProgress("severance", { next_episode: { season: 1, number: 2 } })

    await next.markWatched("Severance")

    await next.expectToastMessage(/marked.*severance.*1x1.*watched/i)
    await next.expectToastLinksTo("Severance 1x1", "https://app.trakt.tv/shows/severance/seasons/1/episodes/1")
    await next.expectNextEpisodeIs("Severance", /^1x2/, "https://app.trakt.tv/shows/severance/seasons/1/episodes/2")
  })
})
