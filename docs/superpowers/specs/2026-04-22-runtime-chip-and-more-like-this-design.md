# Runtime chip on unstarted posters + "More like this" seed in Mood

**Date:** 2026-04-22
**Status:** Approved for implementation planning

## Context

Next Watch is a no-clutter companion for Simkl / Trakt libraries. Its philosophy:
- Lazy-load; no bulk hydration.
- No server state beyond what the provider already owns.
- Ephemeral AI (mood picks, never stored).
- Dual Trakt/Simkl parity.
- Understated visual accents; the user shouldn't have to scroll.

This spec covers two small, additive features that fit that stance.

---

## Feature 1 — Runtime badge on unstarted posters

### Goal

Answer "do I have time for this tonight?" at a glance, without adding a row or a control.

### Scope

- **Where it shows:** corner overlay (top-right) on the poster image.
- **When it shows:** only when `isUnstarted(item, type) === true` (already computed in `src/posterCard.js`). In practice this means the Next view's plan-to-watch rows.
- **When it is skipped:** runtime is `0`, missing, or not a finite number; or the card is not unstarted (ongoing TV, watched items, trending, mood results).

### Data

- `runtime` is already on the normalized item for both providers:
  - Trakt: `src/traktUserData.js` (shows and movies), populated from `?extended=full` on watchlist/watched endpoints.
  - Simkl: `src/simklUserData.js`, populated from `?extended=full` on `sync/all-items`.
- Zero additional network calls. No changes to data fetchers.

### Format

- `runtime < 60` → `42m`
- `runtime >= 60` → round minutes to the nearest half-hour and render as `~1.5h`, `~2h`, `~2.5h`, etc. (Examples: 85 → `~1.5h`, 100 → `~1.5h`, 115 → `~2h`, 145 → `~2.5h`.)
- Missing/zero → chip is not rendered.

### Visual

- Dark glass chip, top-right corner of the poster image.
- Background: `rgba(0, 0, 0, 0.55)` with `backdrop-filter: blur(6px)`.
- Text: white, same small scale as existing `poster-title-meta`.
- ~4px inset from the top and right edges of the poster.
- No icon — text-only.

### Accessibility

- Chip is decorative (not a control). Exposed to AT via `aria-label` on the chip (e.g. `Runtime 42 minutes`).

### Impact

- `src/posterCard.js`: one render branch inside `_render` (gated on `isUnstarted && runtime > 0`).
- `src/posterCard.css`: one new rule for the overlay position/appearance.
- Small internal formatter helper co-located in `posterCard.js`.

### Tests

- Unstarted TV with `runtime: 45` → chip present with text `45m`.
- Unstarted movie with `runtime: 125` → chip present with text `~2h`.
- Unstarted movie with `runtime: 100` → chip present with text `~1.5h`.
- Unstarted item with `runtime: 0` → chip absent.
- Ongoing TV (`watched_episodes_count > 0`) → chip absent.
- Trending card with `variant !== "next"` → chip absent (unstarted is only computed in the `next` variant).

---

## Feature 2 — "More like this" seeded suggestions in Mood

### Goal

Let the user refine AI picks by saying "more like X", where X is a title they have an opinion on (watched or rated). Reuses the existing Mood surface — no new view, no new loading states.

### Entry point (trigger UI)

