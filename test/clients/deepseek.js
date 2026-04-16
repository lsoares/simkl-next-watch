import { expect } from "@playwright/test"

export function setupCompleteChat(page, responseText, expectedKey) {
  return page.route("https://api.deepseek.com/**", async (route) => {
    expect(route.request().method()).toBe("POST")
    expect(route.request().headers()["authorization"]).toBe(`Bearer ${expectedKey}`)
    const body = route.request().postDataJSON()
    expect(body.model).toBe("deepseek-chat")
    expect(body.messages[0].role).toBe("system")
    expect(body.messages[1].role).toBe("user")
    expect(body.temperature).toBe(0.9)
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ choices: [{ message: { content: responseText } }] }),
    })
  })
}
