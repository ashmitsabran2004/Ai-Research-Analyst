/**
 * Minimal in-memory TTL cache.
 *
 * Why this exists: yahoo-finance2 is an unofficial API and can rate-limit
 * or throttle repeated requests. During dev you'll hit the same ticker
 * dozens of times while testing prompts/UI — this avoids re-fetching
 * every time within the TTL window.
 *
 * Note: this resets whenever your dev server restarts, and won't share
 * state across serverless function instances once deployed on Vercel.
 * For production you'd swap this for Upstash Redis or Vercel KV behind
 * the same withCache() interface — worth mentioning if asked about
 * scaling this in an interview.
 */

const store = new Map();

export function getCached(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

export function setCached(key, value, ttlMs) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Usage: await withCache(`financialData:infosys`, () => gatherFinancialData("Infosys"), 15 * 60 * 1000)
 */
export async function withCache(key, fetcher, ttlMs) {
  const cached = getCached(key);
  if (cached !== null) return cached;

  const value = await fetcher();
  setCached(key, value, ttlMs);
  return value;
}
