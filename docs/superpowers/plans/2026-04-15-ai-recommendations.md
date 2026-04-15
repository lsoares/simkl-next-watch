# AI Recommendations Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an AI-powered recommendations screen that suggests 3 movies/shows based on user ratings and mood selection, supporting Gemini (free), OpenAI, and Claude providers.

**Architecture:** Single-file addition to `index.html` — new HTML view, new storage keys, AI provider adapters, Simkl search resolution, and result rendering. CSS additions in `next-watch.css`. No build step, no modules.

**Tech Stack:** Vanilla JS, Simkl API, Gemini/OpenAI/Claude REST APIs

---

### Task 1: Add storage keys and clear on logout

**Files:**
- Modify: `index.html:341-354` (STORAGE object and clearAllStorage)

- [ ] **Step 1: Add AI storage keys to STORAGE object**

In `index.html`, find the `STORAGE` object (~line 341) and add two new keys:

```js
const STORAGE = {
  clientId: "next-watch-client-id",
  clientSecret: "next-watch-client-secret",
  accessToken: "next-watch-access-token",
  syncCache: "next-watch-sync-cache",
  trendingPeriod: "next-watch-trending-period",
  hideWatched: "next-watch-hide-watched",
  episodeCache: "next-watch-episode-cache",
  aiProvider: "next-watch-ai-provider",
  aiKey: "next-watch-ai-key",
};
```

- [ ] **Step 2: Verify clearAllStorage covers new keys**

`clearAllStorage` iterates `Object.values(STORAGE)`, so the new keys are automatically cleared on logout. No code change needed — just verify this by reading the function.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add AI provider storage keys"
```

---

### Task 2: Add AI view HTML and nav tab

**Files:**
- Modify: `index.html:16-22` (nav bar)
- Modify: `index.html:89` (before closing `</main>`, add AI view)

- [ ] **Step 1: Add nav button**

In the nav bar (`<div class="top-bar-scroll">`), add the "ai" button between "trending" and "login":

```html
<button id="navNext" class="tiny-link active-nav" type="button">next</button>
<button id="navTrending" class="tiny-link" type="button">trending</button>
<button id="navAi" class="tiny-link" type="button">ai</button>
<button id="navLogin" class="tiny-link" type="button">login</button>
<button id="installButton" class="tiny-link hidden" type="button">install</button>
```

- [ ] **Step 2: Add AI view HTML**

Before the closing `</main>` tag, add the AI view. It has two states: setup form (blocks until configured) and the prompt buttons + results area.

```html
<!-- AI view -->
<div id="aiView" hidden>
  <div id="aiSetup">
    <p class="field-help">Get AI-powered recommendations based on your ratings. Pick a provider and paste your API key.
      Get a key: <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Gemini (free)</a> &middot; <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI</a> &middot; <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">Claude</a>
    </p>
    <div style="margin-bottom:12px">
      <label for="aiProviderSelect">Provider</label>
      <select id="aiProviderSelect">
        <option value="gemini">Gemini (free)</option>
        <option value="openai">OpenAI</option>
        <option value="claude">Claude</option>
      </select>
    </div>
    <div style="margin-bottom:12px">
      <label for="aiKeyInput">API Key</label>
      <input id="aiKeyInput" type="password" autocomplete="off" />
    </div>
    <button class="secondary" id="aiSaveBtn" type="button">Save</button>
  </div>
  <div id="aiMain" hidden>
    <div class="ai-toolbar">
      <button class="tiny-link" id="aiEditSettings" type="button">edit settings</button>
    </div>
    <div class="ai-prompts" id="aiPrompts">
      <button class="ai-prompt-btn" type="button">Cozy night in</button>
      <button class="ai-prompt-btn" type="button">Edge of my seat</button>
      <button class="ai-prompt-btn" type="button">Make me laugh</button>
      <button class="ai-prompt-btn" type="button">Mind-bending</button>
      <button class="ai-prompt-btn" type="button">Epic adventure</button>
      <button class="ai-prompt-btn" type="button">True stories</button>
      <button class="ai-prompt-btn" type="button">Hidden gems</button>
      <button class="ai-prompt-btn" type="button">Date night</button>
      <button class="ai-prompt-btn" type="button">Feel-good</button>
      <button class="ai-prompt-btn" type="button">Dark & gritty</button>
    </div>
    <div id="aiResults" class="items-row"></div>
  </div>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "Add AI view HTML and nav tab"
