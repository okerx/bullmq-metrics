# Contributing

## Development Setup

1. Install Bun `>= 1.3.11`.
2. Install dependencies with `bun install`.
3. Copy `.env.example` to `.env` if you need custom local settings.
4. Start the exporter with `bun run dev` or `bun run start`.

## Before Opening a Pull Request

Run the full local check suite:

```bash
bun run check
```

If you are working on runtime behavior, include or update tests in `*.test.ts`.

## Pull Request Guidelines

- Keep pull requests focused on a single change.
- Describe user-facing behavior changes clearly.
- Include reproduction steps for bug fixes.
- Update documentation when configuration, endpoints, or operations change.
- Do not mix unrelated refactors into the same pull request.

## Commit and Review Expectations

- Prefer small, reviewable commits.
- Expect maintainers to ask for tests when behavior changes.
- Security-sensitive changes should avoid public disclosure until a fix is ready. See [SECURITY.md](./SECURITY.md).

## Reporting Bugs

Use the repository issue templates when possible. For security issues, do not open a public issue with exploit details.
