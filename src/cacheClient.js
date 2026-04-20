export function createCacheClient(storageKey) {
  return {
    async read() {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null
      try {
        return await decompressJson(raw)
      } catch {
        return null
      }
    },

    async write(payload) {
      try {
        localStorage.setItem(storageKey, await compressJson(payload))
      } catch (err) {
        localStorage.removeItem(storageKey)
        console.warn("Cache not persisted:", err?.message || err)
      }
    },
  }
}

async function compressJson(obj) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj))
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer())
  let bin = ""
  for (const b of compressed) bin += String.fromCharCode(b)
  return btoa(bin)
}

async function decompressJson(b64) {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"))
  return JSON.parse(await new Response(stream).text())
}
