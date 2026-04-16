const assert = require("node:assert/strict")
const { http, HttpResponse } = require("msw")

function completeChat(responseText, expectedKey) {
  return http.post("https://api.anthropic.com/v1/messages", async ({ request }) => {
    assert.equal(request.headers.get("x-api-key"), expectedKey)
    assert.equal(request.headers.get("anthropic-version"), "2023-06-01")
    const body = await request.json()
    assert.equal(body.model, "claude-sonnet-4-20250514")
    assert.ok(body.system)
    assert.equal(body.messages[0].role, "user")
    assert.equal(body.temperature, 0.9)
    assert.equal(body.max_tokens, 256)
    return HttpResponse.json({ content: [{ text: responseText }] })
  })
}

module.exports = { completeChat }
