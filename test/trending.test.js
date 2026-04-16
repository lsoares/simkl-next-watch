import { describe, it, before, after } from "node:test"
import { setupServer } from "msw/node"
import { findByRole, findByText } from "@testing-library/dom"
import { loadApp } from "./loadApp.js"
import { syncActivities, syncShows, syncMovies, syncAnime, tvEpisodes, trendingTv, trendingMovies } from "./clients/simkl.js"

describe("trending", () => {
  const server = setupServer()
  before(() => server.listen({ onUnhandledRequest: "error" }))
  after(() => server.close())

  it("shows trending shows and movies", async () => {
    server.use(
      syncActivities(),
      syncShows([{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
      }]),
      syncMovies([{
        movie: { title: "Inception", year: 2010, ids: { simkl_id: 22222 }, poster: "test" },
        status: "completed", user_rating: 8,
      }]),
      syncAnime([]),
      tvEpisodes("11121"),
      trendingTv([
        { title: "The Rookie", year: 2018, ids: { simkl_id: 99001 }, poster: "p1", ratings: { imdb: { rating: 8.0 } } },
        { title: "The Boys", year: 2019, ids: { simkl_id: 99002 }, poster: "p2", ratings: { imdb: { rating: 8.6 } } },
      ]),
      trendingMovies([
        { title: "Dune", year: 2024, ids: { simkl_id: 99003 }, poster: "p3", ratings: { imdb: { rating: 8.1 } } },
      ]),
    )
    const document = loadApp({ localStorage: { "next-watch-client-id": "test-client-id", "next-watch-client-secret": "test-secret", "next-watch-access-token": "test-token" } })
    const trendingButton = await findByRole(document, "button", { name: /trending/i })

    trendingButton.click()

    await findByText(document, "The Rookie")
    await findByText(document, "Dune")
  })
})
