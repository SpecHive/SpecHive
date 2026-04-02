# Changelog

## [0.0.13](https://github.com/SpecHive/SpecHive/compare/ingestion-api-v0.0.12...ingestion-api-v0.0.13) (2026-04-02)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.12
    * @spechive/nestjs-common bumped to 0.0.13
    * @spechive/reporter-core-protocol bumped to 0.0.4
    * @spechive/shared-types bumped to 0.0.4

## [0.0.12](https://github.com/SpecHive/SpecHive/compare/ingestion-api-v0.0.11...ingestion-api-v0.0.12) (2026-03-29)


### Refactoring

* **nestjs-common:** migrate to nestjs-pino structured logging ([d511677](https://github.com/SpecHive/SpecHive/commit/d511677653c45c0b86d5d9cb1c890d33c1c438ff))
* **nestjs-common:** migrate to nestjs-pino structured logging ([d77e98e](https://github.com/SpecHive/SpecHive/commit/d77e98e60d6253ff16496974f0ab6c6fcb85c840))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.12

## [0.0.11](https://github.com/SpecHive/SpecHive/compare/ingestion-api-v0.0.10...ingestion-api-v0.0.11) (2026-03-26)


### Refactoring

* consolidate env vars — drop DASHBOARD_URL, rename WORKER_WEBHOOK_URL ([f517571](https://github.com/SpecHive/SpecHive/commit/f5175715fb81b8c165c2e0e2d5cab7d677d1e13e))
* reassign service ports with gateway as public entry on :3000 ([1f08b92](https://github.com/SpecHive/SpecHive/commit/1f08b92b20f11db202acbcdc4ca0e18e4de934c3))
* standardize ports and env management ([094d85c](https://github.com/SpecHive/SpecHive/commit/094d85cc748e961298f3125a52402b8145346573))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.11

## [0.0.10](https://github.com/SpecHive/SpecHive/compare/ingestion-api-v0.0.9...ingestion-api-v0.0.10) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.11
    * @spechive/nestjs-common bumped to 0.0.10

## [0.0.9](https://github.com/SpecHive/SpecHive/compare/ingestion-api-v0.0.8...ingestion-api-v0.0.9) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.10
    * @spechive/nestjs-common bumped to 0.0.9
    * @spechive/reporter-core-protocol bumped to 0.0.3
    * @spechive/shared-types bumped to 0.0.3
  * devDependencies
    * @spechive/typescript-config bumped to 0.0.4

## [0.0.8](https://github.com/SpecHive/SpecHive/compare/ingestion-api-v0.0.7...ingestion-api-v0.0.8) (2026-03-22)


### Features

* add API Gateway with reverse proxy for multi-service routing ([06ae577](https://github.com/SpecHive/SpecHive/commit/06ae577e908b7b0e114eec941148b024cc923a4c))
* add barrel exports, plugin system, and cloud extension points ([2cb0c9b](https://github.com/SpecHive/SpecHive/commit/2cb0c9b734550bbdf0ac72edf0db015b39faec93))
* add enriched envelope schema, auth functions, s3 module, and shared utilities ([391928c](https://github.com/SpecHive/SpecHive/commit/391928c582d7783873862acd4f750d59809e4163))
* add npm token secrets to docker builds, upgrade outboxy to v0.4.0 ([3f59e5f](https://github.com/SpecHive/SpecHive/commit/3f59e5f823acc406c35eaa23d8ca199e7aabc3df))
* add S3 public endpoint, batch webhooks, and webhook secret validation ([fa5ded5](https://github.com/SpecHive/SpecHive/commit/fa5ded503dc0e3e6a4ee34e5503c266af8e53663))
* **api:** project creation and token lifecycle management ([bf95b27](https://github.com/SpecHive/SpecHive/commit/bf95b2785569d656941c81cea806b67d68a65214))
* dashboard audit fixes, api-types package, worker auto-discovery, capabilities endpoint ([9ab143f](https://github.com/SpecHive/SpecHive/commit/9ab143ffd7bdb199db064fd1d7d810cf2c0f5364))
* **gateway:** add API gateway with auth, proxy routing, and dev networking fixes ([215edc3](https://github.com/SpecHive/SpecHive/commit/215edc333ebc0e65f0b63df9b0260e1f72b95395))
* harden auth with RLS context, extract outboxy adapter, add integration tests ([11be8ef](https://github.com/SpecHive/SpecHive/commit/11be8ef24acda650add8ca9be682ffe6b707c42d))
* **platform:** add automatic artifact cleanup with S3 bulk delete ([2fe20b7](https://github.com/SpecHive/SpecHive/commit/2fe20b78f99b926243f323ae30df3e9f23ca33f6))
* **platform:** orphaned run detection, status guards, flaky index, prod hardening ([3fdbe07](https://github.com/SpecHive/SpecHive/commit/3fdbe07aafe0ca0139a09981a3d220848f555732))
* **platform:** replace base64 artifact pipeline with direct S3 presigned uploads ([1ef92b1](https://github.com/SpecHive/SpecHive/commit/1ef92b1ead53f08cb804d004824b74ff6c850278))
* wire branded typescript ids, add postgresql row-level security ([2c9ab45](https://github.com/SpecHive/SpecHive/commit/2c9ab450bdf7361378ecef26401833bd1c5674f7))


### Bug Fixes

* activate rls tenant isolation, harden database and security baseline ([f1c7a46](https://github.com/SpecHive/SpecHive/commit/f1c7a466f6d2b49c9a4ed47e8776ebf613f90473))
* address audit findings for db, config, code quality, and tests ([259b774](https://github.com/SpecHive/SpecHive/commit/259b77465302ef92cafb999eabab85b961fec3f0))
* **docker:** use HUSKY=0 instead of --ignore-scripts to fix arm64 QEMU crash ([f605b37](https://github.com/SpecHive/SpecHive/commit/f605b37fc2e86d48a007faaf86377a50e52c47e7))
* harden security, extract shared health module, and expand test coverage ([7a3bbd6](https://github.com/SpecHive/SpecHive/commit/7a3bbd605d73d26d08ea539c820e902cfafcd47f))
* move NestJS peer deps to dependencies and fix docker init password substitution ([613f315](https://github.com/SpecHive/SpecHive/commit/613f315041d61e4d9be59024b1ebdd2fe08e9b37))
* **platform:** post-audit remediation — type safety, DRY, and defense-in-depth ([49c91f7](https://github.com/SpecHive/SpecHive/commit/49c91f7c9f58d76096acc85af20288c3122e49a2))
* pre-release security hardening, RBAC, and code quality sweep ([f7cee0d](https://github.com/SpecHive/SpecHive/commit/f7cee0dfe2fd6e4f6b46f9aef218ef70b92a149d))
* remove outboxy-api service and harden env validation ([11f4b69](https://github.com/SpecHive/SpecHive/commit/11f4b693e5d3661ec02af8194ddc265a8b63fd8f))
* resolve all critical sprint 0 audit findings ([87e3237](https://github.com/SpecHive/SpecHive/commit/87e3237ab494090fca12328340161f40cf1aa334))
* resolve code quality findings for error filter, dry, validation, architecture ([41f8a6c](https://github.com/SpecHive/SpecHive/commit/41f8a6c0e88e244440bb5dea25db074798a299ef))
* resolve infrastructure findings for dockerfiles, ci, nginx, dependencies ([18e06a0](https://github.com/SpecHive/SpecHive/commit/18e06a0600ff83551923626c4648148e90d66c4b))
* resolve minio-init infinite wait and remove unused export ([e7e9db4](https://github.com/SpecHive/SpecHive/commit/e7e9db49129fff79d509ad32a656d4097eff3849))
* resolve sprint 0 audit findings across monorepo ([945a319](https://github.com/SpecHive/SpecHive/commit/945a319a92db62c311ac79b6154a8f8f4fee850b))
* resolve sprint 0 audit quick-win findings ([e9f6e99](https://github.com/SpecHive/SpecHive/commit/e9f6e997865648f1924f284e103a8ca4873324bf))
* resolve typecheck errors in worker and ingestion-api tests ([681ec09](https://github.com/SpecHive/SpecHive/commit/681ec096e32cee79a3a7b69ab018687eacd8d659))
* **security:** add refresh tokens, rate limiting, and tenant isolation tests ([34c41ef](https://github.com/SpecHive/SpecHive/commit/34c41efaba12ccff820acc2a5593d4238da1f3c0))
* squash migrations, correct transaction types, and harden docker healthchecks ([a9c539f](https://github.com/SpecHive/SpecHive/commit/a9c539fe28a2fd31925068febe7fcf583146b4da))


### Refactoring

* convert ingestion-api to publish-only mode ([07f5541](https://github.com/SpecHive/SpecHive/commit/07f5541fb4ec83f43f97011b4c71f501a5c10122))
* extract shared nestjs-common package, upgrade dashboard to vite 7 + nginx ([a733eab](https://github.com/SpecHive/SpecHive/commit/a733eab76472eb1afb407162baf08c85bcf75bf1))
* harden security, extract shared configs, and add org_id to project_tokens ([0845e3c](https://github.com/SpecHive/SpecHive/commit/0845e3c2d0c3f23fc71187b5558fe55c21816040))
* harden token hashing, extract shared bootstrap, and propagate org ids ([31a653b](https://github.com/SpecHive/SpecHive/commit/31a653bc9b6e828407cd0ab1991fd9b6853fcc00))
* migrate token auth to argon2, propagate org ids, and harden docker roles ([06a70d4](https://github.com/SpecHive/SpecHive/commit/06a70d48db9d123979014fe541c067fc3ce471fe))
* **platform:** extract shared infra, add runtime validation, DRY patterns ([8f06a56](https://github.com/SpecHive/SpecHive/commit/8f06a5619692d3b786d421c054bc6dd92897ccb6))
* scope minio credentials, add db constraints, and expand test coverage ([0f176b4](https://github.com/SpecHive/SpecHive/commit/0f176b481b7c0939f00aef2cc9400336ca381e1e))
* **test:** consolidate test utilities into shared helpers ([1ac1013](https://github.com/SpecHive/SpecHive/commit/1ac101336e5e57f34d31037c74f27ed0bad975d8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.9
    * @spechive/nestjs-common bumped to 0.0.8

## [0.0.7](https://github.com/SpecHive/SpecHive/compare/ingestion-api-v0.0.6...ingestion-api-v0.0.7) (2026-03-22)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.8
    * @spechive/nestjs-common bumped to 0.0.7

## [0.0.6](https://github.com/SpecHive/SpecHive/compare/ingestion-api-v0.0.5...ingestion-api-v0.0.6) (2026-03-21)


### Bug Fixes

* remove outboxy-api service and harden env validation ([11f4b69](https://github.com/SpecHive/SpecHive/commit/11f4b693e5d3661ec02af8194ddc265a8b63fd8f))

## [0.0.5](https://github.com/SpecHive/SpecHive/compare/ingestion-api-v0.0.4...ingestion-api-v0.0.5) (2026-03-20)


### Bug Fixes

* **docker:** use HUSKY=0 instead of --ignore-scripts to fix arm64 QEMU crash ([f605b37](https://github.com/SpecHive/SpecHive/commit/f605b37fc2e86d48a007faaf86377a50e52c47e7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.6

## [0.0.4](https://github.com/SpecHive/SpecHive/compare/ingestion-api-v0.0.3...ingestion-api-v0.0.4) (2026-03-19)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.7
    * @spechive/nestjs-common bumped to 0.0.5

## [0.0.3](https://github.com/SpecHive/SpecHive/compare/ingestion-api-v0.0.2...ingestion-api-v0.0.3) (2026-03-17)


### Features

* **gateway:** add API gateway with auth, proxy routing, and dev networking fixes ([215edc3](https://github.com/SpecHive/SpecHive/commit/215edc333ebc0e65f0b63df9b0260e1f72b95395))


### Bug Fixes

* pre-release security hardening, RBAC, and code quality sweep ([f7cee0d](https://github.com/SpecHive/SpecHive/commit/f7cee0dfe2fd6e4f6b46f9aef218ef70b92a149d))

## [0.0.2](https://github.com/SpecHive/SpecHive/compare/ingestion-api-v0.0.1...ingestion-api-v0.0.2) (2026-03-14)


### Features

* add API Gateway with reverse proxy for multi-service routing ([06ae577](https://github.com/SpecHive/SpecHive/commit/06ae577e908b7b0e114eec941148b024cc923a4c))
* add barrel exports, plugin system, and cloud extension points ([2cb0c9b](https://github.com/SpecHive/SpecHive/commit/2cb0c9b734550bbdf0ac72edf0db015b39faec93))
* add enriched envelope schema, auth functions, s3 module, and shared utilities ([391928c](https://github.com/SpecHive/SpecHive/commit/391928c582d7783873862acd4f750d59809e4163))
* add npm token secrets to docker builds, upgrade outboxy to v0.4.0 ([3f59e5f](https://github.com/SpecHive/SpecHive/commit/3f59e5f823acc406c35eaa23d8ca199e7aabc3df))
* add S3 public endpoint, batch webhooks, and webhook secret validation ([fa5ded5](https://github.com/SpecHive/SpecHive/commit/fa5ded503dc0e3e6a4ee34e5503c266af8e53663))
* **api:** project creation and token lifecycle management ([bf95b27](https://github.com/SpecHive/SpecHive/commit/bf95b2785569d656941c81cea806b67d68a65214))
* dashboard audit fixes, api-types package, worker auto-discovery, capabilities endpoint ([9ab143f](https://github.com/SpecHive/SpecHive/commit/9ab143ffd7bdb199db064fd1d7d810cf2c0f5364))
* harden auth with RLS context, extract outboxy adapter, add integration tests ([11be8ef](https://github.com/SpecHive/SpecHive/commit/11be8ef24acda650add8ca9be682ffe6b707c42d))
* **platform:** add automatic artifact cleanup with S3 bulk delete ([2fe20b7](https://github.com/SpecHive/SpecHive/commit/2fe20b78f99b926243f323ae30df3e9f23ca33f6))
* **platform:** orphaned run detection, status guards, flaky index, prod hardening ([3fdbe07](https://github.com/SpecHive/SpecHive/commit/3fdbe07aafe0ca0139a09981a3d220848f555732))
* **platform:** replace base64 artifact pipeline with direct S3 presigned uploads ([1ef92b1](https://github.com/SpecHive/SpecHive/commit/1ef92b1ead53f08cb804d004824b74ff6c850278))
* wire branded typescript ids, add postgresql row-level security ([2c9ab45](https://github.com/SpecHive/SpecHive/commit/2c9ab450bdf7361378ecef26401833bd1c5674f7))


### Bug Fixes

* activate rls tenant isolation, harden database and security baseline ([f1c7a46](https://github.com/SpecHive/SpecHive/commit/f1c7a466f6d2b49c9a4ed47e8776ebf613f90473))
* address audit findings for db, config, code quality, and tests ([259b774](https://github.com/SpecHive/SpecHive/commit/259b77465302ef92cafb999eabab85b961fec3f0))
* harden security, extract shared health module, and expand test coverage ([7a3bbd6](https://github.com/SpecHive/SpecHive/commit/7a3bbd605d73d26d08ea539c820e902cfafcd47f))
* move NestJS peer deps to dependencies and fix docker init password substitution ([613f315](https://github.com/SpecHive/SpecHive/commit/613f315041d61e4d9be59024b1ebdd2fe08e9b37))
* **platform:** post-audit remediation — type safety, DRY, and defense-in-depth ([49c91f7](https://github.com/SpecHive/SpecHive/commit/49c91f7c9f58d76096acc85af20288c3122e49a2))
* resolve all critical sprint 0 audit findings ([87e3237](https://github.com/SpecHive/SpecHive/commit/87e3237ab494090fca12328340161f40cf1aa334))
* resolve code quality findings for error filter, dry, validation, architecture ([41f8a6c](https://github.com/SpecHive/SpecHive/commit/41f8a6c0e88e244440bb5dea25db074798a299ef))
* resolve infrastructure findings for dockerfiles, ci, nginx, dependencies ([18e06a0](https://github.com/SpecHive/SpecHive/commit/18e06a0600ff83551923626c4648148e90d66c4b))
* resolve minio-init infinite wait and remove unused export ([e7e9db4](https://github.com/SpecHive/SpecHive/commit/e7e9db49129fff79d509ad32a656d4097eff3849))
* resolve sprint 0 audit findings across monorepo ([945a319](https://github.com/SpecHive/SpecHive/commit/945a319a92db62c311ac79b6154a8f8f4fee850b))
* resolve sprint 0 audit quick-win findings ([e9f6e99](https://github.com/SpecHive/SpecHive/commit/e9f6e997865648f1924f284e103a8ca4873324bf))
* resolve typecheck errors in worker and ingestion-api tests ([681ec09](https://github.com/SpecHive/SpecHive/commit/681ec096e32cee79a3a7b69ab018687eacd8d659))
* **security:** add refresh tokens, rate limiting, and tenant isolation tests ([34c41ef](https://github.com/SpecHive/SpecHive/commit/34c41efaba12ccff820acc2a5593d4238da1f3c0))
* squash migrations, correct transaction types, and harden docker healthchecks ([a9c539f](https://github.com/SpecHive/SpecHive/commit/a9c539fe28a2fd31925068febe7fcf583146b4da))


### Refactoring

* convert ingestion-api to publish-only mode ([07f5541](https://github.com/SpecHive/SpecHive/commit/07f5541fb4ec83f43f97011b4c71f501a5c10122))
* extract shared nestjs-common package, upgrade dashboard to vite 7 + nginx ([a733eab](https://github.com/SpecHive/SpecHive/commit/a733eab76472eb1afb407162baf08c85bcf75bf1))
* harden security, extract shared configs, and add org_id to project_tokens ([0845e3c](https://github.com/SpecHive/SpecHive/commit/0845e3c2d0c3f23fc71187b5558fe55c21816040))
* harden token hashing, extract shared bootstrap, and propagate org ids ([31a653b](https://github.com/SpecHive/SpecHive/commit/31a653bc9b6e828407cd0ab1991fd9b6853fcc00))
* migrate token auth to argon2, propagate org ids, and harden docker roles ([06a70d4](https://github.com/SpecHive/SpecHive/commit/06a70d48db9d123979014fe541c067fc3ce471fe))
* **platform:** extract shared infra, add runtime validation, DRY patterns ([8f06a56](https://github.com/SpecHive/SpecHive/commit/8f06a5619692d3b786d421c054bc6dd92897ccb6))
* scope minio credentials, add db constraints, and expand test coverage ([0f176b4](https://github.com/SpecHive/SpecHive/commit/0f176b481b7c0939f00aef2cc9400336ca381e1e))
* **test:** consolidate test utilities into shared helpers ([1ac1013](https://github.com/SpecHive/SpecHive/commit/1ac101336e5e57f34d31037c74f27ed0bad975d8))
