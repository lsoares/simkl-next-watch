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
- **When it shows:** only when `isUnstarted(item, type) === true` (already computed in `src/posterCard.js`). In practice this means the Next view's plan-to-watch rows.
- **When it is skipped:** runtime is `0`, missing, or not a finite number; or the card is not unstarted (ongoing TV, watched items, trending, mood results).

## Data

- `runtime` is already on the normalized item for both providers:
  - Trakt: `src/traktUserData.js` (shows and movies), populated from `?extended=full` on watchlist/watched endpoints.
  - Simkl: `src/simklUserData.js`, populated from `?extended=full` on `sync/all-items`.
- Zero additional network calls. No changes to data fetchers.

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

- `src/posterCard.js`: one render branch inside `_render` (gated on `isUnstarted && runtime > 0`).
- `src/posterCard.css`: one new rule for the overlay position/appearance.
- Small internal formatter helper co-located in `posterCard.js`.

## Tests

Per project testing rules (one behavior per test, role-based locators, no shared state):

- Unstarted TV with `runtime: 45` → chip present with text `45m`.
- Unstarted movie with `runtime: 125` → chip present with text `~2h`.
- Unstarted movie with `runtime: 100` → chip present with text `~1.5h`.
- Unstarted item with `runtime: 0` → chip absent.
- Ongoing TV (`watched_episodes_count > 0`) → chip absent.
- Trending card with `variant !== "next"` → chip absent (unstarted is only computed in the `next` variant).

## Non-goals

- No persistence, no settings toggle, no user preference.
- No runtime display on ongoing, watched, trending, or mood cards.
- No changes to data fetchers or normalization.