```

---

### Task 3: Add AI view CSS

**Files:**
- Modify: `next-watch.css` (append AI-specific styles)

- [ ] **Step 1: Add CSS for AI view**

Append to `next-watch.css`:

```css
/* ── AI view ── */

#aiView select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--panel-border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font-size: 1rem;
  margin-top: 4px;
}

.ai-toolbar {
  text-align: right;
  margin-bottom: 12px;
}

.ai-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}

.ai-prompt-btn {
  padding: 8px 16px;
  border: 1px solid var(--panel-border);
  border-radius: 20px;
  background: transparent;
  color: var(--text);
  font-size: 0.85rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.ai-prompt-btn:hover {
  border-color: var(--accent);
  background: rgba(34, 197, 94, 0.08);
}

.ai-prompt-btn.active {
  border-color: var(--accent);
  background: rgba(34, 197, 94, 0.15);
}
```

- [ ] **Step 2: Commit**

```bash
git add next-watch.css
git commit -m "Add AI view styles"
```

---

### Task 4: Wire navigation and element refs

**Files:**
- Modify: `index.html:461-472` (el object)
- Modify: `index.html:700-715` (showView function)
- Modify: `index.html:800-815` (event listeners)
- Modify: `index.html:837-843` (boot hash routing)

- [ ] **Step 1: Add element refs**

In the `el` object, add the new elements:

```js
const el = {
  topBar: $("topBar"), navNext: $("navNext"), navTrending: $("navTrending"), navAi: $("navAi"), navLogin: $("navLogin"),
  loginView: $("loginView"), appIntro: $("appIntro"), authSetup: $("authSetup"), loginStatusNote: $("loginStatusNote"), loginNewNote: $("loginNewNote"), redirectHint: $("redirectHint"), copyRedirectBtn: $("copyRedirectBtn"),
  clientIdInput: $("clientIdInput"), clientSecretInput: $("clientSecretInput"), connectBtn: $("connectBtn"),
  logoutArea: $("logoutArea"), logoutBtn: $("logoutBtn"), getStartedBtn: $("getStartedBtn"),
  nextView: $("nextView"), tvRow: $("tvRow"), movieRow: $("movieRow"),
  trendingView: $("trendingView"), trendingPeriodTabs: $("trendingPeriodTabs"),
  hideTrendingWatched: $("hideTrendingWatched"),
  trendingTvContent: $("trendingTvContent"), trendingMoviesContent: $("trendingMoviesContent"),
  aiView: $("aiView"), aiSetup: $("aiSetup"), aiMain: $("aiMain"),
  aiProviderSelect: $("aiProviderSelect"), aiKeyInput: $("aiKeyInput"), aiSaveBtn: $("aiSaveBtn"),
  aiEditSettings: $("aiEditSettings"), aiPrompts: $("aiPrompts"), aiResults: $("aiResults"),
  spinner: $("loadingSpinner"), toast: $("toast"), installBtn: $("installButton"),
};
```

- [ ] **Step 2: Update showView**

Update the `showView` function to include the AI view:

```js
function showView(name) {
  currentView = name;
  el.loginView.hidden = name !== "login";
  el.nextView.hidden = name !== "next";
  el.trendingView.hidden = name !== "trending";
  el.aiView.hidden = name !== "ai";
  [el.navNext, el.navTrending, el.navAi, el.navLogin].forEach((btn) => btn.classList.remove("active-nav"));
  if (name === "next") el.navNext.classList.add("active-nav");
  if (name === "trending") el.navTrending.classList.add("active-nav");
  if (name === "ai") el.navAi.classList.add("active-nav");
  if (name === "login") el.navLogin.classList.add("active-nav");
  if (name === "trending") loadTrending();
  if (name === "ai") hydrateAiView();
  const hash = name === "next" ? "" : `#${name}`;
  if (location.hash !== hash) history.replaceState(null, "", hash || location.pathname);
}
```

- [ ] **Step 3: Add nav click listener**

Add after the existing nav listeners:

```js
el.navAi.addEventListener("click", () => showView("ai"));
```

- [ ] **Step 4: Update boot hash routing**

Update the hash check at boot to recognize `"ai"`:

```js
if (isLoggedIn()) {
  const hash = location.hash.replace("#", "").split("/")[0];
  showView(hash === "trending" ? "trending" : hash === "ai" ? "ai" : hash === "login" ? "login" : "next");
  loadSuggestions();
}
```

- [ ] **Step 5: Add hydrateAiView function stub**

Add after the trending section, before the Navigation section:

```js
// ── AI ──

function hydrateAiView() {
  const hasKey = !!readStorage(STORAGE.aiKey);
  el.aiSetup.hidden = hasKey;
  el.aiMain.hidden = !hasKey;
  if (hasKey) {
    el.aiProviderSelect.value = readStorage(STORAGE.aiProvider) || "gemini";
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Wire AI view navigation and element refs"
```

---

### Task 5: Implement AI setup form (save/edit settings)

**Files:**
- Modify: `index.html` (event listeners section)

- [ ] **Step 1: Add save and edit settings handlers**

Add these event listeners alongside the existing ones:

```js
el.aiSaveBtn.addEventListener("click", () => {
  const key = el.aiKeyInput.value.trim();
  if (!key) { showToast("Enter an API key.", true); return; }
  writeStorage(STORAGE.aiProvider, el.aiProviderSelect.value);
  writeStorage(STORAGE.aiKey, key);
  el.aiKeyInput.value = "";
  hydrateAiView();
  showToast("AI provider saved.");
});

el.aiEditSettings.addEventListener("click", () => {
  el.aiSetup.hidden = false;
  el.aiMain.hidden = true;
  el.aiProviderSelect.value = readStorage(STORAGE.aiProvider) || "gemini";
  el.aiKeyInput.value = readStorage(STORAGE.aiKey);
});
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "Implement AI setup form save and edit"
```

---

### Task 6: Build compact ratings input

**Files:**
- Modify: `index.html` (pure domain functions section, ~line 96)

- [ ] **Step 1: Add buildRatingsInput as a pure function**

Add in the pure domain functions section (near the top, before the storage section):

```js
function buildRatingsInput(shows, movies, anime) {
  return [...(shows || []), ...(movies || []), ...(anime || [])]
    .filter((item) => item.user_rating != null)
    .map((item) => `${item.title}:${item.user_rating}`)
    .join(",");
}
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "Add buildRatingsInput pure function"
```

---

### Task 7: Implement AI provider adapters

**Files:**
- Modify: `index.html` (after the AI hydration section)

- [ ] **Step 1: Add the AI completion function with all three adapters**

Add after `hydrateAiView`:

```js
const AI_SYSTEM = "You suggest movies and TV shows. Return exactly 3 suggestions as a JSON array: [{\"title\":\"...\",\"year\":...}]. No other text. Avoid suggesting anything from the user's list. Prefer quality matches over popularity.";

async function aiComplete(provider, key, userMessage) {
  if (provider === "gemini") {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: AI_SYSTEM + "\n\n" + userMessage }] }], generationConfig: { temperature: 0.9 } }),
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(data.error?.message || `Gemini error ${res.status}`);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
  if (provider === "openai") {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: AI_SYSTEM }, { role: "user", content: userMessage }], temperature: 0.9 }),
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(data.error?.message || `OpenAI error ${res.status}`);
    return data.choices?.[0]?.message?.content || "";
  }
  if (provider === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json", "anthropic-dangerous-direct-browser-access": "true" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 256, system: AI_SYSTEM, messages: [{ role: "user", content: userMessage }], temperature: 0.9 }),
    });
    const data = await res.json();
    if (!res.ok) throw new ApiError(data.error?.message || `Claude error ${res.status}`);
    return data.content?.[0]?.text || "";
  }
  throw new ApiError("Unknown AI provider");
}
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "Add AI provider adapters (Gemini, OpenAI, Claude)"
```

---

### Task 8: Implement recommendation flow with caching and Simkl search

**Files:**
- Modify: `index.html` (after aiComplete)

- [ ] **Step 1: Add the full recommendation flow**

```js
const aiCache = {};
const AI_CACHE_TTL = 5 * 60 * 1000;

