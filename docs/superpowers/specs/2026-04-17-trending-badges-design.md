# Trending Badges on Posters — Design

## Goal

Show a small "🔥 Today" / "🔥 Week" / "🔥 Month" pill overlay on each poster in
the **Next** and **AI** views when the item appears in the corresponding
trending list from `data.simkl.in`. The **Trending** view itself does not
render the badge (the whole view is already trending — redundant).

## Priority

When an item appears in more than one period, show the most specific badge:
`today` > `week` > `month`. Today means the freshest heat, which is the most
useful signal.

## Badge UI

- Pill overlay, absolute top-left of the poster image.
- Short text: `🔥 Today` / `🔥 Week` / `🔥 Month`.
- `title` attribute (tooltip) carries the full phrase: `Trending today`,
  `Trending this week`, `Trending this month`.
- Non-interactive.

## Data loading

- A single loader `loadTrendingBadgeSets()`:
  - Fetches all 6 JSONs in parallel:
    `https://data.simkl.in/discover/trending/{tv,movies}/{today,week,month}_100.json`.
  - Builds `{ today: Set<simklId>, week: Set<simklId>, month: Set<simklId> }`
    (TV + movies merged per period).
  - Memoizes the result (module-level cached promise) so subsequent calls
    return the same promise.
- Triggered lazily on first render of the Next view and the AI results.
- No in-app cache layer beyond memoization. The CDN sets
  `Cache-Control: max-age=3600` and the service worker serves repeats, which
  covers HTTP-level de-duplication.

## Lookup helper

```js
function trendingPeriodFor(simklId, sets) {
  if (!simklId || !sets) return null;
  if (sets.today.has(simklId)) return "today";
  if (sets.week.has(simklId)) return "week";
  if (sets.month.has(simklId)) return "month";
  return null;
}
```

Pure. No DOM, no fetch.

## `PosterCard` integration

- New property `showTrending` (default `false`).
- Set to `true` in the Next rendering path and in the AI results rendering
  path. Trending view leaves it unset.
- New property `trendingPeriod` (string or null). Populated by the caller
  after the lookup.
- Template inserts the badge element when both `showTrending` and
  `trendingPeriod` are truthy.

## Rendering flow

1. Next / AI render path awaits `loadTrendingBadgeSets()`.
2. For each item, compute `trendingPeriod` via the lookup helper using the
   item's simkl ID.
3. Assign `card.showTrending = true` and `card.trendingPeriod = <period>`.

If the trending-data fetch fails or is still pending when rendering occurs,
posters render without badges. No re-render is forced just to attach a
decorative badge.

## CSS

New rule in `next-watch.css`:

- `.trending-badge` — absolute, top-left, small pill; warm accent background
  with high-contrast text; small uppercase label. Matches the style language
  of existing overlays (`.imdb-badge`).

## Tests

New file `test/trending-badges.test.js` (one-file-per-feature per the
project's testing rules).

Scenarios:

1. Badge appears on a Next poster whose simkl ID is in `today` set, text is
   `🔥 Today`, tooltip is `Trending today`.
2. Priority: an item present in all three lists shows `Today`.
3. Trending view does **not** render a badge, even for items that are (by
   definition) in the trending set.
4. Badge appears on an AI suggestion poster whose simkl ID is in the `week`
   set; tooltip is `Trending this week`.

Support:

- `mockTrending({ today, week, month })` helper in `test/clients/simkl.js`
  registers MSW handlers for the 6 trending URLs. Each entry is `{ tv: [],
  movies: [] }`. Handler asserts the request is a plain GET with no extra
  params.
- `onUnhandledRequest: "error"` still applies.
- Uses role-based queries only. No order assertions; presence-only.

## Files touched

- `index.html` — loader, lookup helper, `PosterCard` badge markup + props,
  wiring in Next render and AI render.
- `next-watch.css` — `.trending-badge` rule.
- `test/clients/simkl.js` — `mockTrending` helper.
- `test/trending-badges.test.js` — new file, four scenarios.

## Out of scope

- Invalidation / refresh of trending data mid-session. CDN TTL handles it.
- Showing badges in the trending view.
- Per-type (TV vs movie) badge differentiation.
- Any server-side changes.
