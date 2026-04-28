# Reddit post — r/SideProject

**Title:** I built a no-clutter companion for Trakt/Simkl that shows the exact next episode across all your shows

**Body:**

Got tired of opening Trakt/Simkl and hunting for "what was I watching again?" across 15 ongoing shows. So I built **Next Watch** — a static web app that just answers that question.

**What it does:**
- **Next** — the exact episode you're on for every show you're watching, one tap to mark it watched
- **Trending** — what's hot today/this week/this month, one tap to add to your watchlist
- **Similar** — pick a title you love, find more like it
- **Mood** — AI-picked suggestions tuned to your ratings (BYO key: Gemini, OpenAI, Claude, Grok, Groq, DeepSeek, or OpenRouter)

**Stack:** Plain HTML/JS, no framework, no build step. Just a static app served from GitHub Pages. Auth and data live in your Trakt/Simkl account — I don't run a server.

**Live:** https://lsoares.github.io/simkl-next-watch/
**Code:** https://github.com/lsoares/simkl-next-watch

Feedback welcome — especially if you watch a lot of shows and have ideas for the Next view.
