import { describe, expect, test } from 'bun:test';
import { extractQueueNameFromRedisKey } from './src/utils';
import { getQueuesMetrics } from './src/metrics.ts';

const CONFIG_ENV_KEYS = ['BULLMQ_PREFIX', 'HOST', 'PORT', 'REDIS_SCAN_COUNT', 'REDIS_URL'] as const;

const loadConfig = async (env: Partial<Record<(typeof CONFIG_ENV_KEYS)[number], string | undefined>>, key: string) => {
  const previousEnv = Object.fromEntries(CONFIG_ENV_KEYS.map((name) => [name, process.env[name]]));

  for (const name of CONFIG_ENV_KEYS) {
    const value = env[name];

    if (value === undefined) {
      delete process.env[name];
      continue;
    }

    process.env[name] = value;
  }

  try {
    return (await import(`./src/config.ts?${key}`)).Config;
  } finally {
    for (const name of CONFIG_ENV_KEYS) {
      const value = previousEnv[name];

      if (value === undefined) {
        delete process.env[name];
        continue;
      }

      process.env[name] = value;
    }
  }
};

describe('extractQueueNameFromRedisKey', () => {
  test('extracts a queue name from a default BullMQ key', () => {
    expect(extractQueueNameFromRedisKey('bull:emails:id')).toBe('emails');
  });

  test('extracts a queue name when the prefix contains colons', () => {
    expect(extractQueueNameFromRedisKey('team:prod:bull:reports:id')).toBe('reports');
  });

  test('returns null for malformed keys', () => {
    expect(extractQueueNameFromRedisKey('bull:emails:wait')).toBeNull();
  });
});

describe('Config', () => {
  test('uses defaults when values are not provided', async () => {
    expect(await loadConfig({}, 'defaults')).toEqual({
      BULLMQ_PREFIX: 'bull',
      HOST: '0.0.0.0',
      PORT: 3030,
      REDIS_SCAN_COUNT: 1000,
      REDIS_URL: 'redis://127.0.0.1:6379',
    });
  });

  test('accepts explicit overrides', async () => {
    expect(
      await loadConfig(
        {
          BULLMQ_PREFIX: 'queues',
          HOST: '127.0.0.1',
          PORT: '9090',
          REDIS_SCAN_COUNT: '5000',
          REDIS_URL: 'redis://cache.internal:6379',
        },
        'overrides',
      ),
    ).toEqual({
      BULLMQ_PREFIX: 'queues',
      HOST: '127.0.0.1',
      PORT: 9090,
      REDIS_SCAN_COUNT: 5000,
      REDIS_URL: 'redis://cache.internal:6379',
    });
  });
});

describe('getQueuesMetrics', () => {
  test('returns an empty payload when no queues are provided', async () => {
    expect(getQueuesMetrics([])).resolves.toBe('');
  });
});
