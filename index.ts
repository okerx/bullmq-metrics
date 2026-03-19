import { redis } from 'bun';
import { Queue } from 'bullmq';

const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 3030;
const DEFAULT_REDIS_SCAN_COUNT = 1000;
const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379';
const DEFAULT_BULLMQ_PREFIX = 'bull';

export const METRICS_CONTENT_TYPE = 'text/plain; version=0.0.4; charset=utf-8';
export const TEXT_CONTENT_TYPE = 'text/plain; charset=utf-8';

export interface ExporterConfig {
  bullmqPrefix: string;
  host: string;
  port: number;
  redisScanCount: number;
  redisUrl: string;
}

const parsePositiveInteger = (name: string, value: string | undefined, fallback: number) => {
  if (value == null || value.trim() === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
};

const createTextResponse = (
  body: string,
  init: Omit<ResponseInit, 'headers'> & { headers?: Record<string, string> } = {},
) => new Response(body, { ...init, headers: { 'content-type': TEXT_CONTENT_TYPE, ...init.headers } });

export const resolveExporterConfig = (env = process.env): ExporterConfig => ({
  bullmqPrefix: env.BULLMQ_PREFIX?.trim() || DEFAULT_BULLMQ_PREFIX,
  host: env.HOST?.trim() || DEFAULT_HOST,
  port: parsePositiveInteger('PORT', env.PORT, DEFAULT_PORT),
  redisScanCount: parsePositiveInteger('REDIS_SCAN_COUNT', env.REDIS_SCAN_COUNT, DEFAULT_REDIS_SCAN_COUNT),
  redisUrl: env.REDIS_URL?.trim() || DEFAULT_REDIS_URL,
});

export const extractQueueNameFromRedisKey = (key: string): string | null => {
  const parts = key.split(':');

  if (parts.length < 3 || parts.at(-1) !== 'id') {
    return null;
  }

  return parts.at(-2) ?? null;
};

export const getQueueNamesFromRedisKeys = (keys: string[]): string[] =>
  [...new Set(keys.map(extractQueueNameFromRedisKey).filter((name): name is string => Boolean(name)))].sort();

export const getQueuesMetrics = async (queues: string[], config = resolveExporterConfig()) => {
  if (queues.length === 0) {
    return '';
  }

  const queueClients = queues.map(
    (queueName) => new Queue(queueName, { connection: { url: config.redisUrl }, prefix: config.bullmqPrefix }),
  );

  try {
    const metrics = await Promise.all(queueClients.map((queue) => queue.exportPrometheusMetrics()));
    return metrics.join('\n\n');
  } finally {
    await Promise.all(queueClients.map((queue) => queue.close()));
  }
};

export const scanForQueues = async (config = resolveExporterConfig()) => {
  const queueNames = new Set<string>();
  let cursor = '0';
  do {
    const [nextCursor, scannedKeys] = await redis.scan(
      cursor,
      'MATCH',
      `${config.bullmqPrefix}:*:id`,
      'COUNT',
      config.redisScanCount,
      'TYPE',
      'string',
    );

    cursor = nextCursor;

    for (const key of scannedKeys) {
      const queueName = extractQueueNameFromRedisKey(key);
      if (queueName) {
        queueNames.add(queueName);
      }
    }
  } while (cursor !== '0');

  return [...queueNames].sort();
};

export const serveExporter = (config = resolveExporterConfig()) =>
  Bun.serve({
    port: config.port,
    hostname: config.host,
    routes: {
      '/': () => createTextResponse('BullMQ Prometheus exporter\n'),
      '/healthz': () => Response.json({ status: 'ok' }),
      '/metrics': async () => {
        try {
          const queues = await scanForQueues(config);
          const metrics = await getQueuesMetrics(queues, config);
          return createTextResponse(metrics, { headers: { 'content-type': METRICS_CONTENT_TYPE } });
        } catch (error) {
          console.error('Failed to collect BullMQ metrics.', error);
          return createTextResponse('Failed to collect BullMQ metrics.\n', { status: 500 });
        }
      },
    },
  });

if (import.meta.main) {
  const server = serveExporter();
  console.log(`Listening on ${server.url}`);
}
