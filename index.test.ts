import { describe, expect, mock, test } from 'bun:test';
import type { Metrics } from 'bullmq';
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
  const createBullMqMetrics = ({
    lastMinute,
    points = lastMinute === undefined ? 0 : 1,
    total,
  }: {
    lastMinute?: number;
    points?: number;
    total: number;
  }): Metrics => ({
    meta: {
      count: total,
      prevCount: 0,
      prevTS: 0,
    },
    data: lastMinute === undefined ? [] : [lastMinute],
    count: points,
  });

  const mockQueueModule = (
    payloads: Record<
      string,
      {
        completedMetrics: Metrics;
        failedMetrics: Metrics;
        jobCountMetrics: string;
      }
    >,
  ) => {
    const closedQueues: string[] = [];

    mock.module('bullmq', () => ({
      Queue: class {
        queueName: string;

        constructor(queueName: string) {
          this.queueName = queueName;
        }

        async close() {
          closedQueues.push(this.queueName);
        }

        async exportPrometheusMetrics() {
          const payload = payloads[this.queueName];

          if (!payload) {
            throw new Error(`Missing test payload for queue ${this.queueName}`);
          }

          return payload.jobCountMetrics;
        }

        async getMetrics(type: 'completed' | 'failed') {
          const payload = payloads[this.queueName];

          if (!payload) {
            throw new Error(`Missing test payload for queue ${this.queueName}`);
          }

          return type === 'completed' ? payload.completedMetrics : payload.failedMetrics;
        }
      },
    }));

    return { closedQueues };
  };

  test('returns the exporter gauge when no queues are provided', async () => {
    expect(getQueuesMetrics([])).resolves.toBe(
      [
        '# HELP bullmq_exporter_queues_discovered Number of BullMQ queues discovered during the last scrape',
        '# TYPE bullmq_exporter_queues_discovered gauge',
        'bullmq_exporter_queues_discovered 0',
      ].join('\n'),
    );
  });

  test('renders built-in queue metrics alongside derived BullMQ history metrics', async () => {
    const { closedQueues } = mockQueueModule({
      analytics: {
        completedMetrics: createBullMqMetrics({ lastMinute: 3, points: 1440, total: 125 }),
        failedMetrics: createBullMqMetrics({ lastMinute: 1, points: 1440, total: 5 }),
        jobCountMetrics: [
          '# HELP bullmq_job_count Number of jobs in the queue by state',
          '# TYPE bullmq_job_count gauge',
          'bullmq_job_count{queue="analytics", state="active"} 2',
        ].join('\n'),
      },
      email: {
        completedMetrics: createBullMqMetrics({ lastMinute: 14, points: 1440, total: 326 }),
        failedMetrics: createBullMqMetrics({ lastMinute: 0, points: 1440, total: 0 }),
        jobCountMetrics: [
          '# HELP bullmq_job_count Number of jobs in the queue by state',
          '# TYPE bullmq_job_count gauge',
          'bullmq_job_count{queue="email", state="waiting"} 4',
        ].join('\n'),
      },
    });

    const metrics = await getQueuesMetrics(['analytics', 'email']);

    expect(metrics).toContain('bullmq_job_count{queue="analytics", state="active"} 2');
    expect(metrics).toContain('bullmq_job_count{queue="email", state="waiting"} 4');
    expect(metrics).not.toContain('bullmq_jobs_completed_total');
    expect(metrics).not.toContain('bullmq_jobs_failed_total');
    expect(metrics).toContain('bullmq_jobs_completed_last_minute{queue="analytics"} 3');
    expect(metrics).toContain('bullmq_jobs_completed_last_minute{queue="email"} 14');
    expect(metrics).toContain('bullmq_jobs_failed_last_minute{queue="analytics"} 1');
    expect(metrics).toContain('bullmq_jobs_failed_last_minute{queue="email"} 0');
    expect(metrics).toContain('bullmq_exporter_queues_discovered 2');
    expect(closedQueues.toSorted()).toEqual(['analytics', 'email']);
  });

  test('gracefully emits queue state metrics when BullMQ worker history metrics are missing', async () => {
    mockQueueModule({
      invoices: {
        completedMetrics: createBullMqMetrics({ total: 0 }),
        failedMetrics: createBullMqMetrics({ total: 0 }),
        jobCountMetrics: [
          '# HELP bullmq_job_count Number of jobs in the queue by state',
          '# TYPE bullmq_job_count gauge',
          'bullmq_job_count{queue="invoices", state="failed"} 7',
        ].join('\n'),
      },
    });

    const metrics = await getQueuesMetrics(['invoices']);

    expect(metrics).toContain('bullmq_job_count{queue="invoices", state="failed"} 7');
    expect(metrics).toContain('bullmq_jobs_completed_last_minute{queue="invoices"} 0');
    expect(metrics).toContain('bullmq_jobs_failed_last_minute{queue="invoices"} 0');
    expect(metrics).toContain('bullmq_exporter_queues_discovered 1');
  });
});
