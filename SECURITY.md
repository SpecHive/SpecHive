# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| Latest  | Yes       |

## Reporting a Vulnerability

**Please do not open public GitHub issues for security vulnerabilities.**

To report a vulnerability, email **admin@spechive.dev** with:

- Description of the vulnerability
- Steps to reproduce
- Affected versions
- Any potential impact assessment

We will acknowledge your report within **48 hours** and aim to provide a fix or mitigation plan within **7 days** for critical issues.

## Disclosure Policy

We follow coordinated disclosure. We ask that you give us reasonable time to address the issue before public disclosure.

Credit will be given to reporters in release notes unless you prefer to remain anonymous.

## Scope

This policy applies to the SpecHive OSS repository ([SpecHive/SpecHive](https://github.com/SpecHive/SpecHive)). For the hosted cloud service, please refer to the cloud security policy.

## Security Best Practices for Deployers

- Always use strong, unique values for `TOKEN_HASH_KEY` (min 32 chars), `JWT_SECRET` (min 64 chars), and `WEBHOOK_SECRET` (min 32 chars)
- Run PostgreSQL with the two-role model: superuser for migrations only, `spechive_app` for the application
- Enable TLS for all external-facing endpoints
- Keep dependencies updated — Dependabot is configured for this repository
- Review `.env.example` for the full list of configurable secrets
