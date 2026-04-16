import assert from "node:assert/strict"
import { http, HttpResponse } from "msw"

export function completeChat(responseText, expectedKey) {
  return http.post("https://generativelanguage.googleapis.com/v1beta/models/*", async ({ request }) => {
    assert.equal(new URL(request.url).searchParams.get("key"), expectedKey)
    const body = await request.json()
    assert.ok(body.contents?.[0]?.parts?.[0]?.text)
    assert.equal(body.generationConfig?.temperature, 0.9)
    return HttpResponse.json({ candidates: [{ content: { parts: [{ text: responseText }] } }] })
  })
}
