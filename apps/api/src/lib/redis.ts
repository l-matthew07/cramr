import Redis from "ioredis";

let client: Redis | null = null;

export function redis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
    client.on("error", (e) => console.error("[redis]", e.message));
  }
  return client;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = redis();
  if (!r) return null;
  try {
    const raw = await r.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, ttlSeconds: number) {
  const r = redis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (e) {
    console.error("[redis.set]", e);
  }
}
