import { describe, it, before, after } from "node:test"
import assert from "node:assert/strict"
import { setupServer } from "msw/node"
import { getByRole, getByLabelText, findByRole, findByText } from "@testing-library/dom"
import { loadApp } from "./loadApp.js"
import { syncActivities, syncShows, syncMovies, syncAnime, tvEpisodes } from "./clients/simkl.js"

describe("settings", () => {
  const server = setupServer()
  before(() => server.listen({ onUnhandledRequest: "error" }))
  after(() => server.close())

  it("shows settings form pre-filled when logged in", async () => {
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

    const clientIdInput = await findByRole(document, "textbox", { name: /client id/i })
    const appSecretInput = getByLabelText(document, /app secret/i)
    assert.equal(clientIdInput.value, "test-client-id")
    assert.equal(appSecretInput.value, "test-secret")
    getByRole(document, "button", { name: /save simkl settings/i })
    getByRole(document, "button", { name: /logout/i })
  })


  it("saving AI key shows confirmation toast", async () => {
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
    const aiKeyInput = await findByRole(document, "textbox", { name: /api key/i })
    aiKeyInput.value = "my-gemini-key"

    getByRole(document, "button", { name: /save.*key/i }).click()

    await findByText(document, /gemini key saved/i)
  })


  it("saving AI key without value shows error toast", async () => {
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
    await findByRole(document, "textbox", { name: /api key/i })

    getByRole(document, "button", { name: /save.*key/i }).click()

    await findByText(document, /enter an ai api key/i)
  })
})
