import { redis } from 'bun';
import { Queue } from 'bullmq';
import { Config } from './config.ts';
import { extractQueueNameFromRedisKey } from './utils.ts';

export const getQueuesMetrics = async (queues: string[]) => {
  if (queues.length === 0) {
    return '';
  }

  const queueClients = queues.map(
    (queueName) => new Queue(queueName, { connection: { url: Config.REDIS_URL }, prefix: Config.BULLMQ_PREFIX }),
  );

  try {
    const metrics = await Promise.all(queueClients.map((queue) => queue.exportPrometheusMetrics()));
    return metrics.join('\n\n');
  } finally {
    await Promise.all(queueClients.map((queue) => queue.close()));
  }
};

const scanForQueues = async () => {
  const queueNames = new Set<string>();
  let cursor = '0';
  do {
    const [nextCursor, scannedKeys] = await redis.scan(
      cursor,
      'MATCH',
      `${Config.BULLMQ_PREFIX}:*:id`,
      'COUNT',
      Config.REDIS_SCAN_COUNT,
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

export const getMetrics = async () => await getQueuesMetrics(await scanForQueues());
