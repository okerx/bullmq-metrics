import { describe, expect, test } from 'bun:test';

import {
  extractQueueNameFromRedisKey,
  getQueueNamesFromRedisKeys,
  getQueuesMetrics,
  resolveExporterConfig,
} from './index';

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

describe('getQueueNamesFromRedisKeys', () => {
  test('deduplicates and sorts queue names', () => {
    expect(
      getQueueNamesFromRedisKeys(['bull:reports:id', 'bull:emails:id', 'team:prod:bull:reports:id', 'not-a-queue-key']),
    ).toEqual(['emails', 'reports']);
  });
});

describe('resolveExporterConfig', () => {
  test('uses defaults when values are not provided', () => {
    expect(resolveExporterConfig({})).toEqual({
      bullmqPrefix: 'bull',
      host: '0.0.0.0',
      port: 3030,
      redisScanCount: 1000,
      redisUrl: 'redis://127.0.0.1:6379',
    });
  });

  test('accepts explicit overrides', () => {
    expect(
      resolveExporterConfig({
        BULLMQ_PREFIX: 'queues',
        HOST: '127.0.0.1',
        PORT: '9090',
        REDIS_SCAN_COUNT: '5000',
        REDIS_URL: 'redis://cache.internal:6379',
      }),
    ).toEqual({
      bullmqPrefix: 'queues',
      host: '127.0.0.1',
      port: 9090,
      redisScanCount: 5000,
      redisUrl: 'redis://cache.internal:6379',
    });
  });

  test('rejects invalid numeric values', () => {
    expect(() => resolveExporterConfig({ PORT: '0' })).toThrow('PORT must be a positive integer.');
    expect(() => resolveExporterConfig({ REDIS_SCAN_COUNT: 'abc' })).toThrow(
      'REDIS_SCAN_COUNT must be a positive integer.',
    );
  });
});

describe('getQueuesMetrics', () => {
  test('returns an empty payload when no queues are provided', async () => {
    expect(getQueuesMetrics([])).resolves.toBe('');
  });
});
