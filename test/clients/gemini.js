import { expect } from "@playwright/test"

export function setupGeminiChat(page, responseText, expectedKey, expectedRatings) {
  return page.route(/generativelanguage\.googleapis\.com.*generateContent/, async (route) => {
    expect(route.request().method()).toBe("POST")
    const url = new URL(route.request().url())
    expect(url.searchParams.get("key")).toBe(expectedKey)
    const body = route.request().postDataJSON()
    const text = body.contents?.[0]?.parts?.[0]?.text
    expect(text).toMatch(/movies and TV shows/)
    expect(text).toMatch(/at least 6\.5 IMDb rating/)
    expect(text).toMatch(/exactly 10/)
    expect(text).toMatch(/JSON array/)
    expect(text).toMatch(/Do not suggest any title in the user.s Library/)
    expect(text).toMatch(/Taste:/)
    expect(text).toMatch(/Diversity within the 10:/)
    expect(text).toMatch(/Mood: .+ — .+/)
    expect(text).toMatch(/Library: /)
    expect(text).not.toMatch(/My library:/)
    expect(text).not.toMatch(/Variation:/)
    for (const rating of expectedRatings) expect(text).toContain(rating)
    expect(body.generationConfig?.temperature).toBe(0.9)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: responseText }] } }] }),
    })
  })
}
