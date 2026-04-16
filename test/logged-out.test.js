import { describe, it, before, after } from "node:test"
import { setupServer } from "msw/node"
import { getByRole, getByText, findByRole, findByText } from "@testing-library/dom"
import { loadApp } from "./loadApp.js"
import { syncActivities, syncShows, syncMovies, syncAnime, tvEpisodes } from "./clients/simkl.js"

describe("logged out from simkl", () => {
  const server = setupServer()
  before(() => server.listen({ onUnhandledRequest: "error" }))
  after(() => server.close())

  it("shows the intro with Get Started button", () => {
    const document = loadApp()

    getByText(document, /your next episode or movie/i)
    getByRole(document, "button", { name: /get started/i })
  })


  it("Get Started navigates to settings with Simkl setup form", async () => {
    const document = loadApp()

    getByRole(document, "button", { name: /get started/i }).click()

    await findByRole(document, "heading", { name: /simkl/i })
    await findByRole(document, "button", { name: /connect with simkl/i })
  })


  it("logout clears session and shows intro", async () => {
    server.use(
      syncActivities(),
      syncShows([{
        show: { title: "Breaking Bad", year: 2008, ids: { simkl_id: 11121 }, poster: "test" },
        status: "watching", user_rating: 9, next_to_watch: "S05E01",
        watched_episodes_count: 46, total_episodes_count: 62, not_aired_episodes_count: 0,
      }]),
      syncMovies([]),
      syncAnime([]),
      tvEpisodes(),
    )
    const document = loadApp({ localStorage: { "next-watch-client-id": "test-client-id", "next-watch-client-secret": "test-secret", "next-watch-access-token": "test-token" } })
    await findByText(document, "Breaking Bad")
    getByRole(document, "button", { name: "⚙" }).click()
    const logoutButton = await findByRole(document, "button", { name: /logout/i })

    logoutButton.click()

    await findByRole(document, "button", { name: /get started/i })
    await findByText(document, /your next episode or movie/i)
  })
})
