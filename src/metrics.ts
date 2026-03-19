import { redis } from 'bun';
import { Queue, type Metrics } from 'bullmq';
import { Counter, Gauge, Registry } from 'prom-client';
import { Config } from './config.ts';
import { extractQueueNameFromRedisKey } from './utils.ts';

type QueueMetricsSnapshot = {
  completedMetrics: Metrics;
  failedMetrics: Metrics;
  jobCounts: Record<string, number>;
  queueName: string;
};

const createQueueClient = (queueName: string) =>
  new Queue(queueName, { connection: { url: Config.REDIS_URL }, prefix: Config.BULLMQ_PREFIX });

const getQueueMetricsSnapshot = async (
  queueName: string,
  queueClientFactory = createQueueClient,
): Promise<QueueMetricsSnapshot> => {
  const queue = queueClientFactory(queueName);

  try {
    const [jobCounts, completedMetrics, failedMetrics] = await Promise.all([
      queue.getJobCounts(),
      queue.getMetrics('completed'),
      queue.getMetrics('failed'),
    ]);

    return { completedMetrics, failedMetrics, jobCounts, queueName };
  } finally {
    await queue.close();
  }
};

const getTotalJobsCount = (metrics: Metrics) => metrics.meta.count;

const getLastMinuteJobsCount = (metrics: Metrics) => metrics.data[0] ?? 0;

const createMetricsRegistry = (metrics: QueueMetricsSnapshot[], queuesDiscovered: number) => {
  const registry = new Registry();

  const queuesDiscoveredGauge = new Gauge({
    help: 'Number of BullMQ queues discovered during the last scrape',
    name: 'bullmq_exporter_queues_discovered',
    registers: [registry],
  });

  queuesDiscoveredGauge.set(queuesDiscovered);

  if (metrics.length === 0) {
    return registry;
  }

  const jobCountGauge = new Gauge<'queue' | 'state'>({
    help: 'Number of jobs in the queue by state',
    labelNames: ['queue', 'state'],
    name: 'bullmq_job_count',
    registers: [registry],
  });

  const completedTotalCounter = new Counter<'queue'>({
    help: 'Total number of BullMQ jobs completed by queue',
    labelNames: ['queue'],
    name: 'bullmq_jobs_completed_total',
    registers: [registry],
  });

  const failedTotalCounter = new Counter<'queue'>({
    help: 'Total number of BullMQ jobs failed by queue',
    labelNames: ['queue'],
    name: 'bullmq_jobs_failed_total',
    registers: [registry],
  });

  const completedLastMinuteGauge = new Gauge<'queue'>({
    help: 'Number of BullMQ jobs completed during the latest one-minute bucket by queue',
    labelNames: ['queue'],
    name: 'bullmq_jobs_completed_last_minute',
    registers: [registry],
  });

  const failedLastMinuteGauge = new Gauge<'queue'>({
    help: 'Number of BullMQ jobs failed during the latest one-minute bucket by queue',
    labelNames: ['queue'],
    name: 'bullmq_jobs_failed_last_minute',
    registers: [registry],
  });

  for (const { completedMetrics, failedMetrics, jobCounts, queueName } of metrics) {
    for (const [state, count] of Object.entries(jobCounts)) {
      jobCountGauge.set({ queue: queueName, state }, count);
    }

    completedTotalCounter.inc({ queue: queueName }, getTotalJobsCount(completedMetrics));
    failedTotalCounter.inc({ queue: queueName }, getTotalJobsCount(failedMetrics));
    completedLastMinuteGauge.set({ queue: queueName }, getLastMinuteJobsCount(completedMetrics));
    failedLastMinuteGauge.set({ queue: queueName }, getLastMinuteJobsCount(failedMetrics));
  }

  return registry;
};

export const getQueuesMetrics = async (queues: string[], queueClientFactory = createQueueClient) => {
  const metrics = await Promise.all(queues.map((queueName) => getQueueMetricsSnapshot(queueName, queueClientFactory)));
  return createMetricsRegistry(metrics, queues.length).metrics();
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
