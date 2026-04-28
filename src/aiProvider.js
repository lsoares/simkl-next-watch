import { idbDelete } from "./idbStore.js"

export async function clearAi() {
  await idbDelete("aiProvider")
  await Promise.all(Object.keys(PROVIDERS).map((p) => idbDelete(`aiKey:${p}`)))
}

export async function fetchAiSuggestions({ provider, key, library, mood }) {
  const context = buildLibraryContext(library.shows, library.movies)
  if (!context) return []
  const moodLine = mood.gloss ? `${mood.label} — ${mood.gloss}` : mood.label
  const userMessage = `${context}\nMood: ${moodLine}`
  const raw = await aiComplete(provider, key, userMessage, MOOD_SYSTEM_PROMPT)
  return parseSuggestions(raw)
}

export async function fetchSimilarSuggestions({ provider, key, library, seed }) {
  const context = buildLibraryContext(library.shows, library.movies)
  const seedYear = seed.year ? ` (${seed.year})` : ""
  const userMessage = `Seed: ${seed.title}${seedYear}${context ? `\n${context}` : ""}`
  const raw = await aiComplete(provider, key, userMessage, SIMILAR_SYSTEM_PROMPT)
  return parseSuggestions(raw)
}

// ── Internals ──

function parseSuggestions(raw) {
  try {
    const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim())
    const movies = (parsed.movies || []).map((s) => ({ ...s, type: "movie" }))
    const series = (parsed.series || []).map((s) => ({ ...s, type: "tv" }))
    return [...movies, ...series]
  } catch {
    throw new Error("Couldn't parse AI suggestions. Try again.")
  }
}

const MOOD_SYSTEM_PROMPT = `Recommend 10 movies and TV shows, none appearing in Library. Skip anything with low IMDb (under 6.5) or weak critical reception — quality is non-negotiable, even if it fits the mood perfectly.
Library format: "Title (year)[:N]" where N is the user's 1-10 rating.

Mood is the primary filter. Weight rated 8-10 as strong likes, 1-5 as dislikes; unrated entries are a weaker signal. Infer across tone, era, pacing, and country — not just genre.

Diversity: ≤2 sharing a franchise or creator; spread across ≥3 decades and ≥3 countries/languages when plausible.

Output JSON only, splitting by kind: {"movies":[{"title":"...","year":1234}],"series":[{"title":"...","year":1234}]}`

const SIMILAR_SYSTEM_PROMPT = `Recommend 10 movies and TV shows similar to the seed title below, none appearing in Library. Skip anything with low IMDb (under 6.5) or weak critical reception — quality is non-negotiable, even if it's a close lateral match.
Library format: "Title (year)[:N]" where N is the user's 1-10 rating.

The seed is the anchor: recommend titles that scratch the same itch. Weight tone and mood first, then themes and subject matter, then era and pacing. Genre alone is a weak signal. Shared creator, cast, or franchise is allowed but not required — prefer lateral picks over obvious sequels or spin-offs unless they are clearly the closest match.

Use Library ratings as secondary signals: 8-10 are likes (lean toward those sensibilities when picking lateral matches), 1-5 are dislikes (avoid recommendations that resemble them).

Spread: at most 3 sharing a franchise or creator with the seed; the rest should be lateral picks from other creators.

Output JSON only, splitting by kind: {"movies":[{"title":"...","year":1234}],"series":[{"title":"...","year":1234}]}`

function buildLibraryContext(shows, movies) {
  const pool = [...(shows || []), ...(movies || [])]
    .filter((i) => i.user_rating != null || i.status === "completed" || i.status === "watching")
  if (!pool.length) return ""
  const listed = shuffle(pool).slice(0, 250).map((i) => {
    const year = i.year ? ` (${i.year})` : ""
    return i.user_rating != null ? `${i.title}${year}:${i.user_rating}` : `${i.title}${year}`
  }).join(", ")
  return `Library: ${listed}`
}

export function shuffle(arr) {
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
  if (!res.ok) {
    const msg = res.status === 429 ? "AI quota exceeded." : (data.error?.message || (typeof data.error === "string" ? data.error : null) || `${provider} error ${res.status}`)
    throw res.status < 500 ? Object.assign(new Error(msg), { user: true }) : new Error(msg)
  }
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