async function getRecommendations(mood) {
  const cache = readJsonStorage(STORAGE.syncCache);
  const ratings = buildRatingsInput(cache?.shows, cache?.movies, cache?.anime);
  if (!ratings) { showToast("No ratings found. Rate some titles first.", true); return []; }

  const cacheKey = mood + "|" + ratings;
  const cached = aiCache[cacheKey];
  if (cached && Date.now() - cached.ts < AI_CACHE_TTL) return cached.data;

  const provider = readStorage(STORAGE.aiProvider) || "gemini";
  const key = readStorage(STORAGE.aiKey);
  const userMessage = `My ratings: ${ratings}\nMood: ${mood}`;
  const raw = await aiComplete(provider, key, userMessage);

  let suggestions;
  try {
    const parsed = JSON.parse(raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim());
    suggestions = Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new ApiError("Couldn't parse AI suggestions. Try again.");
  }

  const results = await Promise.all(suggestions.slice(0, 3).map(async (s) => {
    const q = `${s.title} ${s.year || ""}`.trim();
    const search = await apiFetch(`/search/multi/?q=${encodeURIComponent(q)}&limit=1`);
    const match = Array.isArray(search) ? search[0] : null;
    return match || null;
  }));

  const filtered = results.filter(Boolean);
  aiCache[cacheKey] = { ts: Date.now(), data: filtered };
  return filtered;
}
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "Implement AI recommendation flow with caching and Simkl search"
```

---

### Task 9: Wire prompt buttons to render results

**Files:**
- Modify: `index.html` (after getRecommendations)

- [ ] **Step 1: Add prompt button click handler and result rendering**

```js
function renderAiResults(items) {
  if (!items.length) {
    el.aiResults.innerHTML = `<p class="empty">No results found.</p>`;
    return;
  }
  el.aiResults.innerHTML = items.map((item) => {
    const urlBase = item.type === "movie" ? "movies" : "tv";
    const watched = libraryIds.has(String(item.ids?.simkl_id || item.ids?.simkl || ""));
    return `<div class="row-item">${renderTrendingCard(item, urlBase, watched, true)}</div>`;
  }).join("");
  for (const btn of el.aiResults.querySelectorAll(".add-watchlist-btn")) setupAddWatchlistBtn(btn);
}

