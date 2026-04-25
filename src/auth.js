import { idbGet, idbSet } from "./idbStore.js"

export async function getAuth() {
  return await idbGet("auth")
}

export async function setAuth(token, provider) {
  await idbSet("auth", { token, provider })
}

export async function clearAuth() {
  await idbSet("auth", null)
}

export async function setClientIds(clientIds) {
  await idbSet("clientIds", clientIds)
}
