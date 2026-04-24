# Always hide library items from Trending

## Goal

Remove the "Hide listed" toggle from the Trending view and make library-item
filtering unconditional. The app's value prop is "what do I watch next" —
titles already in the user's library (watching, watchlisted, watched, dropped)
are noise, and a toggle to opt into noise doesn't earn its UI weight.

## Behavior change

- Trending view always filters out any item present in the user's library
  (same `libraryLookup` rule the toggle uses today when on).
- The "View all" link at the end of each Trending row points at the provider's
  filtered destination — Simkl with `not_in_list=true`, Trakt with
  `ignore_watched=true` — so the external page mirrors what the in-app grid
  shows.

## UI

- Delete the `<label class="trending-filter-toggle">` checkbox and its
  wrapping toolbar styles.
- Add a single top-level intro paragraph inside `#trendingContent`, matching
  the `view-hint` pattern already used by Similar and Mood:

  ```html
  <p class="view-hint">What's trending right now — hiding titles already in your library.</p>
  ```

  Placement: first child of `#trendingContent`, above the `.trending-toolbar`
  that currently holds the period tabs. No new CSS.

## Code changes

- [index.html:103-105](../../../index.html#L103-L105) — remove the `Hide listed`
  checkbox label. Add the `view-hint` paragraph above `.trending-toolbar`.
- [src/next-watch.css](../../../src/next-watch.css) — delete the
  `.trending-filter-toggle` rules (if any).
- [src/next-watch.js:471-476](../../../src/next-watch.js#L471-L476) — drop
  `const hideWatched = …`; filter becomes
  `(item) => item.release_status !== "unreleased" && !libraryLookup(libraryIndex, item)`.
  Drop `browseParams` entirely — call
  `renderDiscoveryRow(el.trendingTvContent, tv, "tv")` with no third arg.
- [src/next-watch.js:947](../../../src/next-watch.js#L947) and
  [src/next-watch.js:981](../../../src/next-watch.js#L981) — remove the change
  listener and the boot-time preference read.
- [src/next-watch.js:77](../../../src/next-watch.js#L77) — remove the
  `hideWatched` entry from `STORAGE`.
- [src/simklRepository.js:123-130](../../../src/simklRepository.js#L123-L130)
  and [src/traktRepository.js:191-194](../../../src/traktRepository.js#L191-L194)
  — simplify `getTrendingBrowseUrl` to drop the `ignoreWatched` option and
  always emit the filtered variant.
- [src/next-watch.js:350](../../../src/next-watch.js#L350) — call site no
  longer passes `browseParams`.

## Persistence

Leave the existing `next-watch-hide-watched` localStorage key orphaned. It is
already swept on sign-out by the existing cleanup.

## Tests

- Delete [test/trending/toggleHideListed.test.js](../../../test/trending/toggleHideListed.test.js)
  — the behavior it covers no longer exists.
- [test/trending/view.test.js](../../../test/trending/view.test.js) Simkl test
  at lines 4-30 asserts a library item (Breaking Bad) shows a watchlist badge
  in the trending row. That item now disappears from trending. Remove
  Breaking Bad from the `useTrendingTv` feed and drop the
  `expectShowIsOnWatchlist` assertion — the test then only covers trending
  listing and the View-all link.
- Update the `expectViewAllSeriesLinksTo` URL assertions:
  - Simkl: `https://simkl.com/tv/best-shows/most-watched/?wltime=today&not_in_list=true`
  - Trakt: `https://app.trakt.tv/discover/trending?mode=show&ignore_watched=true`

## Non-goals

- No migration of the existing preference. Users who had "Hide listed" off
  will silently start seeing the new always-filtered view; that's the point.
- No analytics / toast explaining the change.
