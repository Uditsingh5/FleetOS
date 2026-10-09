import env from '../config/env.js';

/**
 * In-memory rate limiter.
 * Designed with a simple interface so Redis can replace the store later.
 */
class RateLimitStore {
  constructor() {
    this.hits = new Map();
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300000);
  }

  increment(key, windowMs) {
    const now = Date.now();
    const record = this.hits.get(key);

    if (!record || now - record.startTime > windowMs) {
      this.hits.set(key, { count: 1, startTime: now });
      return { count: 1, remaining: windowMs };
    }

    record.count += 1;
    return { count: record.count, remaining: windowMs - (now - record.startTime) };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.hits) {
      if (now - record.startTime > 900000) {
        this.hits.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this.cleanupInterval);
  }
}

const store = new RateLimitStore();

/**
 * Creates rate limiting middleware.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} [options.message] - Error message
 */
export const rateLimit = (options = {}) => {
  const {
    windowMs = env.rateLimitWindowMs,
    max = env.rateLimitMax,
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => req.ip,
  } = options;

  return (req, res, next) => {
    // If rate limiting is disabled in dev / testing, bypass
    if (env.disableRateLimit) {
      return next();
    }

    const key = keyGenerator(req);
    const { count, remaining } = store.increment(key, windowMs);

    res.set('X-RateLimit-Limit', max);
    res.set('X-RateLimit-Remaining', Math.max(0, max - count));

    if (count > max) {
      res.set('Retry-After', Math.ceil(remaining / 1000));
      return res.status(429).json({
        success: false,
        message,
        errorCode: 'RATE_LIMITED',
      });
    }

    next();
  };
};

/** General API rate limiter */
export const apiLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs || 900000,
  max: env.rateLimitMax || 10000,
});

/** Strict auth rate limiter */
export const authLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs || 900000,
  max: env.authRateLimitMax || 1000,
  message: 'Too many authentication attempts',
});

/** Location update rate limiter (generous to support high-frequency telemetry & simulators) */
export const locationLimiter = rateLimit({
  windowMs: 60000,
  max: 2000,
  keyGenerator: (req) => `loc:${req.user?.userId || req.ip}`,
});
