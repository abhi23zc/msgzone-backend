import crypto from 'crypto';

export function generateApiKey() {
  return `dev_${crypto.randomBytes(6).toString('hex')}`; // ~15 chars
}

export function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}
