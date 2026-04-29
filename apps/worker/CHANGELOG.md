# Changelog

## [0.0.17](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.16...worker-v0.0.17) (2026-04-28)


### Features

* **observability:** metrics and dashboards ([5a4cbc3](https://github.com/SpecHive/SpecHive/commit/5a4cbc3307e13f2a035611dbdb176ae436d65958))
* **observability:** metrics and dashboards ([b6a11e1](https://github.com/SpecHive/SpecHive/commit/b6a11e1823e7d1a85e8a34d0614653a896fc0232))


### Bug Fixes

* correct broken spechive-dev/spechive URL references across repo ([6e89f17](https://github.com/SpecHive/SpecHive/commit/6e89f171e9fa41a8cc3119a2ceab26d3bd83fc9e))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.14
    * @spechive/nestjs-common bumped to 0.0.18
    * @spechive/reporter-core-protocol bumped to 0.0.5
    * @spechive/shared-types bumped to 0.0.5
  * devDependencies
    * @spechive/typescript-config bumped to 0.0.5

## [0.0.16](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.15...worker-v0.0.16) (2026-04-15)


### Bug Fixes

* resolve all pnpm audit vulnerabilities ([0b771d0](https://github.com/SpecHive/SpecHive/commit/0b771d07d9352dc670bea746a4ff614365491872))
* resolve DLQ'd events from phantom suite IDs ([01fd632](https://github.com/SpecHive/SpecHive/commit/01fd63249749a1bf8e0a29059feccc81d3997d85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.13
    * @spechive/nestjs-common bumped to 0.0.17

## [0.0.15](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.14...worker-v0.0.15) (2026-04-04)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.16

## [0.0.14](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.13...worker-v0.0.14) (2026-04-04)


### Features

* **dashboard:** add real-time updates via Server-Sent Events ([9a5b43b](https://github.com/SpecHive/SpecHive/commit/9a5b43b7c7fbc252ef52e4e8c1cea0bc00e3a396))
* **dashboard:** add real-time updates via Server-Sent Events ([4e53a5f](https://github.com/SpecHive/SpecHive/commit/4e53a5fcc87f9d4700787e8853fdfe692414597c))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.15

## [0.0.13](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.12...worker-v0.0.13) (2026-04-02)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.14

## [0.0.12](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.11...worker-v0.0.12) (2026-04-02)


### Features

* add expectedTests, immediate test events, reliability fixes ([e2fed12](https://github.com/SpecHive/SpecHive/commit/e2fed12a0387fa5b6505ca5825e6863132385e8d))
* add expectedTests, immediate test events, reliability fixes ([15b45f8](https://github.com/SpecHive/SpecHive/commit/15b45f8dee58d425a8f03f18a74737269f052365))
* add structured error fields to test detail and persist from worker ([79597b1](https://github.com/SpecHive/SpecHive/commit/79597b128a93d2ea501b9efde0a389f2087ac44f))
* error fingerprinting ([d100c59](https://github.com/SpecHive/SpecHive/commit/d100c597a3c68ab25a79b7aa9f9736458b289e43))
* error fingerprinting with date-scoped lastSeenAt ([2e89efd](https://github.com/SpecHive/SpecHive/commit/2e89efdf7a9a4b49dd080b9ca904a5bb498a8939))
* improve error fingerprinting with reporter-first architecture and UX enhancements ([733e2be](https://github.com/SpecHive/SpecHive/commit/733e2bea925894931b4c3e95105d0fbb2409eb39))


### Bug Fixes

* address error explorer code review — correctness, quality, and test coverage ([f40fb1b](https://github.com/SpecHive/SpecHive/commit/f40fb1bd959cee7dfb9c38f789d3450156383d2e))
* address error explorer code review findings ([3e2df9a](https://github.com/SpecHive/SpecHive/commit/3e2df9a7408e0e31da5784845d76914793deb2af))
* address error explorer review — correctness, perf, and UX issues ([e3e052a](https://github.com/SpecHive/SpecHive/commit/e3e052a0533cbc9ab05546a3d2ea658fcda850d1))
* address error explorer review — correctness, UX, and documentation ([661aad1](https://github.com/SpecHive/SpecHive/commit/661aad147d90ba56b8b0b429b0ab31ee67e9f59a))
* address error explorer review — fingerprint normalization, ANSI safety, and UX ([6a8b7d1](https://github.com/SpecHive/SpecHive/commit/6a8b7d1137996151aac63c942cf3d908a19445a3))
* address error explorer review — security, correctness, and shared hooks ([2e7019f](https://github.com/SpecHive/SpecHive/commit/2e7019f11944de2c261b1ca7c5ac4f52d968c75c))
* harden error fingerprinting, explorer queries, and reporter parsing ([7edba06](https://github.com/SpecHive/SpecHive/commit/7edba0626751877551f48a84f0f881aa976d4d26))


### Refactoring

* address error explorer review — dead index, stale code, type safety ([8156398](https://github.com/SpecHive/SpecHive/commit/8156398c2799e0ea572a0f25a7146c0814598464))
* simplify error explorer — remove dual-path queries and fix review findings ([5220572](https://github.com/SpecHive/SpecHive/commit/5220572fa851434158f9bea23181d9156f562ec1))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.12
    * @spechive/nestjs-common bumped to 0.0.13
    * @spechive/reporter-core-protocol bumped to 0.0.4
    * @spechive/shared-types bumped to 0.0.4

## [0.0.11](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.10...worker-v0.0.11) (2026-03-29)


### Refactoring

* **nestjs-common:** migrate to nestjs-pino structured logging ([d511677](https://github.com/SpecHive/SpecHive/commit/d511677653c45c0b86d5d9cb1c890d33c1c438ff))
* **nestjs-common:** migrate to nestjs-pino structured logging ([d77e98e](https://github.com/SpecHive/SpecHive/commit/d77e98e60d6253ff16496974f0ab6c6fcb85c840))
* **worker:** complete structured logging migration to pino format ([ed80bc2](https://github.com/SpecHive/SpecHive/commit/ed80bc2a913a3dd809679f4031f5a8bb0623e476))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.12

## [0.0.10](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.9...worker-v0.0.10) (2026-03-26)


### Refactoring

* reassign service ports with gateway as public entry on :3000 ([1f08b92](https://github.com/SpecHive/SpecHive/commit/1f08b92b20f11db202acbcdc4ca0e18e4de934c3))
* standardize ports and env management ([094d85c](https://github.com/SpecHive/SpecHive/commit/094d85cc748e961298f3125a52402b8145346573))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.11

## [0.0.9](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.8...worker-v0.0.9) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.11
    * @spechive/nestjs-common bumped to 0.0.10

## [0.0.8](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.7...worker-v0.0.8) (2026-03-24)


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

## [0.0.7](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.6...worker-v0.0.7) (2026-03-22)


### Features

* add barrel exports, plugin system, and cloud extension points ([2cb0c9b](https://github.com/SpecHive/SpecHive/commit/2cb0c9b734550bbdf0ac72edf0db015b39faec93))
* add event handler architecture to worker with db and s3 integration ([413074b](https://github.com/SpecHive/SpecHive/commit/413074ba9fa3da33ae8359bd03a2ce97340906ef))
* add npm token secrets to docker builds, upgrade outboxy to v0.4.0 ([3f59e5f](https://github.com/SpecHive/SpecHive/commit/3f59e5f823acc406c35eaa23d8ca199e7aabc3df))
* add S3 public endpoint, batch webhooks, and webhook secret validation ([fa5ded5](https://github.com/SpecHive/SpecHive/commit/fa5ded503dc0e3e6a4ee34e5503c266af8e53663))
* **analytics:** implement daily pre-aggregation and analytics service ([#2](https://github.com/SpecHive/SpecHive/issues/2).2/[#2](https://github.com/SpecHive/SpecHive/issues/2).3) ([ecc5ec9](https://github.com/SpecHive/SpecHive/commit/ecc5ec9b449f2bf61e0ba09402327d292fe48086))
* dashboard audit fixes, api-types package, worker auto-discovery, capabilities endpoint ([9ab143f](https://github.com/SpecHive/SpecHive/commit/9ab143ffd7bdb199db064fd1d7d810cf2c0f5364))
* **database:** add name column to runs table ([1377b85](https://github.com/SpecHive/SpecHive/commit/1377b85afabde15ed32464a26e8ba938dc50d340))
* **database:** add pre-aggregation tables and partition tests/test_attempts ([85bce24](https://github.com/SpecHive/SpecHive/commit/85bce240b03726cfa510436cd4ab7e3c7ab0bcad))
* **database:** enhance seed script with multiple projects and complex test data ([4f0c5ba](https://github.com/SpecHive/SpecHive/commit/4f0c5ba561e1c158fb66974bba6814e359c482f1))
* **gateway:** add API gateway with auth, proxy routing, and dev networking fixes ([215edc3](https://github.com/SpecHive/SpecHive/commit/215edc333ebc0e65f0b63df9b0260e1f72b95395))
* harden auth with RLS context, extract outboxy adapter, add integration tests ([11be8ef](https://github.com/SpecHive/SpecHive/commit/11be8ef24acda650add8ca9be682ffe6b707c42d))
* **platform:** add automatic artifact cleanup with S3 bulk delete ([2fe20b7](https://github.com/SpecHive/SpecHive/commit/2fe20b78f99b926243f323ae30df3e9f23ca33f6))
* **platform:** add automatic CI environment detection for test runs ([da2e126](https://github.com/SpecHive/SpecHive/commit/da2e1267e0d491ae37ee2e93a1bc8a67b939a8ed))
* **platform:** add test retry attempt tracking with per-attempt visibility ([e3c3358](https://github.com/SpecHive/SpecHive/commit/e3c3358575486001976f6e8c463582702834751a))
* **platform:** orphaned run detection, status guards, flaky index, prod hardening ([3fdbe07](https://github.com/SpecHive/SpecHive/commit/3fdbe07aafe0ca0139a09981a3d220848f555732))
* **platform:** replace base64 artifact pipeline with direct S3 presigned uploads ([1ef92b1](https://github.com/SpecHive/SpecHive/commit/1ef92b1ead53f08cb804d004824b74ff6c850278))
* **worker:** add scheduled cleanup for stale pending artifacts ([76fcac0](https://github.com/SpecHive/SpecHive/commit/76fcac0ae54ec80a5733938b4f710d7658dce745))
* **worker:** strip ANSI escape codes from error messages and stack traces ([237c739](https://github.com/SpecHive/SpecHive/commit/237c73962b5d0b00ee27af34cbf0f085a68a62f5))


### Bug Fixes

* activate rls tenant isolation, harden database and security baseline ([f1c7a46](https://github.com/SpecHive/SpecHive/commit/f1c7a466f6d2b49c9a4ed47e8776ebf613f90473))
* address audit findings for config, dry, type safety, tests, and architecture ([1583d68](https://github.com/SpecHive/SpecHive/commit/1583d68ee951b435daaf5aeff89cfa301e496a54))
* address audit findings for db, config, code quality, and tests ([259b774](https://github.com/SpecHive/SpecHive/commit/259b77465302ef92cafb999eabab85b961fec3f0))
* **docker:** use HUSKY=0 instead of --ignore-scripts to fix arm64 QEMU crash ([f605b37](https://github.com/SpecHive/SpecHive/commit/f605b37fc2e86d48a007faaf86377a50e52c47e7))
* harden security, extract shared health module, and expand test coverage ([7a3bbd6](https://github.com/SpecHive/SpecHive/commit/7a3bbd605d73d26d08ea539c820e902cfafcd47f))
* move NestJS peer deps to dependencies and fix docker init password substitution ([613f315](https://github.com/SpecHive/SpecHive/commit/613f315041d61e4d9be59024b1ebdd2fe08e9b37))
* **platform:** critical audit fixes — Dockerfiles, CI, artifact states, timing oracle, deps ([073e88b](https://github.com/SpecHive/SpecHive/commit/073e88bfa2671760d06ee251fc5e412acf5fdedd))
* **platform:** post-audit remediation — type safety, DRY, and defense-in-depth ([49c91f7](https://github.com/SpecHive/SpecHive/commit/49c91f7c9f58d76096acc85af20288c3122e49a2))
* pre-release security hardening, RBAC, and code quality sweep ([f7cee0d](https://github.com/SpecHive/SpecHive/commit/f7cee0dfe2fd6e4f6b46f9aef218ef70b92a149d))
* resolve all critical sprint 0 audit findings ([87e3237](https://github.com/SpecHive/SpecHive/commit/87e3237ab494090fca12328340161f40cf1aa334))
* resolve code quality findings for error filter, dry, validation, architecture ([41f8a6c](https://github.com/SpecHive/SpecHive/commit/41f8a6c0e88e244440bb5dea25db074798a299ef))
* resolve infrastructure findings for dockerfiles, ci, nginx, dependencies ([18e06a0](https://github.com/SpecHive/SpecHive/commit/18e06a0600ff83551923626c4648148e90d66c4b))
* resolve sprint 0 audit findings across monorepo ([945a319](https://github.com/SpecHive/SpecHive/commit/945a319a92db62c311ac79b6154a8f8f4fee850b))
* resolve sprint 0 audit quick-win findings ([e9f6e99](https://github.com/SpecHive/SpecHive/commit/e9f6e997865648f1924f284e103a8ca4873324bf))
* **security:** add refresh tokens, rate limiting, and tenant isolation tests ([34c41ef](https://github.com/SpecHive/SpecHive/commit/34c41efaba12ccff820acc2a5593d4238da1f3c0))
* **worker,tests:** fix Date serialization in analytics handlers and seed stats tables in tests ([e1e9054](https://github.com/SpecHive/SpecHive/commit/e1e9054e88dd3fe9b9654f46fb242c7512fc0d08))


### Refactoring

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

## [0.0.6](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.5...worker-v0.0.6) (2026-03-22)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.8
    * @spechive/nestjs-common bumped to 0.0.7

## [0.0.5](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.4...worker-v0.0.5) (2026-03-20)


### Bug Fixes

* **docker:** use HUSKY=0 instead of --ignore-scripts to fix arm64 QEMU crash ([f605b37](https://github.com/SpecHive/SpecHive/commit/f605b37fc2e86d48a007faaf86377a50e52c47e7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.6

## [0.0.4](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.3...worker-v0.0.4) (2026-03-19)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.7
    * @spechive/nestjs-common bumped to 0.0.5

## [0.0.3](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.2...worker-v0.0.3) (2026-03-17)


### Features

* **analytics:** implement daily pre-aggregation and analytics service ([#2](https://github.com/SpecHive/SpecHive/issues/2).2/[#2](https://github.com/SpecHive/SpecHive/issues/2).3) ([ecc5ec9](https://github.com/SpecHive/SpecHive/commit/ecc5ec9b449f2bf61e0ba09402327d292fe48086))
* **database:** add pre-aggregation tables and partition tests/test_attempts ([85bce24](https://github.com/SpecHive/SpecHive/commit/85bce240b03726cfa510436cd4ab7e3c7ab0bcad))
* **gateway:** add API gateway with auth, proxy routing, and dev networking fixes ([215edc3](https://github.com/SpecHive/SpecHive/commit/215edc333ebc0e65f0b63df9b0260e1f72b95395))


### Bug Fixes

* pre-release security hardening, RBAC, and code quality sweep ([f7cee0d](https://github.com/SpecHive/SpecHive/commit/f7cee0dfe2fd6e4f6b46f9aef218ef70b92a149d))
* **worker,tests:** fix Date serialization in analytics handlers and seed stats tables in tests ([e1e9054](https://github.com/SpecHive/SpecHive/commit/e1e9054e88dd3fe9b9654f46fb242c7512fc0d08))

## [0.0.2](https://github.com/SpecHive/SpecHive/compare/worker-v0.0.1...worker-v0.0.2) (2026-03-14)


### Features

* add barrel exports, plugin system, and cloud extension points ([2cb0c9b](https://github.com/SpecHive/SpecHive/commit/2cb0c9b734550bbdf0ac72edf0db015b39faec93))
* add event handler architecture to worker with db and s3 integration ([413074b](https://github.com/SpecHive/SpecHive/commit/413074ba9fa3da33ae8359bd03a2ce97340906ef))
* add npm token secrets to docker builds, upgrade outboxy to v0.4.0 ([3f59e5f](https://github.com/SpecHive/SpecHive/commit/3f59e5f823acc406c35eaa23d8ca199e7aabc3df))
* add S3 public endpoint, batch webhooks, and webhook secret validation ([fa5ded5](https://github.com/SpecHive/SpecHive/commit/fa5ded503dc0e3e6a4ee34e5503c266af8e53663))
* dashboard audit fixes, api-types package, worker auto-discovery, capabilities endpoint ([9ab143f](https://github.com/SpecHive/SpecHive/commit/9ab143ffd7bdb199db064fd1d7d810cf2c0f5364))
* **database:** add name column to runs table ([1377b85](https://github.com/SpecHive/SpecHive/commit/1377b85afabde15ed32464a26e8ba938dc50d340))
* **database:** enhance seed script with multiple projects and complex test data ([4f0c5ba](https://github.com/SpecHive/SpecHive/commit/4f0c5ba561e1c158fb66974bba6814e359c482f1))
* harden auth with RLS context, extract outboxy adapter, add integration tests ([11be8ef](https://github.com/SpecHive/SpecHive/commit/11be8ef24acda650add8ca9be682ffe6b707c42d))
* **platform:** add automatic artifact cleanup with S3 bulk delete ([2fe20b7](https://github.com/SpecHive/SpecHive/commit/2fe20b78f99b926243f323ae30df3e9f23ca33f6))
* **platform:** add automatic CI environment detection for test runs ([da2e126](https://github.com/SpecHive/SpecHive/commit/da2e1267e0d491ae37ee2e93a1bc8a67b939a8ed))
* **platform:** add test retry attempt tracking with per-attempt visibility ([e3c3358](https://github.com/SpecHive/SpecHive/commit/e3c3358575486001976f6e8c463582702834751a))
* **platform:** orphaned run detection, status guards, flaky index, prod hardening ([3fdbe07](https://github.com/SpecHive/SpecHive/commit/3fdbe07aafe0ca0139a09981a3d220848f555732))
* **platform:** replace base64 artifact pipeline with direct S3 presigned uploads ([1ef92b1](https://github.com/SpecHive/SpecHive/commit/1ef92b1ead53f08cb804d004824b74ff6c850278))
* **worker:** add scheduled cleanup for stale pending artifacts ([76fcac0](https://github.com/SpecHive/SpecHive/commit/76fcac0ae54ec80a5733938b4f710d7658dce745))
* **worker:** strip ANSI escape codes from error messages and stack traces ([237c739](https://github.com/SpecHive/SpecHive/commit/237c73962b5d0b00ee27af34cbf0f085a68a62f5))


### Bug Fixes

* activate rls tenant isolation, harden database and security baseline ([f1c7a46](https://github.com/SpecHive/SpecHive/commit/f1c7a466f6d2b49c9a4ed47e8776ebf613f90473))
* address audit findings for config, dry, type safety, tests, and architecture ([1583d68](https://github.com/SpecHive/SpecHive/commit/1583d68ee951b435daaf5aeff89cfa301e496a54))
* address audit findings for db, config, code quality, and tests ([259b774](https://github.com/SpecHive/SpecHive/commit/259b77465302ef92cafb999eabab85b961fec3f0))
* harden security, extract shared health module, and expand test coverage ([7a3bbd6](https://github.com/SpecHive/SpecHive/commit/7a3bbd605d73d26d08ea539c820e902cfafcd47f))
* move NestJS peer deps to dependencies and fix docker init password substitution ([613f315](https://github.com/SpecHive/SpecHive/commit/613f315041d61e4d9be59024b1ebdd2fe08e9b37))
* **platform:** critical audit fixes — Dockerfiles, CI, artifact states, timing oracle, deps ([073e88b](https://github.com/SpecHive/SpecHive/commit/073e88bfa2671760d06ee251fc5e412acf5fdedd))
* **platform:** post-audit remediation — type safety, DRY, and defense-in-depth ([49c91f7](https://github.com/SpecHive/SpecHive/commit/49c91f7c9f58d76096acc85af20288c3122e49a2))
* resolve all critical sprint 0 audit findings ([87e3237](https://github.com/SpecHive/SpecHive/commit/87e3237ab494090fca12328340161f40cf1aa334))
* resolve code quality findings for error filter, dry, validation, architecture ([41f8a6c](https://github.com/SpecHive/SpecHive/commit/41f8a6c0e88e244440bb5dea25db074798a299ef))
* resolve infrastructure findings for dockerfiles, ci, nginx, dependencies ([18e06a0](https://github.com/SpecHive/SpecHive/commit/18e06a0600ff83551923626c4648148e90d66c4b))
* resolve sprint 0 audit findings across monorepo ([945a319](https://github.com/SpecHive/SpecHive/commit/945a319a92db62c311ac79b6154a8f8f4fee850b))
* resolve sprint 0 audit quick-win findings ([e9f6e99](https://github.com/SpecHive/SpecHive/commit/e9f6e997865648f1924f284e103a8ca4873324bf))
* **security:** add refresh tokens, rate limiting, and tenant isolation tests ([34c41ef](https://github.com/SpecHive/SpecHive/commit/34c41efaba12ccff820acc2a5593d4238da1f3c0))


### Refactoring

* extract shared nestjs-common package, upgrade dashboard to vite 7 + nginx ([a733eab](https://github.com/SpecHive/SpecHive/commit/a733eab76472eb1afb407162baf08c85bcf75bf1))
* harden security, extract shared configs, and add org_id to project_tokens ([0845e3c](https://github.com/SpecHive/SpecHive/commit/0845e3c2d0c3f23fc71187b5558fe55c21816040))
* harden token hashing, extract shared bootstrap, and propagate org ids ([31a653b](https://github.com/SpecHive/SpecHive/commit/31a653bc9b6e828407cd0ab1991fd9b6853fcc00))
* migrate token auth to argon2, propagate org ids, and harden docker roles ([06a70d4](https://github.com/SpecHive/SpecHive/commit/06a70d48db9d123979014fe541c067fc3ce471fe))
* **platform:** extract shared infra, add runtime validation, DRY patterns ([8f06a56](https://github.com/SpecHive/SpecHive/commit/8f06a5619692d3b786d421c054bc6dd92897ccb6))
* scope minio credentials, add db constraints, and expand test coverage ([0f176b4](https://github.com/SpecHive/SpecHive/commit/0f176b481b7c0939f00aef2cc9400336ca381e1e))
* **test:** consolidate test utilities into shared helpers ([1ac1013](https://github.com/SpecHive/SpecHive/commit/1ac101336e5e57f34d31037c74f27ed0bad975d8))
