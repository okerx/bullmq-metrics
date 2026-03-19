import { redis } from 'bun';
import { Queue, type Metrics } from 'bullmq';
import { Config } from './config.ts';
import { extractQueueNameFromRedisKey } from './utils.ts';

type QueueMetricsSnapshot = {
  completedMetrics: Metrics;
  failedMetrics: Metrics;
  jobCountMetrics: string;
  queueName: string;
};

const escapePrometheusLabelValue = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('\n', '\\n').replaceAll('"', '\\"');

const getQueueMetricsSnapshot = async (queueName: string): Promise<QueueMetricsSnapshot> => {
  const queue = new Queue(queueName, { connection: { url: Config.REDIS_URL }, prefix: Config.BULLMQ_PREFIX });

  try {
    const [jobCountMetrics, completedMetrics, failedMetrics] = await Promise.all([
      queue.exportPrometheusMetrics(),
      queue.getMetrics('completed'),
      queue.getMetrics('failed'),
    ]);

    return { completedMetrics, failedMetrics, jobCountMetrics, queueName };
  } finally {
    await queue.close();
  }
};

const renderMetricFamily = (name: string, help: string, type: 'counter' | 'gauge', samples: string[]) => {
  if (samples.length === 0) {
    return '';
  }

  return [`# HELP ${name} ${help}`, `# TYPE ${name} ${type}`, ...samples].join('\n');
};

const getLastMinuteJobsCount = (metrics: Metrics) => metrics.data[0] ?? 0;

const renderQueueSample = (name: string, queueName: string, value: number) =>
  `${name}{queue="${escapePrometheusLabelValue(queueName)}"} ${value}`;

const renderMetricsPayload = (metrics: QueueMetricsSnapshot[], queuesDiscovered: number) => {
  const sections = metrics.map(({ jobCountMetrics }) => jobCountMetrics);

  sections.push(
    renderMetricFamily(
      'bullmq_jobs_completed_last_minute',
      'Number of BullMQ jobs completed during the latest one-minute bucket by queue',
      'gauge',
      metrics.map(({ queueName, completedMetrics }) =>
        renderQueueSample('bullmq_jobs_completed_last_minute', queueName, getLastMinuteJobsCount(completedMetrics)),
      ),
    ),
  );

  sections.push(
    renderMetricFamily(
      'bullmq_jobs_failed_last_minute',
      'Number of BullMQ jobs failed during the latest one-minute bucket by queue',
      'gauge',
      metrics.map(({ queueName, failedMetrics }) =>
        renderQueueSample('bullmq_jobs_failed_last_minute', queueName, getLastMinuteJobsCount(failedMetrics)),
      ),
    ),
  );

  sections.push(
    renderMetricFamily(
      'bullmq_exporter_queues_discovered',
      'Number of BullMQ queues discovered during the last scrape',
      'gauge',
      [`bullmq_exporter_queues_discovered ${queuesDiscovered}`],
    ),
  );

  return sections.filter(Boolean).join('\n\n');
};

export const getQueuesMetrics = async (queues: string[]) => {
  const metrics = await Promise.all(queues.map((queueName) => getQueueMetricsSnapshot(queueName)));
  return renderMetricsPayload(metrics, queues.length);
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
