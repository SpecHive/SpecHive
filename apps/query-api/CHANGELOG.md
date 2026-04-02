# Changelog

## [0.0.14](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.13...query-api-v0.0.14) (2026-04-02)


### Bug Fixes

* **query-api:** export ErrorsModule from modules barrel ([ca376a0](https://github.com/SpecHive/SpecHive/commit/ca376a09a6f04df71f5dc4cf9ed78cf6b4a90ebd))

## [0.0.13](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.12...query-api-v0.0.13) (2026-04-02)


### Features

* add expectedTests, immediate test events, reliability fixes ([e2fed12](https://github.com/SpecHive/SpecHive/commit/e2fed12a0387fa5b6505ca5825e6863132385e8d))
* add expectedTests, immediate test events, reliability fixes ([15b45f8](https://github.com/SpecHive/SpecHive/commit/15b45f8dee58d425a8f03f18a74737269f052365))
* add structured error fields to test detail and persist from worker ([79597b1](https://github.com/SpecHive/SpecHive/commit/79597b128a93d2ea501b9efde0a389f2087ac44f))
* error fingerprinting ([d100c59](https://github.com/SpecHive/SpecHive/commit/d100c597a3c68ab25a79b7aa9f9736458b289e43))
* error fingerprinting with date-scoped lastSeenAt ([2e89efd](https://github.com/SpecHive/SpecHive/commit/2e89efdf7a9a4b49dd080b9ca904a5bb498a8939))
* improve error explorer UX — fix overflow, simplify tabs, relocate filters ([6399ae5](https://github.com/SpecHive/SpecHive/commit/6399ae58403d093630bbd7fe1f8386f1ec30c548))
* improve error fingerprinting with reporter-first architecture and UX enhancements ([733e2be](https://github.com/SpecHive/SpecHive/commit/733e2bea925894931b4c3e95105d0fbb2409eb39))
* show color-coded category badges, fix ANSI parsing bug in reporter ([10565fb](https://github.com/SpecHive/SpecHive/commit/10565fb230328925e42f79ecfa10b29d1354c557))


### Bug Fixes

* address error explorer code review — correctness, quality, and test coverage ([f40fb1b](https://github.com/SpecHive/SpecHive/commit/f40fb1bd959cee7dfb9c38f789d3450156383d2e))
* address error explorer code review findings ([3e2df9a](https://github.com/SpecHive/SpecHive/commit/3e2df9a7408e0e31da5784845d76914793deb2af))
* address error explorer review — correctness, perf, and UX issues ([e3e052a](https://github.com/SpecHive/SpecHive/commit/e3e052a0533cbc9ab05546a3d2ea658fcda850d1))
* address error explorer review — correctness, UX, and documentation ([661aad1](https://github.com/SpecHive/SpecHive/commit/661aad147d90ba56b8b0b429b0ab31ee67e9f59a))
* address error explorer review — security, correctness, and shared hooks ([2e7019f](https://github.com/SpecHive/SpecHive/commit/2e7019f11944de2c261b1ca7c5ac4f52d968c75c))
* harden error fingerprinting, explorer queries, and reporter parsing ([7edba06](https://github.com/SpecHive/SpecHive/commit/7edba0626751877551f48a84f0f881aa976d4d26))
* **query-api:** fix wrong table alias in error group detail subquery ([03c5d07](https://github.com/SpecHive/SpecHive/commit/03c5d073138005eed56504dccc8d5b969238e6d8))
* resolve error explorer bugs and add integration tests ([8cf1185](https://github.com/SpecHive/SpecHive/commit/8cf1185c233e4a60af69c8017a77057551e5a6f0))
* use SQL alias in timeline metric expression to fix Drizzle table name mismatch ([dd28d68](https://github.com/SpecHive/SpecHive/commit/dd28d687fa56b969b1ed16e3a78ca2e38bd8615d))


### Refactoring

* address error explorer code review findings ([8a45292](https://github.com/SpecHive/SpecHive/commit/8a4529212ba20b5e962469299b725a0cd020a4d3))
* address error explorer review — dead index, stale code, type safety ([8156398](https://github.com/SpecHive/SpecHive/commit/8156398c2799e0ea572a0f25a7146c0814598464))
* fold error_category CHECK constraint into migration 0026 ([cadc377](https://github.com/SpecHive/SpecHive/commit/cadc377c30e40232411a18b67489ca4036714daa))
* simplify error explorer — remove dual-path queries and fix review findings ([5220572](https://github.com/SpecHive/SpecHive/commit/5220572fa851434158f9bea23181d9156f562ec1))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/api-types bumped to 0.0.6
    * @spechive/database bumped to 0.0.12
    * @spechive/nestjs-common bumped to 0.0.13
    * @spechive/shared-types bumped to 0.0.4

## [0.0.12](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.11...query-api-v0.0.12) (2026-03-29)


### Refactoring

* **nestjs-common:** migrate to nestjs-pino structured logging ([d511677](https://github.com/SpecHive/SpecHive/commit/d511677653c45c0b86d5d9cb1c890d33c1c438ff))
* **nestjs-common:** migrate to nestjs-pino structured logging ([d77e98e](https://github.com/SpecHive/SpecHive/commit/d77e98e60d6253ff16496974f0ab6c6fcb85c840))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.12

## [0.0.11](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.10...query-api-v0.0.11) (2026-03-26)


### Refactoring

* consolidate env vars — drop DASHBOARD_URL, rename WORKER_WEBHOOK_URL ([f517571](https://github.com/SpecHive/SpecHive/commit/f5175715fb81b8c165c2e0e2d5cab7d677d1e13e))
* reassign service ports with gateway as public entry on :3000 ([1f08b92](https://github.com/SpecHive/SpecHive/commit/1f08b92b20f11db202acbcdc4ca0e18e4de934c3))
* standardize ports and env management ([094d85c](https://github.com/SpecHive/SpecHive/commit/094d85cc748e961298f3125a52402b8145346573))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.11

## [0.0.10](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.9...query-api-v0.0.10) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.11
    * @spechive/nestjs-common bumped to 0.0.10

## [0.0.9](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.8...query-api-v0.0.9) (2026-03-24)


### Features

* Initial release ([06f75a3](https://github.com/SpecHive/SpecHive/commit/06f75a3143a3e0f86205f7e66affede7216e4a85))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/api-types bumped to 0.0.5
    * @spechive/database bumped to 0.0.10
    * @spechive/nestjs-common bumped to 0.0.9
    * @spechive/shared-types bumped to 0.0.3
  * devDependencies
    * @spechive/typescript-config bumped to 0.0.4

## [0.0.8](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.7...query-api-v0.0.8) (2026-03-22)


### Features

* add barrel exports, plugin system, and cloud extension points ([2cb0c9b](https://github.com/SpecHive/SpecHive/commit/2cb0c9b734550bbdf0ac72edf0db015b39faec93))
* add organization switcher endpoint and sidebar dropdown ([e839de6](https://github.com/SpecHive/SpecHive/commit/e839de6114e6684ea264c2fd21efa54d193c9c39))
* add query-api nestjs app for dashboard data access ([955aec4](https://github.com/SpecHive/SpecHive/commit/955aec4918c97934c292038306880b67fdefb792))
* **analytics:** add health scores, sparklines, period-over-period deltas, and enriched comparison ([16fa453](https://github.com/SpecHive/SpecHive/commit/16fa4538a54705d9e88ab818a165d6b2d0da63c2))
* **analytics:** implement daily pre-aggregation and analytics service ([#2](https://github.com/SpecHive/SpecHive/issues/2).2/[#2](https://github.com/SpecHive/SpecHive/issues/2).3) ([ecc5ec9](https://github.com/SpecHive/SpecHive/commit/ecc5ec9b449f2bf61e0ba09402327d292fe48086))
* **api:** project creation and token lifecycle management ([bf95b27](https://github.com/SpecHive/SpecHive/commit/bf95b2785569d656941c81cea806b67d68a65214))
* **dashboard,query-api:** refactor to feature-based architecture with org-level APIs ([8e5e5ec](https://github.com/SpecHive/SpecHive/commit/8e5e5ec5019e2032d02aef540daf2ea7e38b8bf3))
* **dashboard:** add KPI tooltips, fix flaky analytics query ([6fb723a](https://github.com/SpecHive/SpecHive/commit/6fb723a461ee87023e31b9802cbbfc091306a7d1))
* **dashboard:** add suite tree view with filtering on run detail page ([db18195](https://github.com/SpecHive/SpecHive/commit/db18195daebec8d667a0a66d589d347ed71baef8))
* **dashboard:** add toasts, search, sorting, and auth expiry UX ([0dba55d](https://github.com/SpecHive/SpecHive/commit/0dba55d9f99e8f9b1716e503c34752c26c19e512))
* **database:** add name column to runs table ([1377b85](https://github.com/SpecHive/SpecHive/commit/1377b85afabde15ed32464a26e8ba938dc50d340))
* **database:** enhance seed script with multiple projects and complex test data ([4f0c5ba](https://github.com/SpecHive/SpecHive/commit/4f0c5ba561e1c158fb66974bba6814e359c482f1))
* **gateway:** add API gateway with auth, proxy routing, and dev networking fixes ([215edc3](https://github.com/SpecHive/SpecHive/commit/215edc333ebc0e65f0b63df9b0260e1f72b95395))
* harden auth with RLS context, extract outboxy adapter, add integration tests ([11be8ef](https://github.com/SpecHive/SpecHive/commit/11be8ef24acda650add8ca9be682ffe6b707c42d))
* **platform:** add automatic artifact cleanup with S3 bulk delete ([2fe20b7](https://github.com/SpecHive/SpecHive/commit/2fe20b78f99b926243f323ae30df3e9f23ca33f6))
* **platform:** add automatic CI environment detection for test runs ([da2e126](https://github.com/SpecHive/SpecHive/commit/da2e1267e0d491ae37ee2e93a1bc8a67b939a8ed))
* **platform:** add graceful shutdown, parallelize queries, and shutdown integration test ([730d9c7](https://github.com/SpecHive/SpecHive/commit/730d9c74088f57ca6be8ab20c2dfb79524cce0ac))
* **platform:** add organization member management and invitation system ([61fc96d](https://github.com/SpecHive/SpecHive/commit/61fc96ddf51878e0ebbf15baa3befabc40db96f8))
* **platform:** add test retry attempt tracking with per-attempt visibility ([e3c3358](https://github.com/SpecHive/SpecHive/commit/e3c3358575486001976f6e8c463582702834751a))
* **platform:** add user profile management with password change ([928c470](https://github.com/SpecHive/SpecHive/commit/928c47096f426c13261ae4bc054493fedcb73b48))
* **platform:** add user registration with onboarding flow ([b78287f](https://github.com/SpecHive/SpecHive/commit/b78287fc063d33c7f794d3a2753aa4489e5aaffe))
* **platform:** orphaned run detection, status guards, flaky index, prod hardening ([3fdbe07](https://github.com/SpecHive/SpecHive/commit/3fdbe07aafe0ca0139a09981a3d220848f555732))
* **query-api,nestjs-common:** add Redis-backed login rate limiting ([df56b71](https://github.com/SpecHive/SpecHive/commit/df56b71be05615881a48581e4eebdddac5da3554))
* **query-api:** add analytics backend with aggregation endpoints ([891d513](https://github.com/SpecHive/SpecHive/commit/891d5139297ee33fb898c9464f79abf738021b3f))
* **query-api:** add login-specific rate limiting (10 req/min per IP) ([cbe2dcc](https://github.com/SpecHive/SpecHive/commit/cbe2dcc2a16ef8079e2a3c98277b0bc01d0582b6))
* **query-api:** add suites list endpoint for run suite hierarchy ([b5d83a0](https://github.com/SpecHive/SpecHive/commit/b5d83a0cd236c7ccaf6aabdb8c2240465869fedf))


### Bug Fixes

* address audit findings for config, dry, type safety, tests, and architecture ([1583d68](https://github.com/SpecHive/SpecHive/commit/1583d68ee951b435daaf5aeff89cfa301e496a54))
* address audit findings for db, config, code quality, and tests ([259b774](https://github.com/SpecHive/SpecHive/commit/259b77465302ef92cafb999eabab85b961fec3f0))
* **ci:** resolve 13 remaining integration test failures ([17821cf](https://github.com/SpecHive/SpecHive/commit/17821cfb90ad9fa832a6eebf9b79d598ecdcedb5))
* **dashboard,query-api:** fix login status code, remove dead links, show user info in sidebar ([25bc791](https://github.com/SpecHive/SpecHive/commit/25bc791b17ffbbb17e1e7a3e5451ac094e0e2314))
* **docker:** use HUSKY=0 instead of --ignore-scripts to fix arm64 QEMU crash ([f605b37](https://github.com/SpecHive/SpecHive/commit/f605b37fc2e86d48a007faaf86377a50e52c47e7))
* move NestJS peer deps to dependencies and fix docker init password substitution ([613f315](https://github.com/SpecHive/SpecHive/commit/613f315041d61e4d9be59024b1ebdd2fe08e9b37))
* **nestjs-common:** move Redis exports to subpath to fix Docker ioredis crash ([6d92ede](https://github.com/SpecHive/SpecHive/commit/6d92ede0cbd0892b3d8e682be1c9eafb43d96be4))
* **platform:** critical audit fixes — Dockerfiles, CI, artifact states, timing oracle, deps ([073e88b](https://github.com/SpecHive/SpecHive/commit/073e88bfa2671760d06ee251fc5e412acf5fdedd))
* **platform:** post-audit remediation — type safety, DRY, and defense-in-depth ([49c91f7](https://github.com/SpecHive/SpecHive/commit/49c91f7c9f58d76096acc85af20288c3122e49a2))
* pre-release security hardening, RBAC, and code quality sweep ([f7cee0d](https://github.com/SpecHive/SpecHive/commit/f7cee0dfe2fd6e4f6b46f9aef218ef70b92a149d))
* **security:** add refresh tokens, rate limiting, and tenant isolation tests ([34c41ef](https://github.com/SpecHive/SpecHive/commit/34c41efaba12ccff820acc2a5593d4238da1f3c0))
* **worker,tests:** fix Date serialization in analytics handlers and seed stats tables in tests ([e1e9054](https://github.com/SpecHive/SpecHive/commit/e1e9054e88dd3fe9b9654f46fb242c7512fc0d08))


### Refactoring

* **platform:** extract shared infra, add runtime validation, DRY patterns ([8f06a56](https://github.com/SpecHive/SpecHive/commit/8f06a5619692d3b786d421c054bc6dd92897ccb6))
* **test:** consolidate test utilities into shared helpers ([1ac1013](https://github.com/SpecHive/SpecHive/commit/1ac101336e5e57f34d31037c74f27ed0bad975d8))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.9
    * @spechive/nestjs-common bumped to 0.0.8

## [0.0.7](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.6...query-api-v0.0.7) (2026-03-22)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.8
    * @spechive/nestjs-common bumped to 0.0.7

## [0.0.6](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.5...query-api-v0.0.6) (2026-03-20)


### Bug Fixes

* **docker:** use HUSKY=0 instead of --ignore-scripts to fix arm64 QEMU crash ([f605b37](https://github.com/SpecHive/SpecHive/commit/f605b37fc2e86d48a007faaf86377a50e52c47e7))


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/nestjs-common bumped to 0.0.6

## [0.0.5](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.4...query-api-v0.0.5) (2026-03-19)


### Dependencies

* The following workspace dependencies were updated
  * dependencies
    * @spechive/database bumped to 0.0.7
    * @spechive/nestjs-common bumped to 0.0.5

## [0.0.4](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.3...query-api-v0.0.4) (2026-03-18)


### Features

* **analytics:** add health scores, sparklines, period-over-period deltas, and enriched comparison ([16fa453](https://github.com/SpecHive/SpecHive/commit/16fa4538a54705d9e88ab818a165d6b2d0da63c2))
* **dashboard,query-api:** refactor to feature-based architecture with org-level APIs ([8e5e5ec](https://github.com/SpecHive/SpecHive/commit/8e5e5ec5019e2032d02aef540daf2ea7e38b8bf3))
* **query-api,nestjs-common:** add Redis-backed login rate limiting ([df56b71](https://github.com/SpecHive/SpecHive/commit/df56b71be05615881a48581e4eebdddac5da3554))


### Bug Fixes

* **nestjs-common:** move Redis exports to subpath to fix Docker ioredis crash ([6d92ede](https://github.com/SpecHive/SpecHive/commit/6d92ede0cbd0892b3d8e682be1c9eafb43d96be4))

## [0.0.3](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.2...query-api-v0.0.3) (2026-03-17)


### Features

* **analytics:** implement daily pre-aggregation and analytics service ([#2](https://github.com/SpecHive/SpecHive/issues/2).2/[#2](https://github.com/SpecHive/SpecHive/issues/2).3) ([ecc5ec9](https://github.com/SpecHive/SpecHive/commit/ecc5ec9b449f2bf61e0ba09402327d292fe48086))
* **gateway:** add API gateway with auth, proxy routing, and dev networking fixes ([215edc3](https://github.com/SpecHive/SpecHive/commit/215edc333ebc0e65f0b63df9b0260e1f72b95395))


### Bug Fixes

* pre-release security hardening, RBAC, and code quality sweep ([f7cee0d](https://github.com/SpecHive/SpecHive/commit/f7cee0dfe2fd6e4f6b46f9aef218ef70b92a149d))
* **worker,tests:** fix Date serialization in analytics handlers and seed stats tables in tests ([e1e9054](https://github.com/SpecHive/SpecHive/commit/e1e9054e88dd3fe9b9654f46fb242c7512fc0d08))

## [0.0.2](https://github.com/SpecHive/SpecHive/compare/query-api-v0.0.1...query-api-v0.0.2) (2026-03-14)


### Features

* add barrel exports, plugin system, and cloud extension points ([2cb0c9b](https://github.com/SpecHive/SpecHive/commit/2cb0c9b734550bbdf0ac72edf0db015b39faec93))
* add organization switcher endpoint and sidebar dropdown ([e839de6](https://github.com/SpecHive/SpecHive/commit/e839de6114e6684ea264c2fd21efa54d193c9c39))
* add query-api nestjs app for dashboard data access ([955aec4](https://github.com/SpecHive/SpecHive/commit/955aec4918c97934c292038306880b67fdefb792))
* **api:** project creation and token lifecycle management ([bf95b27](https://github.com/SpecHive/SpecHive/commit/bf95b2785569d656941c81cea806b67d68a65214))
* **dashboard:** add KPI tooltips, fix flaky analytics query ([6fb723a](https://github.com/SpecHive/SpecHive/commit/6fb723a461ee87023e31b9802cbbfc091306a7d1))
* **dashboard:** add suite tree view with filtering on run detail page ([db18195](https://github.com/SpecHive/SpecHive/commit/db18195daebec8d667a0a66d589d347ed71baef8))
* **dashboard:** add toasts, search, sorting, and auth expiry UX ([0dba55d](https://github.com/SpecHive/SpecHive/commit/0dba55d9f99e8f9b1716e503c34752c26c19e512))
* **database:** add name column to runs table ([1377b85](https://github.com/SpecHive/SpecHive/commit/1377b85afabde15ed32464a26e8ba938dc50d340))
* **database:** enhance seed script with multiple projects and complex test data ([4f0c5ba](https://github.com/SpecHive/SpecHive/commit/4f0c5ba561e1c158fb66974bba6814e359c482f1))
* harden auth with RLS context, extract outboxy adapter, add integration tests ([11be8ef](https://github.com/SpecHive/SpecHive/commit/11be8ef24acda650add8ca9be682ffe6b707c42d))
* **platform:** add automatic artifact cleanup with S3 bulk delete ([2fe20b7](https://github.com/SpecHive/SpecHive/commit/2fe20b78f99b926243f323ae30df3e9f23ca33f6))
* **platform:** add automatic CI environment detection for test runs ([da2e126](https://github.com/SpecHive/SpecHive/commit/da2e1267e0d491ae37ee2e93a1bc8a67b939a8ed))
* **platform:** add graceful shutdown, parallelize queries, and shutdown integration test ([730d9c7](https://github.com/SpecHive/SpecHive/commit/730d9c74088f57ca6be8ab20c2dfb79524cce0ac))
* **platform:** add organization member management and invitation system ([61fc96d](https://github.com/SpecHive/SpecHive/commit/61fc96ddf51878e0ebbf15baa3befabc40db96f8))
* **platform:** add test retry attempt tracking with per-attempt visibility ([e3c3358](https://github.com/SpecHive/SpecHive/commit/e3c3358575486001976f6e8c463582702834751a))
* **platform:** add user profile management with password change ([928c470](https://github.com/SpecHive/SpecHive/commit/928c47096f426c13261ae4bc054493fedcb73b48))
* **platform:** add user registration with onboarding flow ([b78287f](https://github.com/SpecHive/SpecHive/commit/b78287fc063d33c7f794d3a2753aa4489e5aaffe))
* **platform:** orphaned run detection, status guards, flaky index, prod hardening ([3fdbe07](https://github.com/SpecHive/SpecHive/commit/3fdbe07aafe0ca0139a09981a3d220848f555732))
* **query-api:** add analytics backend with aggregation endpoints ([891d513](https://github.com/SpecHive/SpecHive/commit/891d5139297ee33fb898c9464f79abf738021b3f))
* **query-api:** add login-specific rate limiting (10 req/min per IP) ([cbe2dcc](https://github.com/SpecHive/SpecHive/commit/cbe2dcc2a16ef8079e2a3c98277b0bc01d0582b6))
* **query-api:** add suites list endpoint for run suite hierarchy ([b5d83a0](https://github.com/SpecHive/SpecHive/commit/b5d83a0cd236c7ccaf6aabdb8c2240465869fedf))


### Bug Fixes

* address audit findings for config, dry, type safety, tests, and architecture ([1583d68](https://github.com/SpecHive/SpecHive/commit/1583d68ee951b435daaf5aeff89cfa301e496a54))
* address audit findings for db, config, code quality, and tests ([259b774](https://github.com/SpecHive/SpecHive/commit/259b77465302ef92cafb999eabab85b961fec3f0))
* **ci:** resolve 13 remaining integration test failures ([17821cf](https://github.com/SpecHive/SpecHive/commit/17821cfb90ad9fa832a6eebf9b79d598ecdcedb5))
* **dashboard,query-api:** fix login status code, remove dead links, show user info in sidebar ([25bc791](https://github.com/SpecHive/SpecHive/commit/25bc791b17ffbbb17e1e7a3e5451ac094e0e2314))
* move NestJS peer deps to dependencies and fix docker init password substitution ([613f315](https://github.com/SpecHive/SpecHive/commit/613f315041d61e4d9be59024b1ebdd2fe08e9b37))
* **platform:** critical audit fixes — Dockerfiles, CI, artifact states, timing oracle, deps ([073e88b](https://github.com/SpecHive/SpecHive/commit/073e88bfa2671760d06ee251fc5e412acf5fdedd))
* **platform:** post-audit remediation — type safety, DRY, and defense-in-depth ([49c91f7](https://github.com/SpecHive/SpecHive/commit/49c91f7c9f58d76096acc85af20288c3122e49a2))
* **security:** add refresh tokens, rate limiting, and tenant isolation tests ([34c41ef](https://github.com/SpecHive/SpecHive/commit/34c41efaba12ccff820acc2a5593d4238da1f3c0))


### Refactoring

* **platform:** extract shared infra, add runtime validation, DRY patterns ([8f06a56](https://github.com/SpecHive/SpecHive/commit/8f06a5619692d3b786d421c054bc6dd92897ccb6))
* **test:** consolidate test utilities into shared helpers ([1ac1013](https://github.com/SpecHive/SpecHive/commit/1ac101336e5e57f34d31037c74f27ed0bad975d8))
