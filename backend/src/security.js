'use strict';

const crypto = require('node:crypto');

const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, stored) {
  const [scheme, salt, hash] = String(stored).split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = crypto.scryptSync(password, salt, expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

function createToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createLoginLimiter({
  maxAttempts = 5,
  windowMs = 15 * 60 * 1000,
  now = () => Date.now(),
} = {}) {
  const attempts = new Map();

  return {
    isBlocked(key) {
      const entry = attempts.get(key);
      if (!entry) return false;
      if (now() - entry.start > windowMs) {
        attempts.delete(key);
        return false;
      }
      return entry.count >= maxAttempts;
    },
    recordFailure(key) {
      const entry = attempts.get(key);
      if (!entry || now() - entry.start > windowMs) {
        attempts.set(key, { start: now(), count: 1 });
      } else {
        entry.count += 1;
      }
    },
    reset(key) {
      attempts.delete(key);
    },
  };
}

module.exports = { hashPassword, verifyPassword, createToken, hashToken, createLoginLimiter };
