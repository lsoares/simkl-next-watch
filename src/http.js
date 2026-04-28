export function safeJson(res) {
  return res.json().catch(() => ({}))
}
