import { expect } from "@playwright/test"

export function client(page, expectedKey = "apiAiKey") {
  return {
    useChat(responseText, expectedRatings) {
      return page.route("https://api.anthropic.com/v1/messages", async (route) => {
        expect(route.request().method()).toBe("POST")
        expect(route.request().headers()["x-api-key"]).toBe(expectedKey)
        expect(route.request().headers()["anthropic-version"]).toBe("2023-06-01")
        const body = route.request().postDataJSON()
        expect(body.model).toBe("claude-sonnet-4-20250514")
        expect(body.system).toMatch(/movies and TV shows/)
        expect(body.system).toMatch(/IMDb.*6\.5/)
        expect(body.system).toMatch(/Recommend 10/)
        expect(body.system).toMatch(/Output JSON only/)
        expect(body.system).toMatch(/none appearing in Library/)
        expect(body.system).toMatch(/Mood is the primary filter/)
        expect(body.system).toMatch(/Diversity:/)
        expect(body.messages[0].role).toBe("user")
        expect(body.messages[0].content).toMatch(/Mood: .+ — .+/)
        expect(body.messages[0].content).toMatch(/Library: /)
        for (const rating of expectedRatings) expect(body.messages[0].content).toContain(rating)
        expect(body.temperature).toBe(0.9)
        expect(body.max_tokens).toBe(512)
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ content: [{ text: responseText }] }),
        })
      })
    },
  }
}
