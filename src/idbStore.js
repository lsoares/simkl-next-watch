const STORE = "kv"

export async function idbGet(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(key)
    tx.onsuccess = () => resolve(tx.result ?? null)
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbSet(key, value) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key)
    tx.onsuccess = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbDelete(key) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).delete(key)
    tx.onsuccess = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function idbDeleteByPrefix(prefix) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const store = db.transaction(STORE, "readwrite").objectStore(STORE)
    const req = store.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) return resolve()
      if (typeof cursor.key === "string" && cursor.key.startsWith(prefix)) cursor.delete()
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("next-watch", 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
