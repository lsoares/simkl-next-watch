import { expect } from "@playwright/test"

export function client(page, expectedKey = "apiAiKey") {
  return {
    useChat(responseText, expectedRatings) {
      return page.route("https://api.openai.com/v1/chat/completions", async (route) => {
        expect(route.request().method()).toBe("POST")
        expect(route.request().headers()["authorization"]).toBe(`Bearer ${expectedKey}`)
        const body = route.request().postDataJSON()
        expect(body.model).toBe("gpt-4o-mini")
        expect(body.messages[0].role).toBe("system")
        expect(body.messages[0].content).toMatch(/movies and TV shows/)
        expect(body.messages[0].content).toMatch(/IMDb.*6\.5/)
        expect(body.messages[0].content).toMatch(/Recommend 10/)
        expect(body.messages[0].content).toMatch(/Output JSON only/)
        expect(body.messages[0].content).toMatch(/none appearing in Library/)
        expect(body.messages[0].content).toMatch(/Mood is the primary filter/)
        expect(body.messages[0].content).toMatch(/Diversity:/)
        expect(body.messages[1].role).toBe("user")
        expect(body.messages[1].content).toMatch(/Mood: .+ — .+/)
        expect(body.messages[1].content).toMatch(/Library: /)
        for (const rating of expectedRatings) expect(body.messages[1].content).toContain(rating)
        expect(body.temperature).toBe(0.9)
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ choices: [{ message: { content: responseText } }] }),
        })
      })
    },
  }
}
