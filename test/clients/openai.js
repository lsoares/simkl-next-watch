const assert = require("node:assert/strict")
const { http, HttpResponse } = require("msw")

function completeChat(responseText, expectedKey) {
  return http.post("https://api.openai.com/v1/chat/completions", async ({ request }) => {
    assert.equal(request.headers.get("authorization"), `Bearer ${expectedKey}`)
    const body = await request.json()
    assert.equal(body.model, "gpt-4o-mini")
    assert.equal(body.messages[0].role, "system")
    assert.equal(body.messages[1].role, "user")
    assert.equal(body.temperature, 0.9)
    return HttpResponse.json({ choices: [{ message: { content: responseText } }] })
  })
}

module.exports = { completeChat }
