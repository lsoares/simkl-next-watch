import { test } from "./test.js"

// libraryIndex keys off imdb/trakt ids for Trakt items, but trending cards
// look up by simkl_id. Until the cross-ref is bridged (via TMDB or a simkl
// hydration step on library items) the hide-listed toggle silently no-ops
// for Trakt users.
test.skip("hide-listed toggle removes library items from the trending row", async () => {})
