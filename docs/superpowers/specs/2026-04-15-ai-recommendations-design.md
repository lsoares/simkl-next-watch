# AI Recommendations Screen

## Overview

A new "ai" screen in Next Watch that uses OpenAI or Claude to suggest 3 movies/shows based on the user's ratings and a selected mood/genre prompt. Results display as poster cards. Requires an API key configured in-screen.

## Navigation

- New nav tab "ai" between "trending" and "login"
- Route: `#ai`
- Only visible when logged in (same as "next" and "trending")

## AI Provider Setup

Blocks the screen until configured (same pattern as login/auth setup).

- **Provider dropdown:** OpenAI / Claude
- **API key input:** password field
- **Storage:** `localStorage` keys `next-watch-ai-provider` and `next-watch-ai-key`
- **Cleared on logout** (add to `clearAllStorage` / `logout` function)
- **After setup:** screen shows prompt buttons; a small "edit settings" link at the top allows reconfiguring provider/key

## Prompt Buttons

10 buttons rendered in a grid/flow layout:

1. Cozy night in
2. Edge of my seat
3. Make me laugh
4. Mind-bending
5. Epic adventure
6. True stories
7. Hidden gems
8. Date night
9. Feel-good
10. Dark & gritty

Each button triggers the recommendation flow with its label as the mood context.

## Recommendation Flow

### 1. Build compact ratings input

Collect all items (shows + movies + anime) from the sync cache that have a `user_rating`. Format as a compact comma-separated string:

```
Breaking Bad:9,The Office:8,Inception:10,Parasite:9
```

Skip items with `user_rating === null`. This minimizes tokens sent to the AI.

### 2. Cache check

- Cache key: `prompt label + ratings string` (simple string concatenation or hash)
- In-memory cache object with 5-minute TTL
- If cache hit, skip API call and go to step 5

### 3. Send to AI

**System prompt:**
```
You suggest movies and TV shows. Return exactly 3 suggestions as a JSON array: [{"title":"...","year":...}]. No other text. Avoid suggesting anything from the user's list. Prefer quality matches over popularity.
```

**User message:**
```
My ratings: Breaking Bad:9,The Office:8,...
Mood: Edge of my seat
```

**OpenAI adapter:**
```js
POST https://api.openai.com/v1/chat/completions
Headers: Authorization: Bearer <key>, Content-Type: application/json
Body: { model: "gpt-4o-mini", messages: [{role:"system",content:SYSTEM},{role:"user",content:USER}], temperature: 0.9 }
Response: data.choices[0].message.content
```

**Claude adapter:**
```js
POST https://api.anthropic.com/v1/messages
Headers: x-api-key: <key>, anthropic-version: 2023-06-01, Content-Type: application/json, anthropic-dangerous-direct-browser-access: true
Body: { model: "claude-sonnet-4-20250514", max_tokens: 256, system: SYSTEM, messages: [{role:"user",content:USER}], temperature: 0.9 }
Response: data.content[0].text
```

### 4. Parse AI response

Parse the response as JSON. Extract the array of `{title, year}` objects. If parsing fails, show an error toast.

### 5. Resolve to Simkl entries

For each suggestion, call Simkl search API:
```
GET /search/multi/?q=<title>&type=movie,tv&limit=1
```

Use the first result to get poster, Simkl URL, and IMDb rating. If no result found for a suggestion, skip it.

### 6. Render results

Display results as poster cards in a horizontal row, same style as trending cards (reuse `renderTrendingCard` or similar). Each card links to the Simkl page. Show "add to watchlist" button if logged in and not already in library.

## Error Handling

- **API errors** (bad key, rate limit, network): show in toast via `ApiError` + `handleError`
- **JS runtime errors**: console.error only (existing pattern)
- **Empty/invalid AI response**: toast "Couldn't parse suggestions, try again"

## Storage Keys

Add to `STORAGE` object:
- `aiProvider`: `"next-watch-ai-provider"`
- `aiKey`: `"next-watch-ai-key"`

Both cleared in `logout()`.

## UI States

1. **No API key configured:** setup form (provider dropdown + key input + save button), blocks interaction
2. **Configured, idle:** prompt buttons grid + "edit settings" link at top
3. **Loading:** spinner (reuse existing)
4. **Results:** 3 poster cards in a row below the prompt buttons
5. **Error:** toast message
