export async function fetchAiSuggestions({ provider, key, mediaType, library, mood }) {
  const context = buildLibraryContext(mediaType, library.shows, library.movies)
  if (!context) return []
  const moodLine = mood.gloss ? `${mood.label} — ${mood.gloss}` : mood.label
  const userMessage = `${context}\nMood: ${moodLine}`
  const raw = await aiComplete(provider, key, userMessage, systemPrompt(mediaType))
  try {
    const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim())
    return Array.isArray(parsed) ? parsed : []
  } catch {
    throw new Error("Couldn't parse AI suggestions. Try again.")
  }
}

// ── Internals ──

function systemPrompt(mediaType) {
  const types = { both: "movies and TV shows", tv: "TV shows only", movie: "movies only" }
  return `You are a film/TV recommender. Suggest exactly 10 ${types[mediaType] || types.both} with at least 6.5 IMDb rating. Do not suggest any title in the user's Library below — they've already rated or watched it.

Library format: comma-separated "Title (year)" entries; a trailing ":N" marks the user's 1-10 rating if they rated it.

Taste:
- Rated titles carry the primary signal. Treat 8-10 as strong likes; 1-5 as dislikes (avoid similar).
- Unrated library entries are a weaker signal (user watched but didn't rate); use them only when rated items don't cover a pattern, and never let them outrank an explicit rating.
- Infer across genre, tone, era, pacing, and country — not just genre.
- Mood is the primary filter; taste chooses which mood-fitting titles to pick.

Diversity within the 10:
- Max 2 sharing a franchise, director, or lead creator.
- Mix at least 3 decades and 3 countries/languages when plausible.
- Don't stack one subgenre.

Output: a JSON array only, no prose, no markdown:
[{"title":"...","year":1234}]`
}

function buildLibraryContext(mediaType, shows, movies) {
  const includeTv = mediaType !== "movie"
  const includeFilm = mediaType !== "tv"
  const pool = [
    ...(includeTv ? (shows || []) : []),
    ...(includeFilm ? (movies || []) : []),
  ].filter((i) => i.user_rating != null || i.status === "completed" || i.status === "watching")
  if (!pool.length) return ""
  const listed = shuffle(pool).slice(0, 150).map((i) => {
    const year = i.year ? ` (${i.year})` : ""
    return i.user_rating != null ? `${i.title}${year}:${i.user_rating}` : `${i.title}${year}`
  }).join(", ")
  return `Library: ${listed}`
}

function shuffle(arr) {
  return arr.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(([, v]) => v)
}

async function aiComplete(provider, key, userMessage, sysPrompt) {
  const config = PROVIDERS[provider]
  if (!config) throw new Error("Unknown AI provider")
  const res = await fetch(config.url(key), {
    method: "POST",
    headers: config.headers(key),
    body: JSON.stringify(config.body(sysPrompt, userMessage)),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(res.status === 429 ? "AI quota exceeded. Try again later." : (data.error?.message || (typeof data.error === "string" ? data.error : null) || `${provider} error ${res.status}`))
  return config.extract(data) || ""
}

const PROVIDERS = {
  gemini: {
    url: (key) => `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${encodeURIComponent(key)}`,
    headers: () => ({ "Content-Type": "application/json" }),
    body: (sys, user) => ({ contents: [{ parts: [{ text: sys + "\n\n" + user }] }], generationConfig: { temperature: 0.9 } }),
    extract: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text,
  },
  openai: {
    url: () => "https://api.openai.com/v1/chat/completions",
    headers: (key) => ({ "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }),
    body: (sys, user) => ({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0.9 }),
    extract: (data) => data.choices?.[0]?.message?.content,
  },
  claude: {
    url: () => "https://api.anthropic.com/v1/messages",
    headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true" }),
    body: (sys, user) => ({ model: "claude-sonnet-4-20250514", max_tokens: 512, system: sys, messages: [{ role: "user", content: user }], temperature: 0.9 }),
    extract: (data) => data.content?.[0]?.text,
  },
  grok: {
    url: () => "https://api.x.ai/v1/chat/completions",
    headers: (key) => ({ "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }),
    body: (sys, user) => ({ model: "grok-3-mini", messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0.9 }),
    extract: (data) => data.choices?.[0]?.message?.content,
  },
  groq: {
    url: () => "https://api.groq.com/openai/v1/chat/completions",
    headers: (key) => ({ "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }),
    body: (sys, user) => ({ model: "llama-3.3-70b-versatile", messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0.9 }),
    extract: (data) => data.choices?.[0]?.message?.content,
  },
  deepseek: {
    url: () => "https://api.deepseek.com/chat/completions",
    headers: (key) => ({ "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }),
    body: (sys, user) => ({ model: "deepseek-chat", messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0.9 }),
    extract: (data) => data.choices?.[0]?.message?.content,
  },
  openrouter: {
    url: () => "https://openrouter.ai/api/v1/chat/completions",
    headers: (key) => ({ "Authorization": `Bearer ${key}`, "Content-Type": "application/json" }),
    body: (sys, user) => ({ model: "google/gemini-2.5-flash-lite-preview:free", messages: [{ role: "system", content: sys }, { role: "user", content: user }], temperature: 0.9 }),
    extract: (data) => data.choices?.[0]?.message?.content,
  },
}
