# Runtime chip on unstarted posters

**Date:** 2026-04-22
**Status:** Approved for implementation planning

## Context

Next Watch is a no-clutter companion for Simkl / Trakt libraries. Its philosophy:
- Lazy-load; no bulk hydration.
- No server state beyond what the provider already owns.
- Understated visual accents; the user shouldn't have to scroll.

This spec covers one small additive feature that fits that stance.

## Goal

Answer "do I have time for this tonight?" at a glance, without adding a row or a control.

## Scope

- **Where it shows:** corner overlay (top-right) on the poster image.
- **When it shows:** on every card where the item is **not already watched** (`watched !== true`) and `runtime > 0`. That covers Next (unstarted and ongoing), Trending (unseen), and Mood results.
- **When it is skipped:** `watched === true` (already seen), or `runtime` is `0`, missing, or not a finite number.

## Data

- `runtime` is already on the normalized item for both providers' library endpoints:
  - Trakt: `src/traktUserData.js`, populated from `?extended=full` on watchlist/watched endpoints.
  - Simkl: `src/simklUserData.js`, populated from `?extended=full` on `sync/all-items`.
- For **Trakt trending** (`/shows/watched/{period}` and `/movies/watched/{period}`): the base payload omits `runtime`, so add `&extended=full` to the existing call. This is the **same** endpoint — not a new request.
- For **Simkl trending** (`data.simkl.in/discover/trending/...`): the public snapshot already includes `runtime` as a display string (e.g. `"2h 37m"`). Parse it to minutes inside `enrichTrending` so the normalized shape stays numeric.
- **No new network requests.**

## Format

- `runtime < 60` → `42m`
- `runtime >= 60` → round minutes to the nearest half-hour and render as `~1.5h`, `~2h`, `~2.5h`, etc. (Examples: 85 → `~1.5h`, 100 → `~1.5h`, 115 → `~2h`, 145 → `~2.5h`.)
- Missing/zero → chip is not rendered.

## Visual

- Dark glass chip, top-right corner of the poster image.
- Background: `rgba(0, 0, 0, 0.55)` with `backdrop-filter: blur(6px)`.
- Text: white, same small scale as existing `poster-title-meta`.
- ~4px inset from the top and right edges of the poster.
- No icon — text-only.

## Accessibility

- Chip is decorative (not a control). Exposed to AT via `aria-label` on the chip (e.g. `Runtime 42 minutes`).

## Impact

- `src/posterCard.js`: one render branch inside `_render` (gated on `!watched && runtime > 0`) plus a small internal formatter helper.
- `src/posterCard.css`: one new rule for the overlay position/appearance.
- `src/traktUserData.js`: append `&extended=full` to the two trending calls in `getTrending`.
- `src/simklCatalog.js`: parse `item.runtime` string to minutes inside `enrichTrending`.

## Tests

Per project testing rules (one behavior per test, role-based locators, no shared state):

- Watchlist show with `runtime: 45` → chip present with text `45m`.
- Watchlist movie with `runtime: 125` → chip present with text `~2h`.
- Watchlist movie with `runtime: 100` → chip present with text `~1.5h`.
- Trending item that the user has already watched → chip absent.

## Non-goals

- No persistence, no settings toggle, no user preference.
- No runtime display on already-watched items.
- No new network requests (we enrich existing ones).
