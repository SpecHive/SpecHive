# Changelog

## [0.0.12](https://github.com/SpecHive/SpecHive/compare/nestjs-common-v0.0.11...nestjs-common-v0.0.12) (2026-03-29)


### Bug Fixes

* **nestjs-common:** replace enableShutdownHooks with custom signal handler ([3b95591](https://github.com/SpecHive/SpecHive/commit/3b9559188ef6baf47dc93841955641b82edca790))


### Refactoring

* **nestjs-common:** migrate to nestjs-pino structured logging ([d511677](https://github.com/SpecHive/SpecHive/commit/d511677653c45c0b86d5d9cb1c890d33c1c438ff))
* **nestjs-common:** migrate to nestjs-pino structured logging ([d77e98e](https://github.com/SpecHive/SpecHive/commit/d77e98e60d6253ff16496974f0ab6c6fcb85c840))
* **worker:** complete structured logging migration to pino format ([ed80bc2](https://github.com/SpecHive/SpecHive/commit/ed80bc2a913a3dd809679f4031f5a8bb0623e476))

## [0.0.11](https://github.com/SpecHive/SpecHive/compare/nestjs-common-v0.0.10...nestjs-common-v0.0.11) (2026-03-26)


### Refactoring

* consolidate env vars — drop DASHBOARD_URL, rename WORKER_WEBHOOK_URL ([f517571](https://github.com/SpecHive/SpecHive/commit/f5175715fb81b8c165c2e0e2d5cab7d677d1e13e))
* standardize ports and env management ([094d85c](https://github.com/SpecHive/SpecHive/commit/094d85cc748e961298f3125a52402b8145346573))

## [0.0.10](https://github.com/SpecHive/SpecHive/compare/nestjs-common-v0.0.9...nestjs-common-v0.0.10) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.11

## [0.0.9](https://github.com/SpecHive/SpecHive/compare/nestjs-common-v0.0.8...nestjs-common-v0.0.9) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.10
    * @spechive/shared-types bumped to 0.0.3
  * devDependencies
    * @spechive/typescript-config bumped to 0.0.4

## [0.0.8](https://github.com/SpecHive/SpecHive/compare/nestjs-common-v0.0.7...nestjs-common-v0.0.8) (2026-03-22)


### Features

* add API Gateway with reverse proxy for multi-service routing ([06ae577](https://github.com/SpecHive/SpecHive/commit/06ae577e908b7b0e114eec941148b024cc923a4c))
* add barrel exports, plugin system, and cloud extension points ([2cb0c9b](https://github.com/SpecHive/SpecHive/commit/2cb0c9b734550bbdf0ac72edf0db015b39faec93))
* add enriched envelope schema, auth functions, s3 module, and shared utilities ([391928c](https://github.com/SpecHive/SpecHive/commit/391928c582d7783873862acd4f750d59809e4163))
* add S3 public endpoint, batch webhooks, and webhook secret validation ([fa5ded5](https://github.com/SpecHive/SpecHive/commit/fa5ded503dc0e3e6a4ee34e5503c266af8e53663))
* **dashboard:** add widget position registration and PUT/rawBody support ([1012f6a](https://github.com/SpecHive/SpecHive/commit/1012f6ad0247447620a76587e1c33e14033e8420))
* **database:** enhance seed script with multiple projects and complex test data ([4f0c5ba](https://github.com/SpecHive/SpecHive/commit/4f0c5ba561e1c158fb66974bba6814e359c482f1))
* **gateway:** add API gateway with auth, proxy routing, and dev networking fixes ([215edc3](https://github.com/SpecHive/SpecHive/commit/215edc333ebc0e65f0b63df9b0260e1f72b95395))
* harden auth with RLS context, extract outboxy adapter, add integration tests ([11be8ef](https://github.com/SpecHive/SpecHive/commit/11be8ef24acda650add8ca9be682ffe6b707c42d))
* **nestjs-common:** add health readiness probe with DB and S3 indicators ([f3cbb90](https://github.com/SpecHive/SpecHive/commit/f3cbb90afe1db620a4f2b8ce0676f6e4eab230bb))
* **platform:** add automatic artifact cleanup with S3 bulk delete ([2fe20b7](https://github.com/SpecHive/SpecHive/commit/2fe20b78f99b926243f323ae30df3e9f23ca33f6))
* **platform:** add graceful shutdown, parallelize queries, and shutdown integration test ([730d9c7](https://github.com/SpecHive/SpecHive/commit/730d9c74088f57ca6be8ab20c2dfb79524cce0ac))
* **platform:** add user profile management with password change ([928c470](https://github.com/SpecHive/SpecHive/commit/928c47096f426c13261ae4bc054493fedcb73b48))
* **platform:** orphaned run detection, status guards, flaky index, prod hardening ([3fdbe07](https://github.com/SpecHive/SpecHive/commit/3fdbe07aafe0ca0139a09981a3d220848f555732))
* **platform:** replace base64 artifact pipeline with direct S3 presigned uploads ([1ef92b1](https://github.com/SpecHive/SpecHive/commit/1ef92b1ead53f08cb804d004824b74ff6c850278))
* **query-api,nestjs-common:** add Redis-backed login rate limiting ([df56b71](https://github.com/SpecHive/SpecHive/commit/df56b71be05615881a48581e4eebdddac5da3554))


### Bug Fixes

* address audit findings for db, config, code quality, and tests ([259b774](https://github.com/SpecHive/SpecHive/commit/259b77465302ef92cafb999eabab85b961fec3f0))
* harden security, extract shared health module, and expand test coverage ([7a3bbd6](https://github.com/SpecHive/SpecHive/commit/7a3bbd605d73d26d08ea539c820e902cfafcd47f))
* move NestJS peer deps to dependencies and fix docker init password substitution ([613f315](https://github.com/SpecHive/SpecHive/commit/613f315041d61e4d9be59024b1ebdd2fe08e9b37))
* **nestjs-common:** make DbHealthIndicator dependency optional ([9d3b75c](https://github.com/SpecHive/SpecHive/commit/9d3b75c1e2c69b188c8f2ccaea734fd36dcf5d87))
* **nestjs-common:** move Redis exports to subpath to fix Docker ioredis crash ([6d92ede](https://github.com/SpecHive/SpecHive/commit/6d92ede0cbd0892b3d8e682be1c9eafb43d96be4))
* **nestjs-common:** update bootstrap-app test to expect rawBody options arg ([770c4f0](https://github.com/SpecHive/SpecHive/commit/770c4f020230725005e759e3a06e20fe65bc297c))
* **platform:** post-audit remediation — type safety, DRY, and defense-in-depth ([49c91f7](https://github.com/SpecHive/SpecHive/commit/49c91f7c9f58d76096acc85af20288c3122e49a2))
* pre-release security hardening, RBAC, and code quality sweep ([f7cee0d](https://github.com/SpecHive/SpecHive/commit/f7cee0dfe2fd6e4f6b46f9aef218ef70b92a149d))
* resolve code quality findings for error filter, dry, validation, architecture ([41f8a6c](https://github.com/SpecHive/SpecHive/commit/41f8a6c0e88e244440bb5dea25db074798a299ef))
* resolve infrastructure findings for dockerfiles, ci, nginx, dependencies ([18e06a0](https://github.com/SpecHive/SpecHive/commit/18e06a0600ff83551923626c4648148e90d66c4b))
* resolve typecheck errors in worker and ingestion-api tests ([681ec09](https://github.com/SpecHive/SpecHive/commit/681ec096e32cee79a3a7b69ab018687eacd8d659))
* **security:** add refresh tokens, rate limiting, and tenant isolation tests ([34c41ef](https://github.com/SpecHive/SpecHive/commit/34c41efaba12ccff820acc2a5593d4238da1f3c0))


### Refactoring

* convert ingestion-api to publish-only mode ([07f5541](https://github.com/SpecHive/SpecHive/commit/07f5541fb4ec83f43f97011b4c71f501a5c10122))
* extract shared nestjs-common package, upgrade dashboard to vite 7 + nginx ([a733eab](https://github.com/SpecHive/SpecHive/commit/a733eab76472eb1afb407162baf08c85bcf75bf1))
* harden security, extract shared configs, and add org_id to project_tokens ([0845e3c](https://github.com/SpecHive/SpecHive/commit/0845e3c2d0c3f23fc71187b5558fe55c21816040))
* harden token hashing, extract shared bootstrap, and propagate org ids ([31a653b](https://github.com/SpecHive/SpecHive/commit/31a653bc9b6e828407cd0ab1991fd9b6853fcc00))
* migrate token auth to argon2, propagate org ids, and harden docker roles ([06a70d4](https://github.com/SpecHive/SpecHive/commit/06a70d48db9d123979014fe541c067fc3ce471fe))
* **platform:** extract shared infra, add runtime validation, DRY patterns ([8f06a56](https://github.com/SpecHive/SpecHive/commit/8f06a5619692d3b786d421c054bc6dd92897ccb6))
* scope minio credentials, add db constraints, and expand test coverage ([0f176b4](https://github.com/SpecHive/SpecHive/commit/0f176b481b7c0939f00aef2cc9400336ca381e1e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.9

## [0.0.7](https://github.com/SpecHive/SpecHive/compare/nestjs-common-v0.0.6...nestjs-common-v0.0.7) (2026-03-22)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.8

## [0.0.6](https://github.com/SpecHive/SpecHive/compare/nestjs-common-v0.0.5...nestjs-common-v0.0.6) (2026-03-20)


### Features

* **dashboard:** add widget position registration and PUT/rawBody support ([1012f6a](https://github.com/SpecHive/SpecHive/commit/1012f6ad0247447620a76587e1c33e14033e8420))


### Bug Fixes

* **nestjs-common:** update bootstrap-app test to expect rawBody options arg ([770c4f0](https://github.com/SpecHive/SpecHive/commit/770c4f020230725005e759e3a06e20fe65bc297c))

## [0.0.5](https://github.com/SpecHive/SpecHive/compare/nestjs-common-v0.0.4...nestjs-common-v0.0.5) (2026-03-19)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.7

## [0.0.4](https://github.com/SpecHive/SpecHive/compare/nestjs-common-v0.0.3...nestjs-common-v0.0.4) (2026-03-18)


### Features

* **query-api,nestjs-common:** add Redis-backed login rate limiting ([df56b71](https://github.com/SpecHive/SpecHive/commit/df56b71be05615881a48581e4eebdddac5da3554))


### Bug Fixes

* **nestjs-common:** move Redis exports to subpath to fix Docker ioredis crash ([6d92ede](https://github.com/SpecHive/SpecHive/commit/6d92ede0cbd0892b3d8e682be1c9eafb43d96be4))

## [0.0.3](https://github.com/SpecHive/SpecHive/compare/nestjs-common-v0.0.2...nestjs-common-v0.0.3) (2026-03-17)


### Features

* **gateway:** add API gateway with auth, proxy routing, and dev networking fixes ([215edc3](https://github.com/SpecHive/SpecHive/commit/215edc333ebc0e65f0b63df9b0260e1f72b95395))


### Bug Fixes

* pre-release security hardening, RBAC, and code quality sweep ([f7cee0d](https://github.com/SpecHive/SpecHive/commit/f7cee0dfe2fd6e4f6b46f9aef218ef70b92a149d))

## [0.0.2](https://github.com/SpecHive/SpecHive/compare/nestjs-common-v0.0.1...nestjs-common-v0.0.2) (2026-03-14)


### Features

* add API Gateway with reverse proxy for multi-service routing ([06ae577](https://github.com/SpecHive/SpecHive/commit/06ae577e908b7b0e114eec941148b024cc923a4c))
* add barrel exports, plugin system, and cloud extension points ([2cb0c9b](https://github.com/SpecHive/SpecHive/commit/2cb0c9b734550bbdf0ac72edf0db015b39faec93))
* add enriched envelope schema, auth functions, s3 module, and shared utilities ([391928c](https://github.com/SpecHive/SpecHive/commit/391928c582d7783873862acd4f750d59809e4163))
* add S3 public endpoint, batch webhooks, and webhook secret validation ([fa5ded5](https://github.com/SpecHive/SpecHive/commit/fa5ded503dc0e3e6a4ee34e5503c266af8e53663))
* **database:** enhance seed script with multiple projects and complex test data ([4f0c5ba](https://github.com/SpecHive/SpecHive/commit/4f0c5ba561e1c158fb66974bba6814e359c482f1))
* harden auth with RLS context, extract outboxy adapter, add integration tests ([11be8ef](https://github.com/SpecHive/SpecHive/commit/11be8ef24acda650add8ca9be682ffe6b707c42d))
* **nestjs-common:** add health readiness probe with DB and S3 indicators ([f3cbb90](https://github.com/SpecHive/SpecHive/commit/f3cbb90afe1db620a4f2b8ce0676f6e4eab230bb))
* **platform:** add automatic artifact cleanup with S3 bulk delete ([2fe20b7](https://github.com/SpecHive/SpecHive/commit/2fe20b78f99b926243f323ae30df3e9f23ca33f6))
* **platform:** add graceful shutdown, parallelize queries, and shutdown integration test ([730d9c7](https://github.com/SpecHive/SpecHive/commit/730d9c74088f57ca6be8ab20c2dfb79524cce0ac))
* **platform:** add user profile management with password change ([928c470](https://github.com/SpecHive/SpecHive/commit/928c47096f426c13261ae4bc054493fedcb73b48))
* **platform:** orphaned run detection, status guards, flaky index, prod hardening ([3fdbe07](https://github.com/SpecHive/SpecHive/commit/3fdbe07aafe0ca0139a09981a3d220848f555732))
* **platform:** replace base64 artifact pipeline with direct S3 presigned uploads ([1ef92b1](https://github.com/SpecHive/SpecHive/commit/1ef92b1ead53f08cb804d004824b74ff6c850278))


### Bug Fixes

* address audit findings for db, config, code quality, and tests ([259b774](https://github.com/SpecHive/SpecHive/commit/259b77465302ef92cafb999eabab85b961fec3f0))
* harden security, extract shared health module, and expand test coverage ([7a3bbd6](https://github.com/SpecHive/SpecHive/commit/7a3bbd605d73d26d08ea539c820e902cfafcd47f))
* move NestJS peer deps to dependencies and fix docker init password substitution ([613f315](https://github.com/SpecHive/SpecHive/commit/613f315041d61e4d9be59024b1ebdd2fe08e9b37))
* **nestjs-common:** make DbHealthIndicator dependency optional ([9d3b75c](https://github.com/SpecHive/SpecHive/commit/9d3b75c1e2c69b188c8f2ccaea734fd36dcf5d87))
* **platform:** post-audit remediation — type safety, DRY, and defense-in-depth ([49c91f7](https://github.com/SpecHive/SpecHive/commit/49c91f7c9f58d76096acc85af20288c3122e49a2))
* resolve code quality findings for error filter, dry, validation, architecture ([41f8a6c](https://github.com/SpecHive/SpecHive/commit/41f8a6c0e88e244440bb5dea25db074798a299ef))
* resolve infrastructure findings for dockerfiles, ci, nginx, dependencies ([18e06a0](https://github.com/SpecHive/SpecHive/commit/18e06a0600ff83551923626c4648148e90d66c4b))
* resolve typecheck errors in worker and ingestion-api tests ([681ec09](https://github.com/SpecHive/SpecHive/commit/681ec096e32cee79a3a7b69ab018687eacd8d659))
* **security:** add refresh tokens, rate limiting, and tenant isolation tests ([34c41ef](https://github.com/SpecHive/SpecHive/commit/34c41efaba12ccff820acc2a5593d4238da1f3c0))


### Refactoring

* convert ingestion-api to publish-only mode ([07f5541](https://github.com/SpecHive/SpecHive/commit/07f5541fb4ec83f43f97011b4c71f501a5c10122))
* extract shared nestjs-common package, upgrade dashboard to vite 7 + nginx ([a733eab](https://github.com/SpecHive/SpecHive/commit/a733eab76472eb1afb407162baf08c85bcf75bf1))
* harden security, extract shared configs, and add org_id to project_tokens ([0845e3c](https://github.com/SpecHive/SpecHive/commit/0845e3c2d0c3f23fc71187b5558fe55c21816040))
* harden token hashing, extract shared bootstrap, and propagate org ids ([31a653b](https://github.com/SpecHive/SpecHive/commit/31a653bc9b6e828407cd0ab1991fd9b6853fcc00))
* migrate token auth to argon2, propagate org ids, and harden docker roles ([06a70d4](https://github.com/SpecHive/SpecHive/commit/06a70d48db9d123979014fe541c067fc3ce471fe))
* **platform:** extract shared infra, add runtime validation, DRY patterns ([8f06a56](https://github.com/SpecHive/SpecHive/commit/8f06a5619692d3b786d421c054bc6dd92897ccb6))
* scope minio credentials, add db constraints, and expand test coverage ([0f176b4](https://github.com/SpecHive/SpecHive/commit/0f176b481b7c0939f00aef2cc9400336ca381e1e))
