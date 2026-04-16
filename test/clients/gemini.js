import { expect } from "@playwright/test"

export function setupCompleteChat(page, responseText, expectedKey) {
  return page.route(/generativelanguage\.googleapis\.com.*generateContent/, async (route) => {
    expect(route.request().method()).toBe("POST")
    const url = new URL(route.request().url())
    expect(url.searchParams.get("key")).toBe(expectedKey)
    const body = route.request().postDataJSON()
    expect(body.contents?.[0]?.parts?.[0]?.text).toBeTruthy()
    expect(body.generationConfig?.temperature).toBe(0.9)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ candidates: [{ content: { parts: [{ text: responseText }] } }] }),
    })
  })
}
