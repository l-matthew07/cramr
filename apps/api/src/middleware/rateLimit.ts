import type { Request, Response, NextFunction } from "express";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  windowMs: number;
  limit: number;
  keyPrefix: string;
  error?: string;
  key?: (req: Request) => string;
};

const buckets = new Map<string, Bucket>();

export function createRateLimiter({
  windowMs,
  limit,
  keyPrefix,
  error = "rate_limited",
  key,
}: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const scope =
      key?.(req) ??
      req.ip ??
      req.socket.remoteAddress ??
      "unknown";
    const bucketKey = `${keyPrefix}:${scope}`;
    const now = Date.now();
    const current = buckets.get(bucketKey);

    if (!current || current.resetAt <= now) {
      buckets.set(bucketKey, {
        count: 1,
        resetAt: now + windowMs,
      });
      return next();
    }

    if (current.count >= limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({ error });
    }

    current.count += 1;
    buckets.set(bucketKey, current);
    return next();
  };
}
