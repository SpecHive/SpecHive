# @spechive/reporter-client

Shared HTTP client, event queue, configuration resolution, and CI detection for [SpecHive](https://github.com/spechive-dev/spechive) test reporters.

This package is not meant to be used directly by end users. It provides the building blocks that framework-specific reporters (like `@spechive/playwright-reporter`) depend on.

## What it provides

| Export              | Purpose                                                    |
| ------------------- | ---------------------------------------------------------- |
| `SpecHiveClient`    | HTTP client for sending events and uploading artifacts     |
| `ReporterQueue`     | Ordered event queue with automatic retries and drain logic |
| `resolveBaseConfig` | Resolves reporter config from options + environment vars   |
| `detectCi`          | Auto-detects CI provider, branch, commit SHA, build URL    |
| `createLogger`      | Creates a level-aware logger for reporter output           |

## Configuration

`resolveBaseConfig()` merges explicit options with environment variables:

| Option                  | Env var                  | Default                    |
| ----------------------- | ------------------------ | -------------------------- |
| `apiUrl`                | `SPECHIVE_API_URL`       | `https://api.spechive.dev` |
| `projectToken`          | `SPECHIVE_PROJECT_TOKEN` | —                          |
| `enabled`               | `SPECHIVE_ENABLED`       | `true`                     |
| `logLevel`              | `SPECHIVE_LOG_LEVEL`     | `'warn'`                   |
| `maxRetries`            | —                        | `3`                        |
| `flushTimeout`          | —                        | `30000`                    |
| `failOnConnectionError` | —                        | `false`                    |
| `metadata`              | —                        | `{}`                       |
| `runName`               | `SPECHIVE_RUN_NAME`      | auto-generated             |

### Log levels

| Level    | Output                                                            |
| -------- | ----------------------------------------------------------------- |
| `silent` | Nothing                                                           |
| `error`  | Data-loss issues only (e.g. artifact exceeds size limit)          |
| `warn`   | Failures, retries, queue drops, health-check issues (**default**) |
| `info`   | Everything above + run-complete summary                           |

## License

[MIT](./LICENSE)