- A small sparkles (`✨`) button overlay on cards where `watched === true` OR `userRating != null`.
- Positioned top-left of the poster. (The runtime chip owns top-right; in practice both won't appear on the same card because runtime is unstarted-only and the ✨ is watched/rated-only, but top-left keeps them on independent axes regardless.)
- Button styled to match the existing `mark-watched-btn` / `add-watchlist-btn` scale and hover behavior; those two are suppressed on watched/rated cards today, so the corner slot is free.
- `aria-label="More like this"`, `title="More like this"`.

### Action

On tap, the card emits `poster:more-like-this` (bubbles). The app listener (in `src/next-watch.js`):

1. Switches to the Mood tab (same mechanism the existing mood nav uses).
2. Clears any active mood state (visual selection and internal state).
3. Sets `mediaType` to match the seeded item's type: `tv` → `tv`, `movie` → `movie`. Does not use `both`.
4. Renders a header in the Mood results area reading `More like <title> (<year>)`. The existing mood-label header is replaced, not duplicated.
5. Calls `fetchAiSuggestions({ provider, key, mediaType, library, seed: { title, year } })` — a new `seed` param, mutually exclusive with `mood`.
6. Renders results in the same `posters-row` the mood view already uses, with the same loading and error UI.

### Seed ↔ mood interaction

- **One-axis-at-a-time.** The seed is not combined with a mood.
- If the user taps a mood button after a seeded run, the seed is cleared and a normal mood prompt runs. Likewise, tapping ✨ on a new card while a mood is active clears the mood and runs the seed.
- The result header reflects whichever is active (mood label OR "More like X").

### AI prompt changes (`src/aiProvider.js`)

- `fetchAiSuggestions` accepts one of `{ mood }` or `{ seed }`, not both. If both are passed, `seed` wins (defensive; the UI won't send both).
- User message construction:
  - Mood path (unchanged): `${library}\nMood: ${label} — ${gloss}` (or just `${label}` if no gloss).
  - Seed path (new): `${library}\nSimilar to: ${title} (${year})` (year omitted if missing).
- System prompt: the line `Mood is the primary filter.` becomes `Mood or seed is the primary filter — weight library ratings as secondary signal.` All other constraints (IMDb ≥ 6.5, none appearing in Library, diversity rules, JSON output shape) are unchanged.
- The seeded title is guaranteed to already be in the library context (entry-point rule: watched or rated), so the existing `none appearing in Library` constraint already excludes it from results.

### Impact

- `src/posterCard.js`: new render branch for the ✨ button (gated on `watched || userRating != null`) and a `_emit("more-like-this")` on click.
- `src/posterCard.css`: one rule for the top-left button position.
- `src/aiProvider.js`: accept `seed`; one branch in user-message construction; one-line system-prompt tweak.
- `src/next-watch.js`: listen for `poster:more-like-this`; nav to Mood; clear mood state; set mediaType; render seeded header; call `fetchAiSuggestions` with `seed`.

### Tests

Per project testing rules (one behavior per test, MSW handlers in `test/clients/`, assertions inside handlers, role-based locators):

- Click ✨ on a rated trending card → Mood tab is active, header reads `More like <title> (<year>)`, and the AI request body (asserted inside the MSW handler for the chosen provider) contains `Similar to: <title> (<year>)` and no `Mood:` line.
- Click ✨ on a watched movie card → same as above, and the system prompt in the request body contains `movies only` (the existing `types.movie` branch in `aiProvider.js`).
- Click ✨ on a TV card → system prompt contains `TV shows only`.
- Seeded run followed by clicking a mood button → new request omits `Similar to:` and contains `Mood:`.
- Cards that are neither watched nor rated → ✨ button is absent.

---

## Non-goals

- No persistence of seed state across reloads. Like mood, seed is ephemeral.
- No "more like this" entry on Next view cards or on cards the user has no opinion on — scoping to watched/rated keeps the signal meaningful and the UI quiet.
- No combined mood+seed mode.
- No inline/modal results surface. All AI results continue to live in the Mood view.
- No changes to trending, Next ordering, or watchlist/mark-watched behavior.

## Risks / open considerations

- **Seed AI returns the seeded title anyway.** The system prompt already forbids library items, and the seed is always in the library. If a provider misbehaves, the current mood path has the same risk; no new mitigation needed.
- **Year missing on the seed item.** Fall back to `Similar to: <title>` without the year. Acceptable — title alone is usually enough.
- **MediaType scoping.** Forcing `tv` for a TV seed and `movie` for a movie seed is a choice, not a constraint. If it feels wrong in practice, the toggle still lets the user switch after the fact.