el.aiPrompts.addEventListener("click", async (e) => {
  const btn = e.target.closest(".ai-prompt-btn");
  if (!btn) return;
  el.aiPrompts.querySelectorAll(".ai-prompt-btn").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  el.aiResults.innerHTML = `<p class="empty">Thinking...</p>`;
  try {
    const items = await getRecommendations(btn.textContent);
    renderAiResults(items);
  } catch (err) {
    el.aiResults.innerHTML = "";
    handleError(err);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "Wire AI prompt buttons to render recommendation results"
```

---

### Task 10: Manual test in browser

- [ ] **Step 1: Start dev server and open the app**

```bash
npx serve .
```

Open in browser. Log in with Simkl credentials.

- [ ] **Step 2: Test AI setup flow**

1. Click "ai" tab — should see the setup form
2. Select "Gemini (free)", paste a Gemini API key, click Save
3. Should see prompt buttons and "edit settings" link
4. Click "edit settings" — should return to setup form with key pre-filled

- [ ] **Step 3: Test recommendation flow**

1. Click a prompt button (e.g. "Make me laugh")
2. Should show "Thinking..." then 3 poster cards
3. Click the same button again — should return cached results instantly
4. Click a different button — should make a new AI call

- [ ] **Step 4: Test edge cases**

1. Logout — AI key should be cleared
2. Log back in, go to AI tab — should show setup form again
3. Enter an invalid API key, click a prompt — should show error toast
4. Test with OpenAI and Claude providers if keys available

- [ ] **Step 5: Commit any fixes**

```bash
git add index.html next-watch.css
git commit -m "Fix AI recommendations after browser testing"
```
