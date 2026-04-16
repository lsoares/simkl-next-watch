import { expect } from "@playwright/test"

export function setupCompleteChat(page, responseText, expectedKey) {
  return page.route("**/v1/messages", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().headers()["x-api-key"]).toBe(expectedKey)
    expect(route.request().headers()["anthropic-version"]).toBe("2023-06-01")
    const body = route.request().postDataJSON()
    expect(body.model).toBe("claude-sonnet-4-20250514")
    expect(body.system).toBeTruthy()
    expect(body.messages[0].role).toBe("user")
    expect(body.temperature).toBe(0.9)
    expect(body.max_tokens).toBe(256)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ content: [{ text: responseText }] }),
    })
  })
}
