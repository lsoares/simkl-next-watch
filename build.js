#!/usr/bin/env node
import { minify } from "html-minifier-terser"
import { readFile, writeFile, mkdir, copyFile, rm } from "node:fs/promises"

await rm("dist", { recursive: true, force: true })
await mkdir("dist", { recursive: true })

const html = await readFile("index.html", "utf8")
const minified = await minify(html, {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  minifyJS: true,
  removeRedundantAttributes: true,
  useShortDoctype: true,
})
await writeFile("dist/index.html", minified)

await mkdir("dist/src", { recursive: true })
await mkdir("dist/assets", { recursive: true })
for (const f of ["sw.js"]) {
  await copyFile(f, `dist/${f}`)
}
for (const f of ["manifest.json", "favicon.ico", "icon.png", "simkl.png", "trakt.png"]) {
  await copyFile(`assets/${f}`, `dist/assets/${f}`)
}
for (const f of ["next-watch.css", "next-watch.js", "simklCatalog.js", "simklUserData.js"]) {
  await copyFile(`src/${f}`, `dist/src/${f}`)
}

const clientId = process.env.SIMKL_CLIENT_ID
const clientSecret = process.env.SIMKL_CLIENT_SECRET
if (clientId && clientSecret) {
  await writeFile("dist/config.local.js", `window.__SIMKL_CLIENT_ID__=${JSON.stringify(clientId)};window.__SIMKL_CLIENT_SECRET__=${JSON.stringify(clientSecret)}\n`)
} else {
  try {
    await copyFile("config.local.js", "dist/config.local.js")
  } catch {
    throw new Error("Missing SIMKL_CLIENT_ID or SIMKL_CLIENT_SECRET env vars and no config.local.js present — cannot build without credentials.")
  }
}

console.log(`index.html: ${html.length.toLocaleString()} → ${minified.length.toLocaleString()} bytes`)
