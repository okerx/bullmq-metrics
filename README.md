# Monitor BullMQ Jobs with Prometheus and Grafana

If you run background work with BullMQ, you need more than queue names in Redis. You need a quick way to see backlog, active work, completions, and failures across all queues. The [`bullmq-metrics`](https://github.com/okerx/bullmq-metrics) project solves that by discovering BullMQ queues from Redis and exposing a Prometheus-friendly `/metrics` endpoint. If you want the fastest path to production, the Docker image is [`okerx/bullmq-monitor`](https://hub.docker.com/r/okerx/bullmq-monitor).

## Features

- 🕵️‍♂️ Auto-discovers queues from Redis.
- 🌐 Exposes BullMQ Prometheus metrics over HTTP.
- 🚢 Ships with Bun-based runtime, and a Docker image.

## Get started

This guide walks through three steps:

- Run the exporter against the Redis instance used by BullMQ
- Add the exporter as a Prometheus scrape target
- Import the Grafana dashboard and start monitoring queue health

### What You Get

The exporter exposes queue-level metrics such as:

- `bullmq_job_count{queue, state}`
- `bullmq_jobs_completed_total{queue}`
- `bullmq_jobs_failed_total{queue}`
- `bullmq_jobs_completed_last_minute{queue}`
- `bullmq_jobs_failed_last_minute{queue}`
- `bullmq_exporter_queues_discovered`

That gives you visibility into the current backlog, active jobs, throughput, and failure history without hard-coding queue names in the exporter.

### 1. Run the Exporter

#### Option A: Run the Docker Image

```bash
docker run --rm \
  --name bullmq-monitor \
  -p 3030:3030 \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e BULLMQ_PREFIX=bull \
  okerx/bullmq-monitor:latest
```

If Redis is running in Docker on the same network, replace `host.docker.internal` with the Redis service name.

The exporter listens on:

- `http://localhost:3030/metrics`
- `http://localhost:3030/healthz`

Quick verification:

```bash
curl http://localhost:3030/healthz
curl http://localhost:3030/metrics
```

#### Option B: Run from Source

```bash
git clone https://github.com/okerx/bullmq-metrics.git
cd bullmq-metrics
bun install
REDIS_URL=redis://localhost:6379 bun run start
```

The main runtime settings are:

| Variable           | Default                  | Purpose                                               |
|--------------------|--------------------------|-------------------------------------------------------|
| `HOST`             | `0.0.0.0`                | HTTP bind host                                        |
| `PORT`             | `3030`                   | HTTP bind port                                        |
| `REDIS_URL`        | `redis://127.0.0.1:6379` | Redis connection used for queue discovery and metrics |
| `BULLMQ_PREFIX`    | `bull`                   | BullMQ Redis key prefix                               |
| `REDIS_SCAN_COUNT` | `1000`                   | Redis `SCAN COUNT` hint during queue discovery        |

### 2. Add the Exporter to Prometheus

Add a scrape target for the exporter to your Prometheus configuration:

```yaml
scrape_configs:
  - job_name: bullmq
    static_configs:
      - targets:
          - localhost:3030
```

If Prometheus runs in Docker or Kubernetes, use the exporter's reachable hostname instead of `localhost`.

After reloading Prometheus, test a simple query such as:

```promql
bullmq_job_count
```

If that returns series, Prometheus is scraping the exporter correctly.

### 3. Import the Grafana Dashboard

The repository includes a ready-made dashboard at `grafana/dashboards/bullmq-overview.json`.

To import it:

1. Open Grafana.
2. Go to `Dashboards` -> `New` -> `Import`.
3. Upload `grafana/dashboards/bullmq-overview.json` from the repository.
4. Select your Prometheus data source when Grafana prompts for `DS_PROMETHEUS`.
5. Import the dashboard.

The dashboard includes a `Queue` variable, so you can inspect one queue, several queues, or the full fleet from the same view.

### 4. Enable BullMQ Worker Metrics

Queue state metrics work without extra BullMQ worker configuration, but completion and failure history panels rely on BullMQ's stored metrics. To populate those panels, enable metrics in your workers:

```ts
import { Worker, MetricsTime } from 'bullmq';

new Worker('email', processor, {
  connection: { url: process.env.REDIS_URL },
  metrics: {
    maxDataPoints: MetricsTime.ONE_WEEK * 2,
  },
});
```

Without that setting, backlog and active-job panels still work, but throughput and recent failure panels stay empty or flat.

### Outcome

At this point you have:

- A BullMQ metrics exporter reading queue data from Redis
- Prometheus scraping BullMQ queue metrics from `/metrics`
- Grafana visualizing backlog, throughput, and failures with the bundled dashboard

That is enough to move from "BullMQ is running" to "BullMQ is observable."

## Development

```bash
bun run dev
```

Quality checks:

```bash
bun run check
```

Other commands:

```bash
bun run lint
bun run typecheck
bun test
bun run release:dry-run
```

## Security Notes

- Keep Redis on a trusted network and require authentication.
- Treat `/metrics` as operational data. If queue names or counts are sensitive, put the exporter behind network controls.
- Use a dedicated Redis user with the minimum access needed for the deployment.

## Project Docs

- [License](./LICENSE)
- [Contributing](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)
- [Changelog](./CHANGELOG.md)
