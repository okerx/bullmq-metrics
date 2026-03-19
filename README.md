# bullmq-metrics

Prometheus exporter for [BullMQ](https://bullmq.io/) queues.

The service connects to Redis, discovers BullMQ queues for a configured prefix, and exposes the BullMQ queue metrics on `/metrics` in Prometheus text format.

## Features

- 🕵️‍♂️ Auto-discovers queues from Redis.
- 🌐 Exposes BullMQ Prometheus metrics over HTTP.
- 🚢 Ships with Bun-based runtime, and a Docker image.

## Requirements

- [Bun](https://bun.com/) `>= 1.3.11`
- A reachable Redis instance used by BullMQ
- BullMQ queues using the configured prefix (defaults to `bull`)

## Quick Start

```bash
bun install
cp .env.example .env
bun run start
```

The exporter listens on `http://0.0.0.0:3030` by default.

## Configuration

| Variable           | Default                  | Description                                                             |
|--------------------|--------------------------|-------------------------------------------------------------------------|
| `HOST`             | `0.0.0.0`                | HTTP bind host                                                          |
| `PORT`             | `3030`                   | HTTP bind port                                                          |
| `REDIS_URL`        | `redis://127.0.0.1:6379` | Redis connection string used for queue discovery and metrics collection |
| `BULLMQ_PREFIX`    | `bull`                   | BullMQ key prefix to scan for queues                                    |
| `REDIS_SCAN_COUNT` | `1000`                   | Redis `SCAN COUNT` hint used during queue discovery                     |

Example:

```bash
HOST=0.0.0.0 \
PORT=3030 \
REDIS_URL=redis://localhost:6379 \
BULLMQ_PREFIX=bull \
REDIS_SCAN_COUNT=1000 \
bun run start
```

## Endpoints

- `GET /metrics` returns BullMQ metrics in Prometheus text format.
- `GET /healthz` returns a simple JSON health response.
- `GET /` returns a short plain-text service banner.

## Prometheus Scrape Config

```yaml
scrape_configs:
  - job_name: bullmq
    static_configs:
      - targets:
          - localhost:3030
```

## Exposed Metrics

The exporter exposes queue-level series derived from BullMQ's stored history:

- `bullmq_job_count{queue, state}`
- `bullmq_jobs_completed_total{queue}`
- `bullmq_jobs_failed_total{queue}`
- `bullmq_jobs_completed_last_minute{queue}`
- `bullmq_jobs_failed_last_minute{queue}`
- `bullmq_exporter_queues_discovered`

`bullmq_jobs_*` is sourced from `queue.getMetrics(...)`. BullMQ stores the total finished job count in `meta.count` and the most recent one-minute bucket in `data[0]`.

## Grafana Dashboard

An importable Grafana dashboard is available at [`grafana/dashboards/bullmq-overview.json`](./grafana/dashboards/bullmq-overview.json).

- Import the JSON through Grafana's dashboard import flow.
- Grafana should prompt for a Prometheus data source.
- Use the `Queue` variable to filter the dashboard to one queue, many queues, or the entire fleet.

### BullMQ Worker Prerequisite

BullMQ only populates completion and failure history if your workers enable metrics collection. Without that, queue state panels still work, but throughput and failure-history panels will stay empty or zero.

Example worker configuration:

```ts
import { Worker, MetricsTime } from 'bullmq';

new Worker('email', processor, {
  connection: { url: process.env.REDIS_URL },
  metrics: {
    maxDataPoints: MetricsTime.ONE_WEEK * 2,
  },
});
```

## Docker

Build:

```bash
docker build -t bullmq-metrics .
```

Run:

```bash
docker run --rm \
  -p 3030:3030 \
  -e REDIS_URL=redis://redis-instance:6379 \
  bullmq-metrics
```


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
