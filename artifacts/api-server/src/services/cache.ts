type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<any>>();

export function cacheGet<T>(key: string): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return e.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlSeconds: number): T {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  return value;
}

export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const value = await loader();
  return cacheSet(key, value, ttlSeconds);
}

export function cacheClear(prefix?: string) {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}
