const { JSDOM } = require("jsdom")
const fs = require("fs")
const path = require("path")

function loadApp({ localStorage: initialStorage = {} } = {}) {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8")
    .replace(/<link rel="stylesheet"[^>]*>/, "")

  const prelude = Object.entries(initialStorage)
    .map(([k, v]) => `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(typeof v === "string" ? v : JSON.stringify(v))})`)
    .join("\n")

  return new JSDOM(
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
}

function waitFor(fn, { timeout = 2000, interval = 50 } = {}) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    function check() {
      try {
        resolve(fn())
      } catch (err) {
        if (Date.now() - start >= timeout) reject(err)
        else setTimeout(check, interval)
      }
    }
    check()
  })
}

module.exports = { loadApp, waitFor }
