import { expect } from "@playwright/test"

export function setupClaudeChat(page, responseText, expectedKey, expectedRatings, expectedLibrary) {
  return page.route("**/v1/messages", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().headers()["x-api-key"]).toBe(expectedKey)
    expect(route.request().headers()["anthropic-version"]).toBe("2023-06-01")
    const body = route.request().postDataJSON()
    expect(body.model).toBe("claude-sonnet-4-20250514")
    expect(body.system).toMatch(/movies and TV shows/)
    expect(body.system).toMatch(/at least 6\.5 IMDb rating/)
    expect(body.system).toMatch(/exactly 10 suggestions/)
    expect(body.system).toMatch(/JSON array/)
    expect(body.system).toMatch(/Do not suggest any title already in the user's library/)
    expect(body.messages[0].role).toBe("user")
    expect(body.messages[0].content).toMatch(/Mood:/)
    expect(body.messages[0].content).toMatch(/My ratings:/)
    expect(body.messages[0].content).toMatch(/My library:/)
    for (const rating of expectedRatings) expect(body.messages[0].content).toContain(rating)
    for (const title of expectedLibrary) expect(body.messages[0].content).toContain(title)
    expect(body.temperature).toBe(0.9)
    expect(body.max_tokens).toBe(512)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ content: [{ text: responseText }] }),
    })
  })
}
