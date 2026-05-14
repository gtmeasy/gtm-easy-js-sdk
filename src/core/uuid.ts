/**
 * Generate a v4 UUID. Uses the platform's `crypto.randomUUID()` when available
 * (modern browsers, Node 16+, Bun, Deno) and falls back to crypto.getRandomValues.
 */
export function generateUuid(): string {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID()
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16)
    cryptoObj.getRandomValues(bytes)
    // Force v4 variant — bytes are guaranteed non-null after getRandomValues
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
  }
  // Last-resort non-crypto fallback. Only used in environments without crypto
  // at all (extremely old runtimes); collisions here are acceptable because the
  // anonymous id is still namespaced by app + write key on the server.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}
