import { expect } from "@playwright/test"

export function setupDeepseekChat(page, responseText, expectedKey, expectedRatings) {
  return page.route("https://api.deepseek.com/**", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().headers()["authorization"]).toBe(`Bearer ${expectedKey}`)
    const body = route.request().postDataJSON()
    expect(body.model).toBe("deepseek-chat")
    expect(body.messages[0].role).toBe("system")
    expect(body.messages[0].content).toMatch(/movies and TV shows/)
    expect(body.messages[0].content).toMatch(/at least 6\.5 IMDb rating/)
    expect(body.messages[0].content).toMatch(/exactly 10/)
    expect(body.messages[0].content).toMatch(/JSON array/)
    expect(body.messages[0].content).toMatch(/Do not suggest any title the user has rated/)
    expect(body.messages[0].content).toMatch(/Taste:/)
    expect(body.messages[0].content).toMatch(/Diversity within the 10:/)
    expect(body.messages[1].role).toBe("user")
    expect(body.messages[1].content).toMatch(/Mood: .+ — .+/)
    expect(body.messages[1].content).toMatch(/Liked \(8-10\):/)
    expect(body.messages[1].content).not.toMatch(/My library:/)
    expect(body.messages[1].content).not.toMatch(/Variation:/)
    for (const rating of expectedRatings) expect(body.messages[1].content).toContain(rating)
    expect(body.temperature).toBe(0.9)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ choices: [{ message: { content: responseText } }] }),
    })
  })
}
