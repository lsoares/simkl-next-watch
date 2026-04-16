import { describe, it, before, after } from "node:test"
import { setupServer } from "msw/node"
import { getByRole, getByLabelText, findByRole, findByText } from "@testing-library/dom"
import { loadApp } from "./loadApp.js"
import { syncActivities, syncShows, syncMovies, syncAnime, tvEpisodes, searchTv, searchMovie } from "./clients/simkl.js"
import { completeChat as completeGeminiChat } from "./clients/gemini.js"
import { completeChat as completeOpenaiChat } from "./clients/openai.js"
import { completeChat as completeClaudeChat } from "./clients/claude.js"

describe("ai suggestions", () => {
  const server = setupServer()
  before(() => server.listen({ onUnhandledRequest: "error" }))
  after(() => server.close())

  for (const { name, aiHandler } of [
    { name: "gemini", aiHandler: completeGeminiChat },
    { name: "openai", aiHandler: completeOpenaiChat },
    { name: "claude", aiHandler: completeClaudeChat },
  ]) {
    it(`shows poster recommendations with ${name}`, async () => {
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
        aiHandler('[{"title":"Parasite","year":2019},{"title":"Oldboy","year":2003},{"title":"The Handmaiden","year":2016}]', "test-key"),
        searchTv(),
        searchMovie({
          Parasite: { title: "Parasite", year: 2019, ids: { simkl_id: 33001 }, poster: "p", type: "movie" },
          Oldboy: { title: "Oldboy", year: 2003, ids: { simkl_id: 33002 }, poster: "p", type: "movie" },
          Handmaiden: { title: "The Handmaiden", year: 2016, ids: { simkl_id: 33003 }, poster: "p", type: "movie" },
        }),
      )
      const document = loadApp({ localStorage: { "next-watch-client-id": "test-client-id", "next-watch-client-secret": "test-secret", "next-watch-access-token": "test-token" } })
      await findByText(document, "Breaking Bad")

      // Configure AI provider via settings UI
      getByRole(document, "button", { name: "⚙" }).click()
      const providerSelect = await findByRole(document, "combobox", { name: /provider/i })
      providerSelect.value = name
      providerSelect.dispatchEvent(new document.defaultView.Event("change"))
      const aiKeyInput = getByLabelText(document, /api key/i)
      aiKeyInput.value = "test-key"
      getByRole(document, "button", { name: /save.*key/i }).click()
      await findByText(document, /key saved/i)

      // Navigate to AI and pick a mood
      const aiButton = await findByRole(document, "button", { name: /ai suggested/i })
      aiButton.click()
      const laughButton = await findByRole(document, "button", { name: /make me laugh/i })

      laughButton.click()

      await findByRole(document, "img", { name: "Parasite" })
      await findByRole(document, "img", { name: "Oldboy" })
      await findByRole(document, "img", { name: "The Handmaiden" })
    })
  }


  it("clicking AI mood without a key shows error toast", async () => {
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
    )
    const document = loadApp({ localStorage: { "next-watch-client-id": "test-client-id", "next-watch-client-secret": "test-secret", "next-watch-access-token": "test-token" } })
    const aiButton = await findByRole(document, "button", { name: /ai suggested/i })
    aiButton.click()
    const cozyButton = await findByRole(document, "button", { name: /cozy night in/i })

    cozyButton.click()

    await findByText(document, /add an ai key/i)
  })
})
