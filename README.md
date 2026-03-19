# bullmq-metrics

Small Prometheus exporter for [BullMQ](https://bullmq.io/) queues.

The service connects to Redis, discovers BullMQ queues for a configured prefix, and exposes the built-in BullMQ queue metrics on `/metrics` in Prometheus text format.

The application entrypoint lives at `src/index.ts`, with environment-driven runtime settings in `src/config.ts`.

## Features

- Auto-discovers queues from Redis instead of hard-coding queue names.
- Exposes BullMQ Prometheus metrics over HTTP.
- Supports custom Redis URLs and BullMQ prefixes.
- Ships with Bun-based local development, Docker support, tests, linting, and CI.

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

## Releases

- Pushes to `main` are released automatically with semantic-release.
- Pull requests targeting `main` must use a Conventional Commit title and should be squash-merged.
- Direct pushes to `main` must also use Conventional Commit messages.
- Release automation updates `package.json`, maintains `CHANGELOG.md`, creates a GitHub Release, and then publishes Docker tags from the release event.

## Development

```bash
bun run dev
```

Quality checks:

```bash
bun run check
```

Individual commands:

```bash
bun run format
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
