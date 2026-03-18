# Security Policy

## Supported Versions

Until the project has tagged releases, only the latest state of the default branch is considered supported for security fixes.

## Reporting a Vulnerability

- Do not open a public issue with exploit details.
- Use GitHub private vulnerability reporting for this repository if it is enabled.
- If private reporting is unavailable, open a minimal issue asking for a secure contact path without sharing the vulnerability details.
- Include the affected commit or version, impact, prerequisites, reproduction steps, and any suggested mitigations.

Maintainers should acknowledge new reports within 3 business days and keep reporters informed as triage and remediation progress.

## Operational Guidance

- Keep Redis on a private network and require authentication.
- Protect `/metrics` with network controls if queue names or counts are sensitive in your environment.
- Use dedicated Redis credentials for the exporter where possible.
- Rotate credentials promptly if they may have been exposed.
