import { idbDelete, idbDeleteByPrefix, idbGet, idbSet } from "./idbStore.js"

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
    async clear() {
      await idbDelete(storageKey)
    },
  }
}

export function createKeyedCache(prefix) {
  return {
    async get(key) {
      return await idbGet(`${prefix}:${key}`)
    },
    async set(key, value) {
      try {
        await idbSet(`${prefix}:${key}`, { value })
      } catch (err) {
        console.warn("Cache not persisted:", err?.message || err)
      }
    },
    async delete(key) {
      try {
        await idbDelete(`${prefix}:${key}`)
      } catch (err) {
        console.warn("Cache not deleted:", err?.message || err)
      }
    },
    async clear() {
      await idbDeleteByPrefix(`${prefix}:`)
    },
  }
}
