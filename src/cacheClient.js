import { idbGet, idbSet } from "./idbStore.js"

export function createCacheClient(storageKey) {
  return {
    async read() {
      return await idbGet(storageKey)
    },
    async write(payload) {
      try {
        await idbSet(storageKey, payload)
      } catch (err) {
        console.warn("Cache not persisted:", err?.message || err)
      }
    },
  }
}
