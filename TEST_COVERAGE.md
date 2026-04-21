# Test coverage

The test suite (Playwright + route interception) covers these initial loads / user actions.

## Covered

- Sign-in intro (Simkl), Simkl OAuth redirect, Simkl logout
- Initial load: watching TV + next episode linking (Simkl, Trakt)
- Initial load: watchlist movies (Simkl, Trakt)
- Trakt: dropped/watched filtering, unreleased filter for shows + movies
- Trending view (logged-in and logged-out), trending-badge *absence* on a logged-in card
- Add-to-watchlist from trending (Simkl, Trakt)
- AI suggestions happy path across all 7 providers
- AI key dialog when no key, AI key save toast
- PWA install prompt

## Not covered (material gaps)

### Primary user actions

1. **Mark-as-watched click** — only button visibility is asserted ([loadPage.simkl.test.js:26](test/loadPage.simkl.test.js#L26), [loadPage.trakt.test.js:24](test/loadPage.trakt.test.js#L24)). The click path in [next-watch.js:403-415](src/next-watch.js#L403-L415) — API call, animation, toast with episode link, reload — is the core action and untested.
2. **Trakt sign-in** (OAuth redirect) and **Trakt logout** — only Simkl variants exist.
3. **Navigation between Next / Trending / AI** via nav links, plus `#trending` / `#ai` hash-based initial view ([next-watch.js:1048-1055](src/next-watch.js#L1048-L1055)).
4. **Trending period tabs** (today/week/month) — click + persistence ([next-watch.js:1012-1018](src/next-watch.js#L1012-L1018)).
5. **Hide-watched toggle** on trending ([next-watch.js:1010](src/next-watch.js#L1010)).
6. **AI TV/Movie toggle** — active state, filters suggestions ([next-watch.js:895-905](src/next-watch.js#L895-L905)).

### Initial-load states

7. **Trending badges (🔥)** — positive case untested (loadTrending only asserts `toHaveCount(0)`). No coverage that a show trending today on the Next row gets the 🔥 badge.
8. **"Watched" / "On watchlist" overlay badges** on trending/AI cards for items already in library ([next-watch.js:492-506](src/next-watch.js#L492-L506), [next-watch.js:150-154](src/next-watch.js#L150-L154)) — never asserted.
9. **Simkl "completed" filtering** and **Simkl unreleased filter** for the Next row (Trakt has it, Simkl doesn't).
10. **Lazy poster hydration** via `lookupByImdb` — the Trakt watchlist-only (no watched) path in [next-watch.js:572-603](src/next-watch.js#L572-L603) is only indirectly exercised.
11. **Returning user skips intro** — no explicit test that an existing token loads the library straight away.

### Error / edge paths

12. **OAuth callback error + state mismatch** ([next-watch.js:935-938](src/next-watch.js#L935-L938)).
13. **Sync / API failure** surfaces toast ([next-watch.js:477-479](src/next-watch.js#L477-L479)).
14. **AI 429 quota** and **AI parse error** ([next-watch.js:778](src/next-watch.js#L778), [next-watch.js:797](src/next-watch.js#L797)).
15. **AI with zero ratings** → "No ratings found" toast ([next-watch.js:822](src/next-watch.js#L822)).

The mark-as-watched click is the most glaring omission — it's the primary verb of the app.
