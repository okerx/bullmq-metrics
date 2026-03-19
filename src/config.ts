export const Config = {
  HOST: process.env.HOST?.trim() || '0.0.0.0',
  PORT: parseInt(process.env.PORT || '3030', 10),
  REDIS_URL: process.env.REDIS_URL?.trim() || 'redis://127.0.0.1:6379',
  REDIS_SCAN_COUNT: parseInt(process.env.REDIS_SCAN_COUNT || '1000', 10),
  BULLMQ_PREFIX: process.env.BULLMQ_PREFIX?.trim() || 'bull',
};
