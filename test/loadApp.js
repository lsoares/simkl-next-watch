import { JSDOM } from "jsdom"
import fs from "fs"
import { fileURLToPath } from "url"
import { dirname, join } from "path"

export function loadApp({ localStorage: initialStorage = {} } = {}) {
  const html = fs.readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "index.html"), "utf8")
    .replace(/<link rel="stylesheet"[^>]*>/, "")

  const prelude = Object.entries(initialStorage)
    .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(typeof v === "string" ? v : JSON.stringify(v))})`)
    .join("\n")

  const dom = new JSDOM(
    html.replace("<script>", `<script>${prelude}\n`),
    {
      url: "https://localhost/",
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true,
      beforeParse(window) {
        window.fetch = globalThis.fetch
        window.navigator.serviceWorker = { register: () => Promise.resolve() }
        window.matchMedia = () => ({ matches: false, addEventListener: () => {} })
      },
    },
  )
  return dom.window.document
}
