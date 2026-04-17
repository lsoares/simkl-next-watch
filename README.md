# simkl-next-watch

Static app. No build step.

## Setup

```sh
npm install
brew install ngrok   # only needed for `npm run expose`
```

## Commands

- `npm test` — run Playwright tests.
- `npm run build` — minify `index.html` and copy assets into `dist/`.
- `npm run expose` — serve on `:8080`, tunnel via ngrok, and open the Simkl developer page so you can paste the ngrok URL as the redirect URI.

## Deploy

GitHub Actions builds on push to `main` and deploys `dist/` to GitHub Pages.
One-time setup: in repo Settings → Pages, set **Source** to **GitHub Actions**.
