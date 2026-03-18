# Contributing

## Development Setup

1. Install Bun `>= 1.3.11`.
2. Install dependencies with `bun install`.
3. Copy `.env.example` to `.env` if you need custom local settings.
4. Start the exporter with `bun run dev` or `bun run start`.

## Release Process

- Every qualifying push to `main` runs semantic-release.
- semantic-release updates `package.json` and `CHANGELOG.md`, creates the release tag, and publishes a GitHub Release.
- Docker publishing runs after the GitHub Release is published and pushes `okerx/bullmq-monitor` with the release tag and `latest`.
- The release workflow requires a `SEMANTIC_RELEASE_TOKEN` secret because the default `GITHUB_TOKEN` does not trigger downstream release-based workflows.
- Do not edit `CHANGELOG.md` or bump the package version manually as part of normal development.

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
- Pull request titles targeting `main` must follow the Conventional Commit format.
- Prefer squash merge so the validated pull request title becomes the commit message on `main`.

## Commit and Review Expectations

- Prefer small, reviewable commits.
- Expect maintainers to ask for tests when behavior changes.
- Security-sensitive changes should avoid public disclosure until a fix is ready. See [SECURITY.md](./SECURITY.md).
- Direct pushes to `main` must also use Conventional Commit messages or semantic-release will not cut a release.

Accepted release-driving prefixes:

- `feat:` for minor releases
- `fix:`, `perf:`, `refactor:`, `docs:`, `style:`, `test:`, `build:`, `ci:`, `chore:`, and `revert:` for patch releases
- Add `!` or a `BREAKING CHANGE:` footer for major releases

Examples:

```text
feat: add queue prefix configuration
fix(redis): close scan client on error
docs: document release workflow
feat!: rename the metrics endpoint
```

## Reporting Bugs

Use the repository issue templates when possible. For security issues, do not open a public issue with exploit details.
