import { expect } from "@playwright/test"

export function setupGeminiChat(page, responseText, expectedKey, expectedRatings) {
  return page.route(/generativelanguage\.googleapis\.com.*generateContent/, async (route) => {
    expect(route.request().method()).toBe("POST")
    const url = new URL(route.request().url())
    expect(url.searchParams.get("key")).toBe(expectedKey)
    const body = route.request().postDataJSON()
    const text = body.contents?.[0]?.parts?.[0]?.text
    expect(text).toMatch(/movies and TV shows/)
    expect(text).toMatch(/IMDb ≥6\.5/)
    expect(text).toMatch(/Recommend 10/)
    expect(text).toMatch(/Output JSON only/)
    expect(text).toMatch(/none appearing in Library/)
    expect(text).toMatch(/Mood is the primary filter/)
    expect(text).toMatch(/Diversity:/)
    expect(text).toMatch(/Mood: .+ — .+/)
    expect(text).toMatch(/Library: /)
    for (const rating of expectedRatings) expect(text).toContain(rating)
    expect(body.generationConfig?.temperature).toBe(0.9)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: responseText }] } }] }),
    })
  })
}
