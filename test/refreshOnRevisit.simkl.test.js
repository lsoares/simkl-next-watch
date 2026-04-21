import { test, expect } from "./test.js"
import { setupAuthorize, setupOauthToken, setupSyncActivities, setupSyncShows, setupSyncMovies, setupSyncAnime } from "./clients/simkl.js"

test("reopening the app pulls changes made on Simkl's site since last visit", async ({ page }) => {
  await signInWithLibrary(page, {
    shows: [{ title: "Breaking Bad", id: 11121, status: "plantowatch" }],
    movies: [{ title: "The Matrix", id: 53992, status: "plantowatch" }],
  })
  await expect(page.getByRole("article", { name: "Breaking Bad" })).toBeVisible()
  await expect(page.getByRole("article", { name: "The Matrix" })).toBeVisible()
  await externallyChangeLibrary(page, {
    shows: [
      { title: "Breaking Bad", id: 11121, status: "completed" },
      { title: "Chernobyl", id: 22000, status: "plantowatch" },
    ],
    movies: [
      { title: "The Matrix", id: 53992, status: "completed" },
      { title: "Dune", id: 99003, status: "plantowatch" },
    ],
  })

  await returnToApp(page)

  await expect(page.getByRole("article", { name: "Breaking Bad" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "The Matrix" })).toHaveCount(0)
  await expect(page.getByRole("article", { name: "Chernobyl" })).toBeVisible()
  await expect(page.getByRole("article", { name: "Dune" })).toBeVisible()
})

async function signInWithLibrary(page, library) {
  await setupOauthToken(page, "test-token")
  await publishLibrary(page, library, "2025-01-01T00:00:00Z")
  await setupSyncAnime(page, [])
  await setupAuthorize(page)
  await page.goto("/")
  await page.getByRole("button", { name: /get started \(simkl\)/i }).click()
}

async function externallyChangeLibrary(page, library) {
  await publishLibrary(page, library, "2025-02-01T00:00:00Z")
}

async function returnToApp(page) {
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))
}

async function publishLibrary(page, { shows, movies }, activityAt) {
  await setupSyncActivities(page, activityAt)
  await setupSyncShows(page, shows.map(({ title, id, status }) => ({ show: { title, ids: { simkl_id: id } }, status })))
  await setupSyncMovies(page, movies.map(({ title, id, status }) => ({ movie: { title, ids: { simkl_id: id } }, status })))
}
