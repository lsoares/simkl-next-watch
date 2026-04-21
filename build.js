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
for (const f of ["next-watch.css", "next-watch.js", "simklCatalog.js", "simklUserData.js", "traktUserData.js", "cacheClient.js"]) {
  await copyFile(`src/${f}`, `dist/src/${f}`)
}

const globals = {
  __SIMKL_CLIENT_ID__: process.env.SIMKL_CLIENT_ID,
  __SIMKL_CLIENT_SECRET__: process.env.SIMKL_CLIENT_SECRET,
  __TRAKT_CLIENT_ID__: process.env.TRAKT_CLIENT_ID,
  __TRAKT_CLIENT_SECRET__: process.env.TRAKT_CLIENT_SECRET,
  __REDIRECT_URI__: process.env.REDIRECT_URI,
}
if (globals.__SIMKL_CLIENT_ID__ && globals.__SIMKL_CLIENT_SECRET__) {
  const body = Object.entries(globals)
    .filter(([, v]) => v)
    .map(([k, v]) => `window.${k}=${JSON.stringify(v)}`)
    .join(";") + "\n"
  await writeFile("dist/config.local.js", body)
} else {
  try {
    await copyFile("config.local.js", "dist/config.local.js")
  } catch {
    throw new Error("Missing SIMKL_CLIENT_ID or SIMKL_CLIENT_SECRET env vars and no config.local.js present — cannot build without credentials.")
  }
}

console.log(`index.html: ${html.length.toLocaleString()} → ${minified.length.toLocaleString()} bytes`)
