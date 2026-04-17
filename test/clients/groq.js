import { expect } from "@playwright/test"

export function setupGroqChat(page, responseText, expectedKey, expectedRatings, expectedLibrary) {
  return page.route("https://api.groq.com/**", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().headers()["authorization"]).toBe(`Bearer ${expectedKey}`)
    const body = route.request().postDataJSON()
    expect(body.model).toBe("llama-3.3-70b-versatile")
    expect(body.messages[0].role).toBe("system")
    expect(body.messages[0].content).toMatch(/movies and TV shows/)
    expect(body.messages[0].content).toMatch(/at least 6\.5 IMDb rating/)
    expect(body.messages[0].content).toMatch(/exactly 10 suggestions/)
    expect(body.messages[0].content).toMatch(/JSON array/)
    expect(body.messages[0].content).toMatch(/Do not suggest any title already in the user's library/)
    expect(body.messages[1].role).toBe("user")
    expect(body.messages[1].content).toMatch(/Mood:/)
    expect(body.messages[1].content).toMatch(/My ratings:/)
    expect(body.messages[1].content).toMatch(/My library:/)
    expect(body.messages[1].content).toMatch(/Variation: \d+/)
    for (const rating of expectedRatings) expect(body.messages[1].content).toContain(rating)
    for (const title of expectedLibrary) expect(body.messages[1].content).toContain(title)
    expect(body.temperature).toBe(0.9)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ choices: [{ message: { content: responseText } }] }),
    })
  })
}
