const { JSDOM } = require("jsdom")
const fs = require("fs")
const path = require("path")

function loadApp({ localStorage: initialStorage = {} } = {}) {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8")
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

module.exports = { loadApp }
