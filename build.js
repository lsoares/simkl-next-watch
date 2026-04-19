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

for (const f of ["next-watch.css", "next-watch.js", "manifest.json", "favicon.ico", "icon.png", "sw.js", "simklRepository.js"]) {
  await copyFile(f, `dist/${f}`)
}

const clientId = process.env.SIMKL_CLIENT_ID || ""
const clientSecret = process.env.SIMKL_CLIENT_SECRET || ""
const redirectUri = process.env.SIMKL_REDIRECT_URI || ""
if (clientId && clientSecret) {
  await writeFile("dist/config.local.js", `window.__SIMKL_CLIENT_ID__=${JSON.stringify(clientId)};window.__SIMKL_CLIENT_SECRET__=${JSON.stringify(clientSecret)};window.__SIMKL_REDIRECT_URI__=${JSON.stringify(redirectUri)}\n`)
} else {
  try {
    await copyFile("config.local.js", "dist/config.local.js")
  } catch {
    await writeFile("dist/config.local.js", `window.__SIMKL_CLIENT_ID__="";window.__SIMKL_CLIENT_SECRET__="";window.__SIMKL_REDIRECT_URI__=""\n`)
    console.warn("No SIMKL_CLIENT_ID/SECRET env vars and no config.local.js — shipped with empty credentials.")
  }
}

console.log(`index.html: ${html.length.toLocaleString()} → ${minified.length.toLocaleString()} bytes`)
