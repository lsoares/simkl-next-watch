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

console.log(`index.html: ${html.length.toLocaleString()} → ${minified.length.toLocaleString()} bytes`)
